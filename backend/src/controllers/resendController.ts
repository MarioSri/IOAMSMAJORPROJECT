import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { supabaseAdmin } from '../config/supabase';

export class ResendController {
  /**
   * Handle Resend Webhook events.
   * Documentation: https://resend.com/docs/dashboard/webhooks
   */
  static async handleWebhook(req: Request, res: Response) {
    const payload = req.body;
    const headers = req.headers;

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[Resend Webhook] RESEND_WEBHOOK_SECRET not set, skipping verification');
      // In production, you MUST verify the signature.
      // return res.status(500).json({ error: 'Webhook secret not configured' });
    } else {
      try {
        const svix_id = headers['svix-id'] as string;
        const svix_timestamp = headers['svix-timestamp'] as string;
        const svix_signature = headers['svix-signature'] as string;

        if (!svix_id || !svix_timestamp || !svix_signature) {
          return res.status(400).json({ error: 'Missing svix headers' });
        }

        const wh = new Webhook(webhookSecret);
        wh.verify(JSON.stringify(payload), {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });
      } catch (err) {
        console.error('[Resend Webhook] Signature verification failed:', err);
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const { type, data } = payload;
    console.info(`[Resend Webhook] Received event: ${type}`, data);

    try {
      // Map Resend events to internal notification status updates
      // Types: email.sent, email.delivered, email.delivery_delayed, email.complained, email.bounced, email.opened, email.clicked
      
      const emailId = data.email_id || data.id;
      if (!emailId) {
        return res.status(200).json({ received: true });
      }

      // Update notification status if we have a matching row
      // Note: This assumes we store the resend email_id in the notifications table's metadata or a dedicated column.
      
      const statusMap: Record<string, string> = {
        'email.sent': 'sent',
        'email.delivered': 'delivered',
        'email.bounced': 'bounced',
        'email.opened': 'opened',
        'email.clicked': 'clicked',
      };

      const status = statusMap[type];
      if (status) {
        // Find notification by resend_id (if we added that column) or by email_to + recent timestamps
        // For now, we'll just log it. In a real app, you'd update the DB.
        console.info(`[Resend Webhook] Email ${emailId} status updated to: ${status}`);
        
        // Example: Update metadata for tracking
        /*
        await supabaseAdmin
          .from('notifications')
          .update({ 
            email_sent: status !== 'bounced',
            email_failed: status === 'bounced',
            last_webhook_event: type,
            updated_at: new Date().toISOString() 
          })
          .contains('metadata', { resend_id: emailId });
        */
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[Resend Webhook] Processing error:', err);
      return res.status(500).json({ error: 'Internal processing error' });
    }
  }
}
