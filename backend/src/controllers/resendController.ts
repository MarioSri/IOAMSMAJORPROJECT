import { Request, Response } from 'express';
import { Webhook } from 'svix';

type RawBodyRequest = Request & { rawBody?: Buffer };

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    id?: string;
  };
};

const statusMap: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
};

export class ResendController {
  /**
   * Handle Resend Webhook events.
   * Documentation: https://resend.com/docs/dashboard/webhooks
   */
  static async handleWebhook(req: RawBodyRequest, res: Response): Promise<void> {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET is not configured');
      res.status(503).json({ error: 'Webhook service unavailable' });
      return;
    }

    const svixId = req.header('svix-id');
    const svixTimestamp = req.header('svix-timestamp');
    const svixSignature = req.header('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature || !req.rawBody) {
      res.status(400).json({ error: 'Invalid webhook request' });
      return;
    }

    let payload: ResendEvent;
    try {
      const verified = new Webhook(webhookSecret).verify(req.rawBody.toString('utf8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
      payload = verified as ResendEvent;
    } catch (error) {
      console.warn('[Resend Webhook] Signature verification failed:', error instanceof Error ? error.message : 'unknown error');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const type = payload.type;
    const emailId = payload.data?.email_id ?? payload.data?.id;
    if (!type || !emailId) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    try {
      const status = statusMap[type];
      if (status) {
        // Persist the provider event and notification status here when the
        // notifications schema exposes a stable Resend message identifier.
        console.info(`[Resend Webhook] Email status event accepted: ${status}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('[Resend Webhook] Processing error:', error);
      res.status(500).json({ error: 'Internal processing error' });
    }
  }
}
