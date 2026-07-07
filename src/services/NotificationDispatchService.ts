/**
 * NotificationDispatchService
 *
 * Thin frontend wrapper around POST /api/notifications/dispatch.
 * Handles:
 *  - Converting role_recipients.id UUIDs → supabase_uid (needed by backend)
 *  - Attaching the Supabase session auth token
 *  - Non-blocking fire-and-forget calls (callers don't need to await)
 */
import { supabase } from '@/lib/supabase';

const API_BASE = '/api';

export interface DispatchPayload {
  /** Direct Supabase auth UIDs (auth.users.id). Use these when you already have the UID. */
  userIds?: string[];
  /**
   * role_recipients.id values — will be resolved to supabase_uid automatically.
   * Use these for workflow recipients / meeting participants stored by role_recipients PK.
   */
  recipientRowIds?: string[];
  title: string;
  message: string;
  type: 'submission' | 'approval' | 'meeting' | 'emergency' | 'routing' | 'general';
  urgent?: boolean;
  action_url?: string;
  document_id?: string;
  emailParams?: {
    type: 'submission' | 'approval' | 'livemeet_request' | 'livemeet_response' | 'emergency' | 'routing';
    params: Record<string, unknown>;
  } | null;
  pushPayload?: {
    title: string;
    body: string;
    url?: string;
  } | null;
  metadata?: Record<string, unknown>;
}

async function resolveToSupabaseUids(roleRecipientIds: string[]): Promise<string[]> {
  if (!roleRecipientIds.length) return [];
  const { data } = await supabase
    .from('role_recipients')
    .select('supabase_uid')
    .in('id', roleRecipientIds);
  return (data || []).map((r: any) => r.supabase_uid as string).filter(Boolean);
}

export const NotificationDispatchService = {
  /**
   * Dispatch a notification to one or more users.
   * This is fire-and-forget: errors are caught and logged, not thrown.
   */
  async dispatch(payload: DispatchPayload): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[NotificationDispatch] No active session — skipping dispatch');
        return;
      }

      let userIds: string[] = [...(payload.userIds || [])];

      if (payload.recipientRowIds?.length) {
        const resolved = await resolveToSupabaseUids(payload.recipientRowIds);
        userIds = [...userIds, ...resolved];
      }

      // Deduplicate and remove empty strings
      userIds = [...new Set(userIds.filter(Boolean))];
      if (!userIds.length) {
        console.warn('[NotificationDispatch] No resolvable recipients — skipping dispatch');
        return;
      }

      const body = { ...payload, userIds };
      delete (body as any).recipientRowIds;

      const response = await fetch(`${API_BASE}/notifications/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[NotificationDispatch] HTTP error:', response.status, text);
      }
    } catch (err) {
      console.error('[NotificationDispatch] Error:', err);
    }
  },
};
