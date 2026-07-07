/**
 * Workflow Notification Routes
 * 
 * Template-based notification endpoints for all major workflows.
 * These routes provide a clean API for triggering context-aware push notifications.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  notifyEmergency,
  notifyDocumentApproved,
  notifyReviewNeeded,
  notifyDocumentRejected,
  notifyLiveMeetRequest,
  notifyLiveMeetAccepted,
  notifyLiveMeetDeclined,
  notifyDirectMessage,
  notifyChannelMessage,
  notifyAttachment,
} from '../controllers/workflowNotificationController';

const router = Router();

// ── Emergency Notifications ──────────────────────────────────────────────────
router.post('/emergency', authenticateToken, notifyEmergency);

// ── Approval Workflow Notifications ──────────────────────────────────────────
router.post('/document-approved', authenticateToken, notifyDocumentApproved);
router.post('/review-needed', authenticateToken, notifyReviewNeeded);
router.post('/document-rejected', authenticateToken, notifyDocumentRejected);

// ── LiveMeet+ Notifications ───────────────────────────────────────────────────
router.post('/livemeet-request', authenticateToken, notifyLiveMeetRequest);
router.post('/livemeet-accepted', authenticateToken, notifyLiveMeetAccepted);
router.post('/livemeet-declined', authenticateToken, notifyLiveMeetDeclined);

// ── Chat Notifications ────────────────────────────────────────────────────────
router.post('/direct-message', authenticateToken, notifyDirectMessage);
router.post('/channel-message', authenticateToken, notifyChannelMessage);
router.post('/attachment', authenticateToken, notifyAttachment);

export default router;
