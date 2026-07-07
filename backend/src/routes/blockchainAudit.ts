// =============================================================================
// Blockchain Audit Routes
// Mounted at /api/blockchain-audit in server.ts
// =============================================================================

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  logEvent,
  getAuditTrail,
  verifyDocumentChain,
  getRekorEntryById,
  getQueueStatus,
  getLatestMonitoring,
  getMonitoringHistoryHandler,
  triggerMonitoringCheck,
} from '../controllers/blockchainAuditController';

const router = Router();

// All blockchain audit routes require authentication
router.use(authenticateToken as any);

// ---------------------------------------------------------------------------
// Event ingestion (called by frontend after workflow actions)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/blockchain-audit/log-event:
 *   post:
 *     summary: Log a workflow event to the blockchain audit trail
 *     description: |
 *       Accepts a document workflow event from authenticated frontend.
 *       Actor identity is taken from the JWT — not trusted from the request body.
 *       Responds immediately (202) and queues the event asynchronously for Rekor upload.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentId, action]
 *             properties:
 *               documentId:
 *                 type: string
 *               documentTitle:
 *                 type: string
 *               documentDescription:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [SUBMITTED, APPROVED, REJECTED, BYPASSED, SUBMITTED_WITH_BYPASS,
 *                        BYPASS_UPDATED, EMERGENCY_SUBMITTED, EMERGENCY_APPROVED,
 *                        EMERGENCY_REJECTED, EMERGENCY_ESCALATED, STATUS_CHANGED, SIGNED]
 *               workflowStep:
 *                 type: string
 *     responses:
 *       202:
 *         description: Event accepted for processing
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authenticated
 */
router.post('/log-event', logEvent as any);

// ---------------------------------------------------------------------------
// Audit trail queries
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/blockchain-audit/trail/{documentId}:
 *   get:
 *     summary: Get full blockchain audit trail for a document
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ordered list of audit events with chain integrity status
 */
router.get('/trail/:documentId', getAuditTrail as any);

/**
 * @swagger
 * /api/blockchain-audit/verify/{documentId}:
 *   get:
 *     summary: Verify the hash chain integrity for a document's audit trail
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chain verification result including any broken links
 */
router.get('/verify/:documentId', verifyDocumentChain as any);

/**
 * @swagger
 * /api/blockchain-audit/entry/{rekorUuid}:
 *   get:
 *     summary: Fetch a Rekor transparency log entry directly
 *     parameters:
 *       - in: path
 *         name: rekorUuid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rekor entry data and verification status
 *       404:
 *         description: Entry not found
 */
router.get('/entry/:rekorUuid', getRekorEntryById as any);

// ---------------------------------------------------------------------------
// Worker and queue status
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/blockchain-audit/queue/status:
 *   get:
 *     summary: Get queue statistics and worker health
 *     responses:
 *       200:
 *         description: Queue counts by status and worker circuit breaker state
 */
router.get('/queue/status', getQueueStatus as any);

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/blockchain-audit/monitoring/latest:
 *   get:
 *     summary: Get the latest Rekor monitoring check result
 *     responses:
 *       200:
 *         description: Most recent daily monitoring result
 */
router.get('/monitoring/latest', getLatestMonitoring as any);

/**
 * @swagger
 * /api/blockchain-audit/monitoring/history:
 *   get:
 *     summary: Get monitoring history
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Array of monitoring results for the specified period
 */
router.get('/monitoring/history', getMonitoringHistoryHandler as any);

/**
 * @swagger
 * /api/blockchain-audit/monitoring/run:
 *   post:
 *     summary: Manually trigger a Rekor monitoring check
 *     description: Starts the check asynchronously. Poll /monitoring/latest for results.
 *     responses:
 *       202:
 *         description: Monitoring check started
 */
router.post('/monitoring/run', triggerMonitoringCheck as any);

export default router;
