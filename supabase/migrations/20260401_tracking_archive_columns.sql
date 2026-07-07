-- ============================================================
-- Migration: Add workflow archive/tracking visibility columns
-- Purpose   : Support smart Remove behavior on Track Documents
--             - archived workflows are hidden from tracking UI
--             - blockchain_audit_log rows are NEVER deleted
-- Run in    : Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add tracking_visible column (controls card visibility on Track Documents page)
--    DEFAULT true  → all existing rows remain visible (safe, backward compatible)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tracking_visible BOOLEAN NOT NULL DEFAULT true;

-- 2. Add workflow_state column (lifecycle state for the tracking card)
--    Values: 'active' | 'archived'
--    DEFAULT 'active' → all existing rows remain active (safe, backward compatible)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS workflow_state TEXT NOT NULL DEFAULT 'active'
  CHECK (workflow_state IN ('active', 'archived'));

-- 3. Index for efficient filtering of archived documents
--    The Track Documents query always adds .neq('tracking_visible', false)
CREATE INDEX IF NOT EXISTS idx_documents_tracking_visible
  ON public.documents (tracking_visible)
  WHERE tracking_visible = true;

-- 4. Index for workflow_state filtering (optional, for analytics/history queries)
CREATE INDEX IF NOT EXISTS idx_documents_workflow_state
  ON public.documents (workflow_state);

-- 5. Verify
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'documents'
  AND column_name IN ('tracking_visible', 'workflow_state')
ORDER BY column_name;
