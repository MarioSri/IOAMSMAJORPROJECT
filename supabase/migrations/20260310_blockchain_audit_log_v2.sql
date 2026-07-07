-- =============================================================================
-- Blockchain Audit Log v2 -- Routing context + bypass detail columns
-- All new columns are nullable -- safe against existing rows.
-- Run AFTER 20260310_blockchain_audit_log.sql
-- =============================================================================

ALTER TABLE public.blockchain_audit_log
  ADD COLUMN IF NOT EXISTS routing_type  TEXT,
  ADD COLUMN IF NOT EXISTS previous_step TEXT,
  ADD COLUMN IF NOT EXISTS next_step     TEXT,
  ADD COLUMN IF NOT EXISTS comment       TEXT,
  ADD COLUMN IF NOT EXISTS bypass_reason TEXT,
  ADD COLUMN IF NOT EXISTS bypassed_role TEXT,
  ADD COLUMN IF NOT EXISTS authorized_by TEXT;

CREATE INDEX IF NOT EXISTS idx_blockchain_audit_routing_type
  ON public.blockchain_audit_log (routing_type, timestamp DESC)
  WHERE routing_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blockchain_audit_bypass_actions
  ON public.blockchain_audit_log (action, timestamp DESC)
  WHERE action IN ('BYPASSED', 'BYPASS_APPROVED', 'BYPASS_REJECTED', 'EMERGENCY_BYPASSED');
