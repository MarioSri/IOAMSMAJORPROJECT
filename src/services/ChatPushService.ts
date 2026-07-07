/**
 * ChatPushService
 *
 * Push-only frontend wrapper around POST /api/notifications/chat-push.
 * Unlike NotificationDispatchService, this does NOT insert a notifications
 * row — chat has its own real-time UI. Sends Web Push only, respecting
 * per-user push_enabled preference (enforced server-side).
 */

import { supabase } from '@/lib/supabase';

const API_BASE = '/api';

export interface ChatPushPayload {
  /** Supabase chat_channels.id — will resolve members server-side */
  channel_id?: string;
  /** Source document/emergency id — resolves the auto-created channel */
  document_id?: string;
  /** Optional list of email addresses to target directly */
  emails?: string[];
  /** Sender's supabase_uid — excluded from receiving their own notification */
  exclude_user_id?: string;
  title: string;
  body: string;
  /** Deeplink URL opened when user taps the notification */
  action_url?: string;
}

export const ChatPushService = {
  /**
   * Fire-and-forget chat push dispatch.
   * Callers should append `.catch(err => console.error(...))`.
   */
  async dispatch(payload: ChatPushPayload): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[ChatPush] No active session — skipping push');
        return;
      }

      const response = await fetch(`${API_BASE}/notifications/chat-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('[ChatPush] HTTP', response.status);
      }
    } catch (err) {
      console.error('[ChatPush] dispatch error:', err);
    }
  },
};
