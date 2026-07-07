import { Router } from 'express';
import { ResendController } from '../controllers/resendController';

const router = Router();

/**
 * Handle Resend Webhook POST messages
 */
router.post('/webhook', ResendController.handleWebhook);

export default router;
