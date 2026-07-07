// =============================================================================
// Blockchain Audit Log — TypeScript Types (Frontend)
// Subset of backend types used for API response consumption only.
// =============================================================================

export enum BlockchainEventAction {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BYPASSED = 'BYPASSED',

  // Document management extras
  UPDATED = 'UPDATED',
  WITHDRAWN = 'WITHDRAWN',
  REASSIGNED = 'REASSIGNED',

  // Bypass workflow
  SUBMITTED_WITH_BYPASS = 'SUBMITTED_WITH_BYPASS',
  BYPASS_UPDATED = 'BYPASS_UPDATED',
  BYPASS_APPROVED = 'BYPASS_APPROVED',
  BYPASS_REJECTED = 'BYPASS_REJECTED',

  // Emergency workflow
  EMERGENCY_SUBMITTED = 'EMERGENCY_SUBMITTED',
  EMERGENCY_APPROVED = 'EMERGENCY_APPROVED',
  EMERGENCY_REJECTED = 'EMERGENCY_REJECTED',
  EMERGENCY_ESCALATED = 'EMERGENCY_ESCALATED',
  EMERGENCY_BYPASSED = 'EMERGENCY_BYPASSED',

  // Bi-directional routing
  RETURNED = 'RETURNED',
  RESUBMITTED = 'RESUBMITTED',

  STATUS_CHANGED = 'STATUS_CHANGED',
  SIGNED = 'SIGNED',
}

export interface BlockchainAuditLogEntry {
  id: string;
  document_id: string;
  document_hash: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  workflow_step: string | null;
  timestamp: string;
  event_hash: string;
  previous_event_hash: string | null;
  rekor_uuid: string | null;
  rekor_log_index: number | null;
  verification_status: 'pending' | 'verified' | 'failed' | 'tampered';
  last_verified_at: string | null;
  created_at: string;
}

export interface AuditTrailResponse {
  documentId: string;
  entries: BlockchainAuditLogEntry[];
  chainIntegrity: 'valid' | 'broken' | 'pending' | 'unknown';
  totalEvents: number;
  verifiedEvents: number;
}

export interface ChainLinkStatus {
  index: number;
  eventHash: string;
  previousEventHash: string | null;
  action: string;
  actor: string;
  timestamp: string;
  rekorUuid: string | null;
  linkValid: boolean;
  rekorVerified: boolean | null;
}

export interface ChainVerificationResult {
  documentId: string;
  valid: boolean;
  eventCount: number;
  brokenAt: number | null;
  missingRekorEntries: string[];
  tamperDetected: boolean;
  details: ChainLinkStatus[];
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  oldestPendingAge: number | null;
}

export interface LogEventRequest {
  documentId: string;
  documentTitle?: string;
  documentDescription?: string;
  action: BlockchainEventAction | string;
  workflowStep?: string | null;
  actorId?: string;
  comment?: string | null;
  routingType?: string | null;
  previousStep?: string | null;
  nextStep?: string | null;
  bypassReason?: string | null;
  bypassedRole?: string | null;
  authorizedBy?: string | null;
}
