import { supabase } from '@/lib/supabase';

export interface NotificationPayload {
  type: 'approval' | 'rejection' | 'document' | 'emergency' | 'bypass';
  documentTitle: string;
  submitter: string;
  priority?: string;
  approvalCenterLink?: string;
  recipientName?: string;
  message?: string;
}

/**
 * ExternalNotificationDispatcher
 *
 * Static utility class for sending in-app notifications to recipients
 * via the Supabase `notifications` table.
 *
 * Used by WorkflowConfiguration (Approval Chain Bypass) and EmergencyWorkflowInterface
 * as the final step of document submission background tasks.
 *
 * All methods are fire-and-forget safe — errors are logged but never thrown.
 */
export class ExternalNotificationDispatcher {
  /**
   * Send an in-app notification to a single recipient.
   * Resolves the recipient's user record from `profiles` then inserts
   * into `notifications`. Returns silently on failure.
   */
  static async notifyRecipient(
    recipientId: string,
    recipientName: string,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      const title = ExternalNotificationDispatcher.buildTitle(payload);
      const message = payload.message ?? ExternalNotificationDispatcher.buildMessage(payload);

      const { error } = await supabase.from('notifications').insert({
        user_id: recipientId,
        title,
        message,
        type: payload.type,
        priority: payload.priority ?? 'normal',
        metadata: {
          documentTitle: payload.documentTitle,
          submitter: payload.submitter,
          approvalCenterLink: payload.approvalCenterLink ?? null,
          recipientName: recipientName,
        },
        read: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        // Non-fatal — notification failure must not block the document workflow
        console.warn(
          `[ExternalNotificationDispatcher] ⚠️ Failed to notify ${recipientName} (${recipientId}):`,
          error.message
        );
        return;
      }

      console.log(
        `[ExternalNotificationDispatcher] ✅ Notification sent to ${recipientName} (${recipientId})`
      );
    } catch (err) {
      console.error('[ExternalNotificationDispatcher] ❌ Unexpected error:', err);
    }
  }

  /**
   * Broadcast a notification to multiple recipients in parallel.
   * Individual failures do not abort the batch.
   */
  static async notifyRecipients(
    recipients: Array<{ id: string; name: string }>,
    payload: NotificationPayload
  ): Promise<void> {
    await Promise.allSettled(
      recipients.map(({ id, name }) =>
        ExternalNotificationDispatcher.notifyRecipient(id, name, payload)
      )
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private static buildTitle(payload: NotificationPayload): string {
    switch (payload.type) {
      case 'approval':
        return `📋 Approval Required: ${payload.documentTitle}`;
      case 'rejection':
        return `❌ Document Rejected: ${payload.documentTitle}`;
      case 'emergency':
        return `🚨 Emergency Document: ${payload.documentTitle}`;
      case 'bypass':
        return `⚡ Bypass Approval: ${payload.documentTitle}`;
      default:
        return `📄 Document: ${payload.documentTitle}`;
    }
  }

  private static buildMessage(payload: NotificationPayload): string {
    const priority = payload.priority ? ` [${payload.priority.toUpperCase()}]` : '';
    const message = `${payload.submitter} submitted "${payload.documentTitle}"${priority} for your review.`;
    return payload.approvalCenterLink ? `${message} View it in the Approval Center.` : message;
  }
}
