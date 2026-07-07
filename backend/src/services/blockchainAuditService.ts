// =============================================================================
// Blockchain Audit Service
// Core event creation, SHA-256 hashing, and queue insertion.
// Completely independent from the existing supabaseAuditLogger.ts.
// =============================================================================

import { createHash } from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import type {
  BlockchainEventPayload,
  BlockchainAuditLogEntry,
  RekorUploadResult,
} from '../types/blockchainAudit';

const LOG_PREFIX = '[BlockchainAudit]';

// ---------------------------------------------------------------------------
// Hash utilities
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash of a UTF-8 string. Returns lowercase hex digest.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Produces a deterministic SHA-256 hash of a document's metadata fields.
 * Only stable, non-mutable fields are included so the hash is consistent
 * regardless of when it is computed.
 */
export function calculateDocumentHash(doc: {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  submitter_id?: string;
}): string {
  const canonical = JSON.stringify({
    id: doc.id,
    title: doc.title ?? '',
    description: doc.description ?? '',
    type: doc.type ?? '',
    submitter_id: doc.submitter_id ?? '',
  });
  return sha256(canonical);
}

/**
 * Produces a deterministic SHA-256 hash of an event payload.
 * Keys are sorted alphabetically before serialisation so the hash is
 * independent of insertion order.
 */
export function calculateEventHash(payload: BlockchainEventPayload): string {
  const sorted = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (payload as unknown as Record<string, unknown>)[key];
      return acc;
    }, {});
  return sha256(JSON.stringify(sorted));
}

// ---------------------------------------------------------------------------
// Chain query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the event_hash of the most recent event for a document.
 * Returns null if this will be the first event for the document.
 */
export async function getPreviousEventHash(documentId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('blockchain_audit_log')
      .select('event_hash')
      .eq('document_id', documentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`${LOG_PREFIX} Could not fetch previous event hash:`, error.message);
      return null;
    }
    return data?.event_hash ?? null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Unexpected error fetching previous event hash:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

export interface CreateEventParams {
  documentId: string;
  documentHash: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  workflowStep?: string | null;
  routingType?: string | null;
  previousStep?: string | null;
  nextStep?: string | null;
  comment?: string | null;
  bypassReason?: string | null;
  bypassedRole?: string | null;
  authorizedBy?: string | null;
}

/**
 * Builds a complete event payload including the previous chain link.
 * Queries Supabase for the prior event hash — call this just before queueing.
 */
export async function createEventPayload(
  params: CreateEventParams
): Promise<BlockchainEventPayload> {
  const previousEventHash = await getPreviousEventHash(params.documentId);

  return {
    document_id: params.documentId,
    document_hash: params.documentHash,
    actor_email: params.actorEmail,
    actor_role: params.actorRole,
    action: params.action,
    workflow_step: params.workflowStep ?? null,
    timestamp: new Date().toISOString(),
    previous_event_hash: previousEventHash,
    routing_type: params.routingType ?? null,
    previous_step: params.previousStep ?? null,
    next_step: params.nextStep ?? null,
    comment: params.comment ?? null,
    bypass_reason: params.bypassReason ?? null,
    bypassed_role: params.bypassedRole ?? null,
    authorized_by: params.authorizedBy ?? null,
  };
}

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

/**
 * Inserts an event into rekor_queue with status=PENDING.
 * The background worker (rekorQueueWorker) processes it asynchronously.
 */
