/**
 * AuditLogger — structured audit trail → Supabase
 * Logs signing lifecycle events for compliance and tamper visibility.
 */
import { supabase } from '@/lib/supabase';

export type AuditEventType =
  | 'document_opened'
  | 'signature_placed'
  | 'signature_removed'
  | 'document_signed'
  | 'signature_verified'
  | 'tamper_detected'
  | 'fingerprint_computed';

export interface AuditEvent {
  event_type: AuditEventType;
  document_id: string;
  user_name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit event to `document_audit_log` table.
 * Silently swallows errors so it never breaks the signing flow.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await supabase.from('document_audit_log').insert({
      document_id: event.document_id,
      event_type: event.event_type,
      user_name: event.user_name,
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    console.warn('[AuditLogger] Failed to log event:', err);
  }
}
