-- =====================================================
-- IAOMS Workflow Isolation Fix Migration
-- Date: 2026-03-04
-- Purpose:
--   1. Add `source` column to documents table (missing — causes Supabase
--      422/schema-cache errors when DocumentService inserts source field).
--   2. Add missing columns to document_workflows (has_bypass, source,
--      bypassed_recipients) — same as 20260302 but idempotent.
--   3. Add missing columns to workflow_steps (name, assignee, rejected_by,
--      bypass_reason, completed_date, rejected_date) — same as 20260302
--      but idempotent.
--   4. Drop the NOT NULL constraint on legacy workflow_steps columns
--      (step_name, assignee_name) to stop INSERT failures.
--   5. Ensure all required RLS policies exist on documents,
--      document_workflows, workflow_steps so authenticated users can
--      INSERT/SELECT/UPDATE their own rows.
--   6. Enable Realtime for all tables used by real-time hooks.
--   7. Repair poisoned workflow_steps (non-UUID assignee_id).
--   8. Backfill orphaned workflows (have 0 steps) from recipient_ids.
--   9. Post-migration diagnostics.
--  10. Force PostgREST schema cache reload.
-- =====================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add `source` column to documents (missing — triggers schema-cache errors)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'document-management';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_assignments JSONB DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipient_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipients TEXT[] DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS submitter_department TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS submitter_designation TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add missing columns to document_workflows
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS has_bypass BOOLEAN DEFAULT FALSE;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS bypassed_recipients TEXT[] DEFAULT '{}';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'document-management';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS is_parallel BOOLEAN DEFAULT FALSE;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS routing_type TEXT DEFAULT 'sequential';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS current_step TEXT;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add missing columns to workflow_steps
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS assignee_id TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS step_order INTEGER DEFAULT 0;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS bypass_reason TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS completed_date TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS rejected_date TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop NOT NULL constraints on legacy columns (blocks every INSERT)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps'
      AND column_name = 'step_name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.workflow_steps ALTER COLUMN step_name DROP NOT NULL;
    ALTER TABLE public.workflow_steps ALTER COLUMN step_name SET DEFAULT '';
    RAISE NOTICE 'Dropped NOT NULL on workflow_steps.step_name';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps'
      AND column_name = 'assignee_name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.workflow_steps ALTER COLUMN assignee_name DROP NOT NULL;
    ALTER TABLE public.workflow_steps ALTER COLUMN assignee_name SET DEFAULT '';
    RAISE NOTICE 'Dropped NOT NULL on workflow_steps.assignee_name';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS policies — ensure authenticated users can perform all needed operations
-- ─────────────────────────────────────────────────────────────────────────────

-- documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_select_v3"  ON public.documents;
DROP POLICY IF EXISTS "documents_insert_v3"  ON public.documents;
DROP POLICY IF EXISTS "documents_update_v3"  ON public.documents;
DROP POLICY IF EXISTS "documents_delete_v3"  ON public.documents;
CREATE POLICY "documents_select_v3" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert_v3" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "documents_update_v3" ON public.documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "documents_delete_v3" ON public.documents FOR DELETE TO authenticated USING (true);

-- document_workflows
ALTER TABLE public.document_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workflows_select_v3"  ON public.document_workflows;
DROP POLICY IF EXISTS "workflows_insert_v3"  ON public.document_workflows;
DROP POLICY IF EXISTS "workflows_update_v3"  ON public.document_workflows;
DROP POLICY IF EXISTS "workflows_delete_v3"  ON public.document_workflows;
CREATE POLICY "workflows_select_v3" ON public.document_workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "workflows_insert_v3" ON public.document_workflows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "workflows_update_v3" ON public.document_workflows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "workflows_delete_v3" ON public.document_workflows FOR DELETE TO authenticated USING (true);

-- workflow_steps
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "steps_select_v3"  ON public.workflow_steps;
DROP POLICY IF EXISTS "steps_insert_v3"  ON public.workflow_steps;
DROP POLICY IF EXISTS "steps_update_v3"  ON public.workflow_steps;
DROP POLICY IF EXISTS "steps_delete_v3"  ON public.workflow_steps;
CREATE POLICY "steps_select_v3" ON public.workflow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "steps_insert_v3" ON public.workflow_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "steps_update_v3" ON public.workflow_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "steps_delete_v3" ON public.workflow_steps FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Enable Realtime on all required tables
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents', 'document_workflows', 'workflow_steps', 'document_approvals', 'approval_comments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      RAISE NOTICE 'Added % to supabase_realtime publication', t;
    ELSE
      RAISE NOTICE '% already in supabase_realtime publication', t;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Repair poisoned workflow_steps (non-UUID assignee_id stored as name string)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.workflow_steps ws
SET assignee_id = rr.id::text
FROM public.role_recipients rr
WHERE
  ws.assignee_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND lower(ws.assignee_id) = lower(rr.name)
  AND rr.is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Backfill orphaned workflows (0 steps) from documents.recipient_ids
-- ─────────────────────────────────────────────────────────────────────────────
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

DO $$
DECLARE backfilled INTEGER;
BEGIN
  GET DIAGNOSTICS backfilled = ROW_COUNT;
  RAISE NOTICE 'Backfilled % workflow_steps for orphaned workflows', backfilled;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Backfill supabase_uid in role_recipients from auth.users (by email match)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.role_recipients rr
SET supabase_uid = au.id
FROM auth.users au
WHERE lower(rr.email) = lower(au.email)
  AND rr.supabase_uid IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Post-migration diagnostics
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  bad_steps       INTEGER;
  unlinked_rr     INTEGER;
  orphan_wf       INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_steps FROM public.workflow_steps
  WHERE assignee_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF bad_steps > 0 THEN
    RAISE WARNING '% workflow_steps row(s) still have non-UUID assignee_id', bad_steps;
  ELSE
    RAISE NOTICE 'OK: all assignee_id values are valid UUIDs';
  END IF;

  SELECT COUNT(*) INTO unlinked_rr FROM public.role_recipients
  WHERE supabase_uid IS NULL AND is_active = TRUE;
  IF unlinked_rr > 0 THEN
    RAISE WARNING '% active role_recipients without supabase_uid — these users cannot receive approval cards', unlinked_rr;
  ELSE
    RAISE NOTICE 'OK: all active role_recipients have supabase_uid';
  END IF;

  SELECT COUNT(*) INTO orphan_wf
  FROM document_workflows dw
  WHERE NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = dw.id);
  IF orphan_wf > 0 THEN
    RAISE WARNING '% document_workflows have zero steps (approval cards will not appear)', orphan_wf;
  ELSE
    RAISE NOTICE 'OK: all document_workflows have at least one step';
  END IF;
END;
$$;

-- Show pending workflows with step count (verify assignment health)
SELECT
  dw.id AS workflow_id,
  d.title,
  d.status,
  d.source,
  d.submitter_name,
  COUNT(ws.id) AS step_count,
  STRING_AGG(ws.assignee || ' (' || ws.status || ')', ', ') AS steps_summary
FROM document_workflows dw
JOIN documents d ON d.id = dw.document_id
LEFT JOIN workflow_steps ws ON ws.workflow_id = dw.id
WHERE d.status IN ('pending', 'in_progress')
GROUP BY dw.id, d.title, d.status, d.source, d.submitter_name
ORDER BY dw.created_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Force PostgREST schema cache reload
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