export async function queueBlockchainEvent(
  eventPayload: BlockchainEventPayload,
  eventHash: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.debug(`${LOG_PREFIX} Supabase not configured — skipping queue`);
    return;
  }

  try {
    const { error } = await supabaseAdmin.from('rekor_queue').insert({
      document_id: eventPayload.document_id,
      event_data: eventPayload,
      event_hash: eventHash,
      status: 'PENDING',
      retry_count: 0,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(`${LOG_PREFIX} Failed to insert into rekor_queue:`, error.message);
    } else {
      console.debug(
        `${LOG_PREFIX} Queued event for document ${eventPayload.document_id}` +
        ` action=${eventPayload.action} hash=${eventHash.slice(0, 12)}...`
      );
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Unexpected error queuing blockchain event:`, err);
  }
}

// ---------------------------------------------------------------------------
// Audit log record (written after successful Rekor upload)
// ---------------------------------------------------------------------------

/**
 * Persists a completed blockchain audit entry including the Rekor UUID and
 * log index returned after the transparency log upload succeeds.
 */
export async function recordBlockchainEntry(
  payload: BlockchainEventPayload,
  eventHash: string,
  rekorResult: RekorUploadResult
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.debug(`${LOG_PREFIX} Supabase not configured — skipping record`);
    return;
  }

  const actorIdHash = sha256(payload.actor_email);

  try {
    const { error } = await supabaseAdmin.from('blockchain_audit_log').insert({
      document_id: payload.document_id,
      document_hash: payload.document_hash,
      original_document_hash: payload.document_hash,  // captured on SUBMITTED; overwritten only on first event
      actor_id_hash: actorIdHash,
      actor_email: payload.actor_email,
      actor_role: payload.actor_role,
      action: payload.action,
      workflow_step: payload.workflow_step,
      timestamp: payload.timestamp,
      event_hash: eventHash,
      previous_event_hash: payload.previous_event_hash,
      rekor_uuid: rekorResult.uuid,
      rekor_log_index: rekorResult.logIndex,
      routing_type: payload.routing_type ?? null,
      previous_step: payload.previous_step ?? null,
      next_step: payload.next_step ?? null,
      comment: payload.comment ?? null,
      bypass_reason: payload.bypass_reason ?? null,
      bypassed_role: payload.bypassed_role ?? null,
      authorized_by: payload.authorized_by ?? null,
      verification_status: 'verified',
      last_verified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`${LOG_PREFIX} Failed to record blockchain entry:`, error.message);
    } else {
      console.info(
        `${LOG_PREFIX} Recorded audit entry — document=${payload.document_id}` +
        ` action=${payload.action} rekor=${rekorResult.uuid}`
      );
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Unexpected error recording blockchain entry:`, err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: build payload + hash + queue in one call
// ---------------------------------------------------------------------------

/**
 * High-level helper used by route handlers and frontend reporting endpoint.
 * Creates the payload, calculates its hash, and enqueues for Rekor upload.
 * Never throws — all errors are logged and suppressed to protect the caller.
 */
export async function logWorkflowEvent(params: {
  documentId: string;
  documentTitle?: string;
  documentDescription?: string;
  documentType?: string;
  documentSubmitterId?: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  workflowStep?: string | null;
  routingType?: string | null;
  previousStep?: string | null;
  nextStep?: string | null;
  comment?: string | null;
  bypassReason?: string | null;
  bypassedRole?: string | null;
  authorizedBy?: string | null;
}): Promise<void> {
  try {
    const documentHash = calculateDocumentHash({
      id: params.documentId,
      title: params.documentTitle,
      description: params.documentDescription,
      type: params.documentType,
      submitter_id: params.documentSubmitterId,
    });

    const payload = await createEventPayload({
      documentId: params.documentId,
      documentHash,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      action: params.action,
      workflowStep: params.workflowStep,
      routingType: params.routingType,
      previousStep: params.previousStep,
      nextStep: params.nextStep,
      comment: params.comment,
      bypassReason: params.bypassReason,
      bypassedRole: params.bypassedRole,
      authorizedBy: params.authorizedBy,
    });

    const eventHash = calculateEventHash(payload);
    await queueBlockchainEvent(payload, eventHash);
  } catch (err) {
    // Non-fatal -- blockchain logging must NEVER affect the primary workflow
    console.warn(`${LOG_PREFIX} logWorkflowEvent suppressed error:`, err);
  }
}

// ---------------------------------------------------------------------------
// Query helpers (used by controller)
// ---------------------------------------------------------------------------

export async function getAuditTrailForDocument(
  documentId: string
): Promise<BlockchainAuditLogEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabaseAdmin
    .from('blockchain_audit_log')
    .select('*')
    .eq('document_id', documentId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.warn(`${LOG_PREFIX} Failed to fetch audit trail:`, error.message);
    return [];
  }
  return (data ?? []) as BlockchainAuditLogEntry[];
}

export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  if (!isSupabaseConfigured()) {
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from('rekor_queue')
    .select('status');

  if (error || !data) {
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }

  return data.reduce(
    (acc: { pending: number; processing: number; completed: number; failed: number }, row: { status: string }) => {
      const s = row.status as keyof typeof acc;
      if (s in acc) acc[s]++;
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0 }
  );
}
