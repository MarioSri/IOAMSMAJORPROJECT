// ---------------------------------------------------------------------------
// Supabase Audit Logger – writes audit events to the audit_logs table
// ---------------------------------------------------------------------------

import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';

interface AuditLogEntry {
  user_id?: string;
  user_role?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

/**
 * Write an audit log entry to the `audit_logs` table.
 * Silently no-ops when Supabase is not configured so the rest of the
 * backend can still function without a database connection.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.debug('[AuditLogger] Supabase not configured – skipping audit log');
    return;
  }

  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      user_id: entry.user_id ?? null,
      user_role: entry.user_role ?? null,
      action: entry.action,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ip_address ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Non-fatal – log and continue
      console.warn('[AuditLogger] Failed to write audit log:', error.message);
    }
  } catch (err) {
    console.warn('[AuditLogger] Unexpected error writing audit log:', err);
  }
}
