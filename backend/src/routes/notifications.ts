import { Router, Request, Response } from 'express';
import {
  dispatchNotification,
  dispatchChatPush,
  sendNotification,
  getUserNotifications,
  updateNotificationPreferences,
  registerDevice,
  unregisterDevice,
  resendNotification,
  getVapidPublicKey,
  syncDeviceEmail,
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Central dispatch (all triggers call this)
router.post('/dispatch', authenticateToken, dispatchNotification);

// Chat push-only dispatch (no notifications row, no email)
router.post('/chat-push', authenticateToken, dispatchChatPush);

// VAPID public key for Web Push subscription (no auth needed — public key)
router.get('/vapid-public-key', getVapidPublicKey);

// Device registration for Web Push
router.post('/devices/register', authenticateToken, registerDevice);
router.delete('/devices/:token', authenticateToken, unregisterDevice);

// Sync device emails when user changes preferred notification email
router.post('/devices/sync-email', authenticateToken, syncDeviceEmail);

// Resend a failed email notification
router.post('/:id/resend', authenticateToken, resendNotification);

// Legacy / existing routes (kept for backward compatibility)
router.post('/send', authenticateToken, sendNotification);
router.get('/', authenticateToken, getUserNotifications);
router.put('/preferences', authenticateToken, updateNotificationPreferences);

export default router;
