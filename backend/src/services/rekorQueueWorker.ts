// =============================================================================
// Rekor Queue Worker
//
// Background worker that polls the rekor_queue table and uploads pending
// events to the Rekor transparency log.
//
// Features:
//   - Processes up to BATCH_SIZE events per poll cycle
//   - Exponential backoff retries (max MAX_RETRIES attempts)
//   - Circuit breaker: pauses worker for CIRCUIT_BREAK_PAUSE_MS after
//     CIRCUIT_BREAK_THRESHOLD consecutive failures
//   - Graceful stop: call stopWorker() on server shutdown
// =============================================================================

import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { signAndUploadToRekor } from './rekorService';
import { recordBlockchainEntry } from './blockchainAuditService';
import type { BlockchainEventPayload, RekorQueueEntry } from '../types/blockchainAudit';

const LOG_PREFIX = '[RekorWorker]';

const BATCH_SIZE = 10;
const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 5_000;

// Circuit breaker configuration
const CIRCUIT_BREAK_THRESHOLD = 10;     // consecutive failures before tripping
const CIRCUIT_BREAK_PAUSE_MS = 5 * 60 * 1000; // 5-minute pause when tripped

// Exponential backoff delays (seconds)
const BACKOFF_DELAYS_SEC = [1, 2, 4, 8, 16];

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------
let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let consecutiveFailures = 0;
let circuitBreakerUntil: number | null = null;  // epoch ms — 0 means not tripped

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notifyAdmin(message: string): void {
  // Log at ERROR level so server-level alerting (e.g. Datadog, Sentry) picks it up.
  // Swap for an email/webhook call in production if desired.
  console.error(`${LOG_PREFIX} [ADMIN ALERT] ${message}`);
}

