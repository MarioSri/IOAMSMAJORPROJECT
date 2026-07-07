-- ============================================================================
-- Migration: 20260305_add_escalation_columns.sql
-- Purpose:   Add escalation tracking columns to workflow_steps and
--            document_workflows so EscalationService can persist state
--            to Supabase instead of only holding it in-memory.
-- ============================================================================

-- ── workflow_steps: per-step escalation tracking ─────────────────────────────

ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT false;

ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;

ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- ── document_workflows: workflow-level escalation metadata ───────────────────

ALTER TABLE document_workflows
  ADD COLUMN IF NOT EXISTS last_escalation_time TIMESTAMPTZ;

ALTER TABLE document_workflows
  ADD COLUMN IF NOT EXISTS escalated_to_authority TEXT;

-- ── documents: file_assignments column (already exists in base migration,
--    but ensure it exists for older deployments that may have dropped it) ──────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_assignments JSONB DEFAULT '{}'::jsonb;
