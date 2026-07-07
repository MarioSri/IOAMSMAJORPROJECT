-- =====================================================
-- Fix: Missing INSERT RLS Policy on workflow_steps
-- Date: 2026-03-02
-- Purpose:
--   The _v2 RLS policies applied via Supabase Dashboard
--   only included SELECT and UPDATE, but omitted INSERT.
--   This caused all workflow_steps inserts to fail silently,
--   resulting in 0 approval cards for all recipients.
-- =====================================================

-- Add the missing INSERT policy (idempotent)
DROP POLICY IF EXISTS "workflow_steps_insert_v2" ON public.workflow_steps;
CREATE POLICY "workflow_steps_insert_v2"
ON public.workflow_steps
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Backfill existing orphaned documents that have workflows but no steps
INSERT INTO workflow_steps (workflow_id, name, step_order, assignee_id, assignee, status)
SELECT 
  dw.id AS workflow_id,
  rr.name || ' Review' AS name,
  (idx - 1)::integer AS step_order,
  rr.id::text AS assignee_id,
  rr.name AS assignee,
  CASE WHEN idx = 1 THEN 'current' ELSE 'pending' END AS status
FROM document_workflows dw
JOIN documents d ON d.id = dw.document_id
CROSS JOIN LATERAL unnest(d.recipient_ids) WITH ORDINALITY AS t(recipient_uuid, idx)
JOIN role_recipients rr ON rr.id = t.recipient_uuid::uuid
WHERE d.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = dw.id
  );

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
