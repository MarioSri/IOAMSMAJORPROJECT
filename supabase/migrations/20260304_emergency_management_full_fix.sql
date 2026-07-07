-- =============================================================================
-- IAOMS Emergency Management — Full Fix Migration
-- Date: 2026-03-04
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is fully idempotent: safe to run multiple times.
--
-- Fixes addressed:
--   1.  Add missing columns to `documents` (source, recipient_ids, is_emergency,
--       submitter_department, submitter_designation, files, updated_at) that
--       caused silent 422 / schema-cache errors on unified-doc inserts (Step B).
--   2.  Add missing columns to `document_workflows` (source, has_bypass,
--       bypassed_recipients, is_parallel, routing_type, progress, current_step).
--   3.  Add missing columns to `workflow_steps` (name, assignee, assignee_id,
--       step_order, rejected_by, bypass_reason, completed_date, rejected_date).
--   4.  Drop NOT NULL on legacy `step_name` / `assignee_name` columns that
--       block every workflow_steps INSERT with PostgREST 400.
--   5.  Ensure full RLS (SELECT / INSERT / UPDATE / DELETE) on all three
--       workflow tables so authenticated users can write their own rows.
--   6.  Add missing INSERT policy on workflow_steps (was often the sole cause
--       of 0 approval cards for every recipient).
--   7.  Enable Supabase Realtime publication on all workflow + emergency tables.
--   8.  Backfill role_recipients.supabase_uid from auth.users by email so
--       ApprovalService recipient resolution works even if onboarding missed it.
--   9.  Repair existing workflow_steps rows where assignee_id stored a display
--       name string instead of a role_recipients UUID.
--  10.  Backfill workflow_steps for orphaned document_workflows (0 steps).
--  11.  Force PostgREST schema-cache reload.
--  12.  Fix create_document_notification() trigger that crashes on INSERT
--       into documents because notifications.user_id is UUID but
--       documents.submitter_id is TEXT (error 42804).
--  13.  Force PostgREST schema-cache reload.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. documents — add missing columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source               TEXT     DEFAULT 'document-management';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS files                JSONB    DEFAULT '[]';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_assignments     JSONB    DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipient_ids        TEXT[]   DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipients           TEXT[]   DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS submitter_department TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS submitter_designation TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_emergency         BOOLEAN  DEFAULT FALSE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. document_workflows — add missing columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS source              TEXT    DEFAULT 'document-management';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS has_bypass          BOOLEAN DEFAULT FALSE;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS bypassed_recipients TEXT[]  DEFAULT '{}';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS is_parallel         BOOLEAN DEFAULT FALSE;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS routing_type        TEXT    DEFAULT 'sequential';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS progress            INTEGER DEFAULT 0;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS current_step        TEXT;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. workflow_steps — add missing columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS assignee       TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS assignee_id    TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS step_order     INTEGER DEFAULT 0;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS status         TEXT    DEFAULT 'pending';
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS rejected_by    TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS bypass_reason  TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS completed_date TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS rejected_date  TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop NOT NULL on legacy columns that block every workflow_steps INSERT
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

-- Backfill name / assignee from legacy columns where new columns are still NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps'
      AND column_name = 'step_name'
  ) THEN
    UPDATE public.workflow_steps
       SET name = step_name
     WHERE name IS NULL AND step_name IS NOT NULL AND step_name <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps'
      AND column_name = 'assignee_name'
  ) THEN
    UPDATE public.workflow_steps
       SET assignee = assignee_name
     WHERE assignee IS NULL AND assignee_name IS NOT NULL AND assignee_name <> '';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 & 6. RLS — full CRUD for authenticated users on all workflow tables
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
DROP POLICY IF EXISTS "steps_select_v3"         ON public.workflow_steps;
DROP POLICY IF EXISTS "steps_insert_v3"          ON public.workflow_steps;
DROP POLICY IF EXISTS "steps_update_v3"          ON public.workflow_steps;
DROP POLICY IF EXISTS "steps_delete_v3"          ON public.workflow_steps;
DROP POLICY IF EXISTS "workflow_steps_insert_v2" ON public.workflow_steps;
CREATE POLICY "steps_select_v3" ON public.workflow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "steps_insert_v3" ON public.workflow_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "steps_update_v3" ON public.workflow_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "steps_delete_v3" ON public.workflow_steps FOR DELETE TO authenticated USING (true);