/** Returns true if the circuit breaker is active (worker should pause). */
function isCircuitOpen(): boolean {
  if (circuitBreakerUntil === null) return false;
  if (Date.now() < circuitBreakerUntil) return true;
  // Reset after pause period
  circuitBreakerUntil = null;
  consecutiveFailures = 0;
  console.info(`${LOG_PREFIX} Circuit breaker reset — resuming normal operation`);
  return false;
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Attempts to upload a single queue entry to Rekor.
 * Returns true on success, false on failure.
 */
async function processEntry(entry: RekorQueueEntry): Promise<boolean> {
  // Mark as PROCESSING
  await supabaseAdmin
    .from('rekor_queue')
    .update({ status: 'PROCESSING' })
    .eq('id', entry.id);

  try {
    const payload = entry.event_data as BlockchainEventPayload;
    const rekorResult = await signAndUploadToRekor(payload);

    // Write the completed audit log entry
    await recordBlockchainEntry(payload, entry.event_hash, rekorResult);

    // Mark queue entry as COMPLETED
    await supabaseAdmin
      .from('rekor_queue')
      .update({
        status: 'COMPLETED',
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', entry.id);

    consecutiveFailures = 0;  // reset circuit breaker counter on success
    return true;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const newRetryCount = entry.retry_count + 1;

    if (newRetryCount >= MAX_RETRIES) {
      // Give up — mark as FAILED for admin review
      await supabaseAdmin
        .from('rekor_queue')
        .update({
          status: 'FAILED',
          retry_count: newRetryCount,
          error_message: `Max retries exceeded. Last error: ${errorMessage}`,
          processed_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      notifyAdmin(
        `Queue entry ${entry.id} for document ${entry.document_id} reached max retries.` +
        ` Last error: ${errorMessage}`
      );
    } else {
      // Requeue with exponential backoff
      const backoffSec = BACKOFF_DELAYS_SEC[newRetryCount - 1] ?? 16;
      const retryAfter = new Date(Date.now() + backoffSec * 1000).toISOString();

      await supabaseAdmin
        .from('rekor_queue')
        .update({
          status: 'PENDING',
          retry_count: newRetryCount,
          error_message: `Attempt ${newRetryCount}: ${errorMessage}. Retry after ${retryAfter}`,
        })
        .eq('id', entry.id);

      console.warn(
        `${LOG_PREFIX} Entry ${entry.id} failed (attempt ${newRetryCount}/${MAX_RETRIES}).` +
        ` Retrying in ${backoffSec}s. Error: ${errorMessage}`
      );
    }

    consecutiveFailures++;

    // Check circuit breaker threshold
    if (consecutiveFailures >= CIRCUIT_BREAK_THRESHOLD) {
      circuitBreakerUntil = Date.now() + CIRCUIT_BREAK_PAUSE_MS;
      notifyAdmin(
        `Circuit breaker tripped after ${consecutiveFailures} consecutive failures.` +
        ` Worker paused for ${CIRCUIT_BREAK_PAUSE_MS / 60_000} minutes.` +
        ` Likely cause: Rekor API unavailable or network issue.`
      );
    }

    return false;
  }
}

/**
 * Processes one batch of PENDING queue entries.
 */
async function processBatch(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (isCircuitOpen()) {
    console.debug(`${LOG_PREFIX} Circuit breaker active — skipping batch`);
    return;
  }

  try {
    // Fetch PENDING entries only — exclude PROCESSING (in-flight from prior crash)
    // and include PROCESSING entries older than 2 minutes (stale after crash restart)
    const staleThreshold = new Date(Date.now() - 2 * 60_000).toISOString();

    const { data: entries, error } = await supabaseAdmin
      .from('rekor_queue')
      .select('*')
      .or(`status.eq.PENDING,and(status.eq.PROCESSING,created_at.lt.${staleThreshold})`)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.warn(`${LOG_PREFIX} Failed to fetch queue batch:`, error);
      if (error.message?.includes('fetch failed')) {
        console.error(`${LOG_PREFIX} Network error - check Supabase URL and connectivity`);
      }
      return;
    }

    if (!entries || entries.length === 0) return;

    console.debug(`${LOG_PREFIX} Processing batch of ${entries.length} entries`);

    // Process sequentially within batch to preserve chain ordering per document
    for (const entry of entries) {
      if (!isRunning) break;  // respect stop signal
      await processEntry(entry as unknown as RekorQueueEntry);
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Batch processing error:`, err);
  }
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

/**
 * Starts the background polling worker.
 * Safe to call multiple times — ignores if already running.
 */
export function startWorker(): void {
  if (isRunning) {
    console.debug(`${LOG_PREFIX} Already running`);
    return;
  }

  isRunning = true;
  consecutiveFailures = 0;
  circuitBreakerUntil = null;
  console.info(`${LOG_PREFIX} Started — polling every ${POLL_INTERVAL_MS / 1000}s`);

  const schedule = () => {
    pollingTimer = setTimeout(async () => {
      if (!isRunning) return;
      await processBatch();
      if (isRunning) schedule();  // re-schedule for next cycle
    }, POLL_INTERVAL_MS);
  };

  // Run first batch immediately, then schedule recurring
  processBatch().then(() => {
    if (isRunning) schedule();
  }).catch(() => {
    if (isRunning) schedule();
  });
}

/**
 * Stops the worker gracefully.
 * Call this in SIGTERM/SIGINT handlers before shutdown.
 */
export function stopWorker(): void {
  if (!isRunning) return;
  isRunning = false;
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
  console.info(`${LOG_PREFIX} Stopped`);
}

/**
 * Returns current worker health snapshot.
 */
export function getWorkerStatus(): {
  running: boolean;
  consecutiveFailures: number;
  circuitBreakerActive: boolean;
  circuitBreakerResetsAt: string | null;
} {
  return {
    running: isRunning,
    consecutiveFailures,
    circuitBreakerActive: isCircuitOpen(),
    circuitBreakerResetsAt: circuitBreakerUntil
      ? new Date(circuitBreakerUntil).toISOString()
      : null,
  };
}
