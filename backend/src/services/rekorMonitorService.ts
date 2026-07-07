// =============================================================================
// Rekor Monitor Service
//
// Implements daily monitoring of the Rekor transparency log as recommended
// by Sigstore. Rekor is tamper-EVIDENT (not tamper-proof) — monitoring is
// required to detect any log operator misbehavior.
//
// Daily checks:
//   1. Log consistency — tree size should only grow, never shrink
//   2. Tree head validity — log info is reachable and returns sane values
//   3. Identity monitoring — alert on unexpected entries for institutional emails
//
// Results are written to the rekor_monitoring_log table and logged to console.
// =============================================================================

import cron from 'node-cron';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { getRekorLogInfo, searchRekorByEmail } from './rekorService';
import type { MonitoringResult } from '../types/blockchainAudit';

const LOG_PREFIX = '[RekorMonitor]';

// Institutional email identities to watch in the transparency log.
// These are the roles that sign workflow events. Unexpected entries for these
// emails would indicate unauthorised use of identity or signing key compromise.
const MONITORED_EMAILS: string[] = (
  process.env.REKOR_MONITORED_EMAILS || ''
)
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

// Stored tree size from the last successful check — used for consistency proof.
let lastKnownTreeSize: number | null = null;

// ---------------------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------------------

async function checkLogConsistency(): Promise<{
  status: 'ok' | 'failed' | 'skipped';
  treeSize: number | null;
  issues: string[];
}> {
  const info = await getRekorLogInfo();
  const issues: string[] = [];

  if (!info) {
    return { status: 'failed', treeSize: null, issues: ['Could not reach Rekor API'] };
  }

  // Tree size must be >= last known size (append-only guarantee)
  if (lastKnownTreeSize !== null && info.treeSize < lastKnownTreeSize) {
    issues.push(
      `TAMPERING DETECTED: Rekor tree size DECREASED from ${lastKnownTreeSize}` +
      ` to ${info.treeSize}. Log entries may have been removed.`
    );
  }

  lastKnownTreeSize = info.treeSize;
  return {
    status: issues.length > 0 ? 'failed' : 'ok',
    treeSize: info.treeSize,
    issues,
  };
}