-- emergency_documents (submitter + recipients must both be able to read)
ALTER TABLE public.emergency_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emergency_docs_select_v3" ON public.emergency_documents;
DROP POLICY IF EXISTS "emergency_docs_insert_v3" ON public.emergency_documents;
DROP POLICY IF EXISTS "emergency_docs_update_v3" ON public.emergency_documents;
CREATE POLICY "emergency_docs_select_v3" ON public.emergency_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "emergency_docs_insert_v3" ON public.emergency_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "emergency_docs_update_v3" ON public.emergency_documents FOR UPDATE TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Enable Realtime on all tables used by real-time hooks
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_publication TEXT := 'supabase_realtime';
  v_tables      TEXT[] := ARRAY[
    'documents',
    'document_workflows',
    'workflow_steps',
    'emergency_documents',
    'emergency_notifications',
    'approval_comments'
  ];
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER PUBLICATION %I ADD TABLE public.%I',
          v_publication, v_table
        );
        RAISE NOTICE 'Added % to publication %', v_table, v_publication;
      EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE '% already in publication %.', v_table, v_publication;
      END;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Backfill role_recipients.supabase_uid from auth.users by email
--    (Fixes "user.recipientId undefined" → approval cards never load guard)
-- ─────────────────────────────────────────────────────────────────────────────
-- First ensure the column exists
ALTER TABLE public.role_recipients ADD COLUMN IF NOT EXISTS supabase_uid TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_recipients'
      AND column_name = 'supabase_uid'
  ) THEN
    UPDATE public.role_recipients rr
       SET supabase_uid = au.id
      FROM auth.users au
     WHERE LOWER(au.email) = LOWER(rr.email)
       AND rr.supabase_uid IS NULL;

    RAISE NOTICE 'Backfilled supabase_uid for % role_recipients rows.',
      (SELECT COUNT(*) FROM public.role_recipients WHERE supabase_uid IS NOT NULL);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Repair workflow_steps where assignee_id is a display name (not a UUID)
--    These rows can never match the UUID-based recipient filter in ApprovalService.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps'
      AND column_name = 'assignee_id'
  ) THEN
    -- Replace name-string assignee_id with the matching role_recipients UUID
    UPDATE public.workflow_steps ws
       SET assignee_id = rr.id::text
      FROM public.role_recipients rr
     WHERE ws.assignee_id = rr.name            -- name match (poisoned rows)
       AND ws.assignee_id !~ '^[0-9a-f\-]{36}$'; -- not already a UUID

    -- Log how many non-UUID assignee_id rows remain (should be 0 after fix)
    RAISE NOTICE '% workflow_steps rows still have non-UUID assignee_id after repair.',
      (SELECT COUNT(*) FROM public.workflow_steps
        WHERE assignee_id IS NOT NULL AND assignee_id !~ '^[0-9a-f\-]{36}$');
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Backfill workflow_steps for orphaned document_workflows (0 steps)
--     Targets both emergency-management and document-management sources.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflow_steps (workflow_id, name, step_order, assignee_id, assignee, status)
SELECT
  dw.id                                  AS workflow_id,
  rr.name || ' Review'                   AS name,
  (t.idx - 1)::integer                   AS step_order,
  rr.id::text                            AS assignee_id,
  rr.name                                AS assignee,
  CASE
    WHEN dw.routing_type IN ('parallel', 'bidirectional') THEN 'current'
    WHEN t.idx = 1 THEN 'current'
    ELSE 'pending'
  END                                    AS status
FROM public.document_workflows dw
JOIN public.documents d ON d.id = dw.document_id
CROSS JOIN LATERAL unnest(d.recipient_ids) WITH ORDINALITY AS t(recipient_uuid, idx)
JOIN public.role_recipients rr
     ON t.recipient_uuid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND rr.id = t.recipient_uuid::uuid
WHERE d.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.workflow_steps ws WHERE ws.workflow_id = dw.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Diagnostic: summarise state after migration
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_docs           INTEGER;
  v_emergency_docs INTEGER;
  v_workflows      INTEGER;
  v_steps          INTEGER;
  v_orphan_wf      INTEGER;
  v_bad_assignee   INTEGER;
  v_null_uid       INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_docs            FROM public.documents            WHERE status = 'pending';
  SELECT COUNT(*) INTO v_emergency_docs  FROM public.emergency_documents;
  SELECT COUNT(*) INTO v_workflows       FROM public.document_workflows;
  SELECT COUNT(*) INTO v_steps           FROM public.workflow_steps;
  SELECT COUNT(*) INTO v_orphan_wf       FROM public.document_workflows dw
    WHERE NOT EXISTS (SELECT 1 FROM public.workflow_steps ws WHERE ws.workflow_id = dw.id);
  SELECT COUNT(*) INTO v_bad_assignee    FROM public.workflow_steps
    WHERE assignee_id IS NOT NULL AND assignee_id !~ '^[0-9a-f\-]{36}$';
  SELECT COUNT(*) INTO v_null_uid        FROM public.role_recipients WHERE supabase_uid IS NULL;

  RAISE NOTICE '========== Post-migration diagnostics ==========';
  RAISE NOTICE 'Pending documents (unified):         %', v_docs;
  RAISE NOTICE 'Emergency documents (silo):           %', v_emergency_docs;
  RAISE NOTICE 'Document workflows:                   %', v_workflows;
  RAISE NOTICE 'Workflow steps:                       %', v_steps;
  RAISE NOTICE 'Orphaned workflows (0 steps):         % (should be 0)', v_orphan_wf;
  RAISE NOTICE 'Poisoned assignee_id (non-UUID):      % (should be 0)', v_bad_assignee;
  RAISE NOTICE 'role_recipients with NULL supabase_uid: % (should be 0)', v_null_uid;
  RAISE NOTICE '================================================';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Fix create_document_notification() trigger — the root cause of
