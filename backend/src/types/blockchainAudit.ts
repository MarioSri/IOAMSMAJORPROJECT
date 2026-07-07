// =============================================================================
// Blockchain Audit Log — TypeScript Types (Backend)
// =============================================================================

// ---------------------------------------------------------------------------
// Enum: All possible document workflow actions that get logged
// ---------------------------------------------------------------------------
export enum BlockchainEventAction {
  // Document lifecycle
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

  // General
  STATUS_CHANGED = 'STATUS_CHANGED',
  SIGNED = 'SIGNED',
}

// ---------------------------------------------------------------------------
// Event payload — what is hashed and signed
// ---------------------------------------------------------------------------
export interface BlockchainEventPayload {
  document_id: string;
  document_hash: string;         // SHA-256 of document metadata
  actor_email: string;           // @hitam.org institutional email
  actor_role: string;            // Role from role_recipients (HOD, REGISTRAR, etc.)
  action: BlockchainEventAction | string;
  workflow_step: string | null;
  timestamp: string;             // ISO 8601
  previous_event_hash: string | null;  // NULL for first event; chain link for subsequent

  // Routing context (optional — populated where known)
  routing_type?: string | null;    // SEQUENTIAL, PARALLEL, BYPASS, BIDIRECTIONAL
  previous_step?: string | null;   // Workflow step name before this event
  next_step?: string | null;       // Workflow step name after this event

  // Action context
  comment?: string | null;         // Approval/rejection comment from actor
  bypass_reason?: string | null;   // Why bypass was used
  bypassed_role?: string | null;   // Role/name of bypassed participant
  authorized_by?: string | null;   // Who authorised the bypass
}

// ---------------------------------------------------------------------------
// Database row in blockchain_audit_log
// ---------------------------------------------------------------------------
export interface BlockchainAuditLogEntry {
  id: string;
  document_id: string;
  document_hash: string | null;
  original_document_hash: string | null;
  actor_id_hash: string | null;  // SHA-256(actor_email) — for Phase 2 privacy
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

// ---------------------------------------------------------------------------
// Database row in rekor_queue
// ---------------------------------------------------------------------------
export interface RekorQueueEntry {
  id: string;
  document_id: string;
  event_data: BlockchainEventPayload;
  event_hash: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retry_count: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

// ---------------------------------------------------------------------------
// Rekor API response types
// ---------------------------------------------------------------------------
export interface RekorUploadResult {
  uuid: string;
  logIndex: number;
  integratedTime: number;  // Unix timestamp
  body: string;            // Base64-encoded bundle
}

export interface RekorVerificationResult {
  uuid: string;
  exists: boolean;
  valid: boolean;
  integratedTime: number | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Chain integrity verification
// ---------------------------------------------------------------------------
export interface ChainVerificationResult {
  documentId: string;
  valid: boolean;
  eventCount: number;
  brokenAt: number | null;     // 0-based index of first broken link, null if valid
  missingRekorEntries: string[]; // event_hashes that have no rekor_uuid yet
  tamperDetected: boolean;
  details: ChainLinkStatus[];
}

export interface ChainLinkStatus {
  index: number;
  eventHash: string;
  previousEventHash: string | null;
  action: string;
  actor: string;
  timestamp: string;
  rekorUuid: string | null;
  linkValid: boolean;          // previous_event_hash matches prior event_hash
  rekorVerified: boolean | null;  // null if not yet checked (rekor_uuid pending)
}

// ---------------------------------------------------------------------------
// Queue worker statistics
// ---------------------------------------------------------------------------
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  oldestPendingAge: number | null;  // seconds
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------
export interface MonitoringResult {
  id: string;
  check_date: string;
  log_consistency_status: string | null;
  tree_head_valid: boolean | null;
  unexpected_entries_found: number;
  issues_detected: string[];
  monitoring_duration_ms: number | null;
  rekor_tree_size: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API request/response shapes
// ---------------------------------------------------------------------------
export interface LogEventRequest {
  documentId: string;
  documentTitle?: string;    // Used for hashing document metadata
  documentDescription?: string;
  action: BlockchainEventAction | string;
  workflowStep?: string | null;
  actorId?: string;            // Supabase UID (falls back to JWT sub)
  comment?: string | null;
  routingType?: string | null;
  previousStep?: string | null;
  nextStep?: string | null;
  bypassReason?: string | null;
  bypassedRole?: string | null;
  authorizedBy?: string | null;
}

export interface AuditTrailResponse {
  documentId: string;
  entries: BlockchainAuditLogEntry[];
  chainIntegrity: 'valid' | 'broken' | 'pending' | 'unknown';
  totalEvents: number;
  verifiedEvents: number;
}
