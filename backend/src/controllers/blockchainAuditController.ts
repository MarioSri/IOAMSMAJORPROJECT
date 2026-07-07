// =============================================================================
// Blockchain Audit Controller
// Handles all /api/blockchain-audit/* route logic.
// =============================================================================

import { Request, Response } from 'express';
import {
  logWorkflowEvent,
  getAuditTrailForDocument,
  getQueueStats,
} from '../services/blockchainAuditService';
import { verifyEventChain, verifyRekorEntry, getRekorEntry } from '../services/rekorService';
import {
  runDailyMonitoringCheck,
  getLatestMonitoringResult,
  getMonitoringHistory,
} from '../services/rekorMonitorService';
import { getWorkerStatus } from '../services/rekorQueueWorker';
import type { AuthRequest } from '../types';
import type { LogEventRequest } from '../types/blockchainAudit';

// ---------------------------------------------------------------------------
// POST /api/blockchain-audit/log-event
// Called by the frontend after each workflow action (approve/reject/submit).
// Actor identity is extracted from the authenticated JWT — not trusted from body.
// ---------------------------------------------------------------------------
export async function logEvent(req: AuthRequest, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const body = req.body as LogEventRequest;
  const {
    documentId, documentTitle, documentDescription, action, workflowStep,
    comment, routingType, previousStep, nextStep,
    bypassReason, bypassedRole, authorizedBy,
  } = body;

  if (!documentId || !action) {
    res.status(400).json({ success: false, error: 'documentId and action are required' });
    return;
  }

  // Actor identity comes from the verified JWT, not the request body
  const actorEmail = user.email;
  const actorRole = (user as { role?: string }).role || 'authenticated';

  // Fire-and-forget — respond immediately, log asynchronously
  logWorkflowEvent({
    documentId,
    documentTitle,
    documentDescription,
    actorEmail,
    actorRole,
    action,
    workflowStep: workflowStep ?? null,
    comment: comment ?? null,
    routingType: routingType ?? null,
    previousStep: previousStep ?? null,
    nextStep: nextStep ?? null,
    bypassReason: bypassReason ?? null,
    bypassedRole: bypassedRole ?? null,
    authorizedBy: authorizedBy ?? null,
  }).catch(err => {
    console.warn('[BlockchainAuditCtrl] logWorkflowEvent error (non-fatal):', err);
  });

  res.status(202).json({ success: true, message: 'Event accepted for processing' });
}

// ---------------------------------------------------------------------------
// GET /api/blockchain-audit/trail/:documentId
// Returns the full ordered audit trail for a document.
// ---------------------------------------------------------------------------
export async function getAuditTrail(req: Request, res: Response): Promise<void> {
  const { documentId } = req.params;

  const entries = await getAuditTrailForDocument(documentId);

  // Compute chain integrity summary without making Rekor calls
  const pendingCount = entries.filter(e => e.verification_status === 'pending').length;
  const verifiedCount = entries.filter(e => e.verification_status === 'verified').length;
  const failedCount = entries.filter(e =>
    e.verification_status === 'failed' || e.verification_status === 'tampered'
  ).length;

  let chainIntegrity: 'valid' | 'broken' | 'pending' | 'unknown';
  if (entries.length === 0) chainIntegrity = 'unknown';
  else if (failedCount > 0) chainIntegrity = 'broken';
  else if (pendingCount > 0) chainIntegrity = 'pending';
  else chainIntegrity = 'valid';

  res.json({
    success: true,
    data: {
      documentId,
      entries,
      chainIntegrity,
      totalEvents: entries.length,
      verifiedEvents: verifiedCount,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/blockchain-audit/verify/:documentId
// Full chain verification + optional Rekor inclusion checks.
// ---------------------------------------------------------------------------
export async function verifyDocumentChain(req: Request, res: Response): Promise<void> {
  const { documentId } = req.params;

  const chainResult = await verifyEventChain(documentId);

  res.json({
    success: true,
    data: chainResult,
  });
}

// ---------------------------------------------------------------------------
// GET /api/blockchain-audit/entry/:rekorUuid
// Fetches a single Rekor entry directly from the transparency log.
// ---------------------------------------------------------------------------
export async function getRekorEntryById(req: Request, res: Response): Promise<void> {
  const { rekorUuid } = req.params;

  const [entry, verification] = await Promise.all([
    getRekorEntry(rekorUuid),
    verifyRekorEntry(rekorUuid),
  ]);

  if (!entry) {
    res.status(404).json({ success: false, error: 'Rekor entry not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      rekorUuid,
      entry,
      verification,
      rekorUrl: `https://rekor.sigstore.dev/api/v1/log/entries/${rekorUuid}`,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/blockchain-audit/queue/status
// Returns current queue statistics and worker health.
// ---------------------------------------------------------------------------
export async function getQueueStatus(req: Request, res: Response): Promise<void> {
  const [stats, workerStatus] = await Promise.all([
    getQueueStats(),
    Promise.resolve(getWorkerStatus()),
  ]);

  res.json({
    success: true,
    data: {
      queue: stats,
      worker: workerStatus,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/blockchain-audit/monitoring/latest
// Latest daily monitoring check result.
// ---------------------------------------------------------------------------
export async function getLatestMonitoring(req: Request, res: Response): Promise<void> {
  const result = await getLatestMonitoringResult();

  if (!result) {
    res.json({ success: true, data: null, message: 'No monitoring results yet' });
    return;
  }

  res.json({ success: true, data: result });
}

// ---------------------------------------------------------------------------
// GET /api/blockchain-audit/monitoring/history?days=30
// Monitoring history for the last N days.
// ---------------------------------------------------------------------------
export async function getMonitoringHistoryHandler(req: Request, res: Response): Promise<void> {
  const days = Math.min(
    parseInt((req.query.days as string) || '30', 10) || 30,
    365  // cap at 1 year
  );

  const history = await getMonitoringHistory(days);

  res.json({ success: true, data: history, days });
}

// ---------------------------------------------------------------------------
// POST /api/blockchain-audit/monitoring/run
// Manually trigger a monitoring check (admin use).
// ---------------------------------------------------------------------------
export async function triggerMonitoringCheck(req: Request, res: Response): Promise<void> {
  // Non-blocking — respond immediately
  runDailyMonitoringCheck().catch(err => {
    console.error('[BlockchainAuditCtrl] Manual monitoring check error:', err);
  });

  res.status(202).json({
    success: true,
    message: 'Monitoring check started. Check /api/blockchain-audit/monitoring/latest for results.',
  });
}