--     "column user_id is of type uuid but expression is of type text (42804)"
--
--     notifications.user_id is UUID NOT NULL REFERENCES auth.users(id).
--     documents.submitter_id is TEXT (stores auth UUID as a string).
--     The trigger also tries to insert recipient_ids (role_recipients UUIDs)
--     into notifications.user_id which would violate the FK to auth.users.
--
--     Fix: cast submitter_id to UUID, and for recipients resolve their
--     auth UUID through role_recipients.supabase_uid so the FK holds.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_document_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_uuid TEXT;
  resolved_auth_uid UUID;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Determine notification type and content based on document status
  IF NEW.status = 'approved' THEN
    notification_type := 'approval';
    notification_title := 'Document Approved';
    notification_message := 'Your document "' || NEW.title || '" has been approved.';
  ELSIF NEW.status = 'rejected' THEN
    notification_type := 'error';
    notification_title := 'Document Rejected';
    notification_message := 'Your document "' || NEW.title || '" has been rejected.';
  ELSIF NEW.status = 'in-review' THEN
    notification_type := 'info';
    notification_title := 'Document In Review';
    notification_message := 'Your document "' || NEW.title || '" is now under review.';
  ELSIF NEW.is_emergency = TRUE THEN
    notification_type := 'emergency';
    notification_title := 'Emergency Document';
    notification_message := 'Emergency document "' || NEW.title || '" requires immediate attention.';
  ELSE
    RETURN NEW;
  END IF;

  -- Create notification for document submitter (submitter_id is TEXT, cast to UUID)
  IF NEW.submitter_id IS NOT NULL
     AND NEW.submitter_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    BEGIN
      INSERT INTO public.notifications (
        user_id, title, message, type, urgent, document_id, metadata
      ) VALUES (
        NEW.submitter_id::uuid,
        notification_title,
        notification_message,
        notification_type,
        COALESCE(NEW.is_emergency, FALSE) OR NEW.priority = 'emergency',
        NEW.id,
        jsonb_build_object(
          'document_type', NEW.type,
          'document_status', NEW.status,
          'priority', NEW.priority
        )
      );
    EXCEPTION WHEN foreign_key_violation OR invalid_text_representation THEN
      -- submitter_id is not a valid auth.users UUID — skip notification silently
      RAISE WARNING 'Skipping submitter notification: submitter_id % is not in auth.users', NEW.submitter_id;
    END;
  END IF;

  -- Create notifications for recipients
  -- recipient_ids stores role_recipients UUIDs, NOT auth.users UUIDs.
  -- Resolve each to an auth UUID via role_recipients.supabase_uid.
  IF NEW.recipient_ids IS NOT NULL AND array_length(NEW.recipient_ids, 1) > 0 THEN
    FOREACH recipient_uuid IN ARRAY NEW.recipient_ids
    LOOP
      -- Skip non-UUID strings
      IF recipient_uuid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        CONTINUE;
      END IF;

      -- supabase_uid is uuid type — IS NOT NULL check is sufficient, no regex needed
      SELECT rr.supabase_uid INTO resolved_auth_uid
        FROM public.role_recipients rr
       WHERE rr.id = recipient_uuid::uuid
         AND rr.supabase_uid IS NOT NULL;

      IF resolved_auth_uid IS NOT NULL AND resolved_auth_uid::text != COALESCE(NEW.submitter_id, '') THEN
        BEGIN
          INSERT INTO public.notifications (
            user_id, title, message, type, urgent, document_id, metadata
          ) VALUES (
            resolved_auth_uid,
            'Document Update: ' || NEW.title,
            'Document status changed to ' || NEW.status,
            notification_type,
            COALESCE(NEW.is_emergency, FALSE) OR NEW.priority = 'emergency',
            NEW.id,
            jsonb_build_object(
              'document_type', NEW.type,
              'document_status', NEW.status,
              'priority', NEW.priority
            )
          );
        EXCEPTION WHEN foreign_key_violation OR invalid_text_representation THEN
          RAISE WARNING 'Skipping recipient notification: resolved uid % not in auth.users', resolved_auth_uid;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Force PostgREST schema-cache reload (prevents stale 422 errors)
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
