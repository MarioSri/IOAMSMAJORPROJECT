import { supabase } from '@/lib/supabase';
import type {
  LogEventRequest,
  AuditTrailResponse,
  ChainVerificationResult,
  QueueStats,
} from '@/types/blockchainAudit';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/** Helper — get Bearer token or null. */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Fire-and-forget blockchain audit logging for the frontend.
 * Never throws — audit failures must not block document workflow actions.
 */
export async function reportBlockchainEvent(params: LogEventRequest): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    await fetch(`${BACKEND_URL}/api/blockchain-audit/log-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  } catch {
    // Intentionally silent — blockchain logging must never disrupt the UI
  }
}

/**
 * Fetches the full blockchain audit trail for a document.
 */
export async function fetchAuditTrail(documentId: string): Promise<AuditTrailResponse | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(
    `${BACKEND_URL}/api/blockchain-audit/trail/${encodeURIComponent(documentId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
}

/**
 * Verifies the hash‐chain integrity of a document's audit trail.
 */
export async function verifyDocumentChain(documentId: string): Promise<ChainVerificationResult | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(
    `${BACKEND_URL}/api/blockchain-audit/verify/${encodeURIComponent(documentId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
}

/**
 * Returns the current Rekor queue status + worker health.
 */
export async function fetchQueueStatus(): Promise<{
  queue: QueueStats;
  worker: { running: boolean; consecutiveFailures: number; circuitBreakerActive: boolean };
} | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(
    `${BACKEND_URL}/api/blockchain-audit/queue/status`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data : null;
}