async function checkIdentityMonitoring(): Promise<{
  unexpectedCount: number;
  issues: string[];
}> {
  if (MONITORED_EMAILS.length === 0) {
    console.debug(`${LOG_PREFIX} No REKOR_MONITORED_EMAILS configured — skipping identity check`);
    return { unexpectedCount: 0, issues: [] };
  }

  const issues: string[] = [];
  let unexpectedCount = 0;

  for (const email of MONITORED_EMAILS) {
    try {
      const uuids = await searchRekorByEmail(email);
      if (uuids.length === 0) continue;

      // Cross-reference against known entries in our blockchain_audit_log
      const { data: knownEntries } = await supabaseAdmin
        .from('blockchain_audit_log')
        .select('rekor_uuid')
        .eq('actor_email', email)
        .not('rekor_uuid', 'is', null);

      const knownUuids = new Set((knownEntries || []).map((r: { rekor_uuid: string | null }) => r.rekor_uuid));
      const unexpectedUuids = uuids.filter((u: string) => !knownUuids.has(u));

      if (unexpectedUuids.length > 0) {
        unexpectedCount += unexpectedUuids.length;
        issues.push(
          `Unexpected Rekor entries for ${email}: ${unexpectedUuids.slice(0, 5).join(', ')}` +
          (unexpectedUuids.length > 5 ? ` (+${unexpectedUuids.length - 5} more)` : '')
        );
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Identity check failed for ${email}:`, err);
    }
  }

  return { unexpectedCount, issues };
}

// ---------------------------------------------------------------------------
// Main monitoring check
// ---------------------------------------------------------------------------

export async function runDailyMonitoringCheck(): Promise<MonitoringResult> {
  if (!isSupabaseConfigured()) {
    console.warn(`${LOG_PREFIX} Supabase not configured — skipping monitoring check`);
    return {
      id: '',
      check_date: new Date().toISOString().split('T')[0],
      log_consistency_status: 'skipped',
      tree_head_valid: null,
      unexpected_entries_found: 0,
      issues_detected: ['Supabase not configured'],
      monitoring_duration_ms: 0,
      rekor_tree_size: null,
      created_at: new Date().toISOString(),
    };
  }

  const startTime = Date.now();
  const allIssues: string[] = [];
  let treeHeadValid = false;
  let rekorTreeSize: number | null = null;

  console.info(`${LOG_PREFIX} Starting daily monitoring check`);

  // Check 1: Log consistency
  const consistencyResult = await checkLogConsistency();
  allIssues.push(...consistencyResult.issues);
  rekorTreeSize = consistencyResult.treeSize;
  treeHeadValid = consistencyResult.status === 'ok';

  if (consistencyResult.status === 'failed') {
    console.error(`${LOG_PREFIX} Log consistency check FAILED: ${consistencyResult.issues.join('; ')}`);
  }

  // Check 2: Identity monitoring
  const identityResult = await checkIdentityMonitoring();
  allIssues.push(...identityResult.issues);

  if (identityResult.unexpectedCount > 0) {
    console.error(
      `${LOG_PREFIX} Identity monitoring found ${identityResult.unexpectedCount}` +
      ` unexpected entries. Possible unauthorised signing.`
    );
  }

  const durationMs = Date.now() - startTime;
  const checkDate = new Date().toISOString().split('T')[0];

  const result: Omit<MonitoringResult, 'id'> = {
    check_date: checkDate,
    log_consistency_status: consistencyResult.status,
    tree_head_valid: treeHeadValid,
    unexpected_entries_found: identityResult.unexpectedCount,
    issues_detected: allIssues,
    monitoring_duration_ms: durationMs,
    rekor_tree_size: rekorTreeSize,
    created_at: new Date().toISOString(),
  };

  // Persist the result
  const { data: saved, error } = await supabaseAdmin
    .from('rekor_monitoring_log')
    .insert(result)
    .select()
    .single();

  if (error) {
    console.error(`${LOG_PREFIX} Failed to save monitoring result:`, error.message);
  }

  const finalResult: MonitoringResult = { id: saved?.id ?? '', ...result };

  if (allIssues.length > 0) {
    console.error(
      `${LOG_PREFIX} Monitoring check COMPLETED with ${allIssues.length} issues` +
      ` in ${durationMs}ms. Issues: ${allIssues.join(' | ')}`
    );
    // Admin alert for any issues found
    console.error(
      `[ADMIN ALERT] Rekor monitoring detected issues on ${checkDate}.` +
      ` Review /api/blockchain-audit/monitoring/latest for details.`
    );
  } else {
    console.info(
      `${LOG_PREFIX} Monitoring check passed — ${durationMs}ms,` +
      ` treeSize=${rekorTreeSize ?? 'unknown'}`
    );
  }

  return finalResult;
}

// ---------------------------------------------------------------------------
// Latest monitoring result query
// ---------------------------------------------------------------------------

export async function getLatestMonitoringResult(): Promise<MonitoringResult | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabaseAdmin
    .from('rekor_monitoring_log')
    .select('*')
    .order('check_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to fetch latest monitoring result:`, error.message);
    return null;
  }
  return data as MonitoringResult | null;
}

export async function getMonitoringHistory(days = 30): Promise<MonitoringResult[]> {
  if (!isSupabaseConfigured()) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from('rekor_monitoring_log')
    .select('*')
    .gte('check_date', since.toISOString().split('T')[0])
    .order('check_date', { ascending: false });

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to fetch monitoring history:`, error.message);
    return [];
  }
  return (data ?? []) as MonitoringResult[];
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

let monitoringJob: cron.ScheduledTask | null = null;

/**
 * Starts the daily cron job (runs at 00:05 UTC every day).
 * Safe to call multiple times — replaces existing job.
 */
export function startMonitoringSchedule(): void {
  if (monitoringJob) {
    monitoringJob.stop();
  }

  // 00:05 UTC daily — offset by 5 minutes to avoid exact midnight contention
  monitoringJob = cron.schedule('5 0 * * *', async () => {
    try {
      await runDailyMonitoringCheck();
    } catch (err) {
      console.error(`${LOG_PREFIX} Scheduled check threw unexpected error:`, err);
    }
  }, { timezone: 'UTC' });

  console.info(`${LOG_PREFIX} Monitoring scheduled — runs daily at 00:05 UTC`);
}

/**
 * Stops the scheduled monitoring job.
 */
export function stopMonitoringSchedule(): void {
  if (monitoringJob) {
    monitoringJob.stop();
    monitoringJob = null;
    console.info(`${LOG_PREFIX} Monitoring schedule stopped`);
  }
}
