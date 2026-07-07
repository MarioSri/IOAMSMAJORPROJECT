-- =====================================================
-- IAOMS Approval Chain Fix Migration
-- Date: 2026-03-02
-- Purpose:
--   0. Reconcile schema drift between competing CREATE TABLE IF NOT EXISTS
--      definitions (20240120 vs 20240131). The earlier migration wins and
--      later ones are silently ignored, leaving the table with the wrong
--      column names. This part adds the missing columns.
--   1. Backfill role_recipients.supabase_uid for all existing users.
--   2. Repair workflow_steps rows where assignee_id stored a name string.
--   3. Fix RLS policy for client-side supabase_uid write-back.
--   4. Reconcile documents table schema drift (files, file_assignments, submitter_id type).
--   5. Ensure approval_comments table exists (realtime + comments feature).
--   6. Verify FK constraints (PostgREST joins depend on them).
--   7. Post-migration diagnostics + PostgREST cache reload.
-- =====================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 0: Schema reconciliation — workflow_steps & document_workflows
--
-- Migration 20240120 creates workflow_steps with columns:
--     step_name, assignee_name
-- Migration 20240131 tries to create it with columns:
--     name, assignee, rejected_by
-- But CREATE TABLE IF NOT EXISTS is a no-op when the table already exists,
-- so the 20240131 columns are NEVER created.
--
-- The application code (WorkflowService, ApprovalService, useSupabaseApprovals)
-- all write/read columns: name, assignee, assignee_id, rejected_by.
-- If these columns don't exist, step inserts FAIL (PostgREST 400)
-- and steps=[] is returned — this is the TRUE root cause of invisible
-- approval cards (steps=0 → no matching → no cards).
--
-- Fix: Add any missing columns idempotently, then backfill from legacy columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- workflow_steps: add columns the app expects
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE public.workflow_steps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Drop NOT NULL constraints on legacy columns (step_name, assignee_name)
-- The app never provides these columns — their NOT NULL constraint from
-- migration 20240120 silently blocks every INSERT via PostgREST (400 error).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps' AND column_name = 'step_name'
  ) THEN
    ALTER TABLE public.workflow_steps ALTER COLUMN step_name DROP NOT NULL;
    ALTER TABLE public.workflow_steps ALTER COLUMN step_name SET DEFAULT '';
    RAISE NOTICE 'Dropped NOT NULL on workflow_steps.step_name and set default to empty string.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps' AND column_name = 'assignee_name'
  ) THEN
    ALTER TABLE public.workflow_steps ALTER COLUMN assignee_name DROP NOT NULL;
    ALTER TABLE public.workflow_steps ALTER COLUMN assignee_name SET DEFAULT '';
    RAISE NOTICE 'Dropped NOT NULL on workflow_steps.assignee_name and set default to empty string.';
  END IF;
END;
$$;

-- Backfill name/assignee from legacy step_name/assignee_name if they exist
-- and the new columns are still NULL
DO $$
BEGIN
  -- Check if legacy column step_name exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps' AND column_name = 'step_name'
  ) THEN
    UPDATE public.workflow_steps
    SET name = step_name
    WHERE name IS NULL AND step_name IS NOT NULL;
    RAISE NOTICE 'Backfilled workflow_steps.name from step_name';
  END IF;

  -- Check if legacy column assignee_name exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workflow_steps' AND column_name = 'assignee_name'
  ) THEN
    UPDATE public.workflow_steps
    SET assignee = assignee_name
    WHERE assignee IS NULL AND assignee_name IS NOT NULL;
    RAISE NOTICE 'Backfilled workflow_steps.assignee from assignee_name';
  END IF;
END;
$$;

-- document_workflows: add columns the app expects (missing from 20240120 schema)
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS has_bypass BOOLEAN DEFAULT FALSE;
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS bypassed_recipients TEXT[] DEFAULT '{}';
ALTER TABLE public.document_workflows ADD COLUMN IF NOT EXISTS source TEXT;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_workflow_steps_assignee ON public.workflow_steps(assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON public.workflow_steps(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 1: Backfill supabase_uid for existing role_recipients rows
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.role_recipients rr
SET supabase_uid = au.id
FROM auth.users au
WHERE lower(rr.email) = lower(au.email)
  AND rr.supabase_uid IS NULL;

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.role_recipients
  WHERE supabase_uid IS NOT NULL;
  RAISE NOTICE 'role_recipients rows with supabase_uid populated: %', updated_count;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 2: Repair poisoned workflow_steps rows (name strings in assignee_id)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.workflow_steps ws
SET assignee_id = rr.id::text
FROM public.role_recipients rr
WHERE
  ws.assignee_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND lower(ws.assignee_id) = lower(rr.name)
  AND rr.is_active = TRUE;

DO $$
DECLARE
  bad_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_rows
  FROM public.workflow_steps
  WHERE assignee_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF bad_rows > 0 THEN
    RAISE WARNING
      '% workflow_steps row(s) still have non-UUID assignee_id after repair.',
      bad_rows;
  ELSE
    RAISE NOTICE 'All workflow_steps.assignee_id values are valid UUIDs.';
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 3: RLS policy for client-side supabase_uid write-back
--
-- Uses auth.uid() directly — querying auth.users inside RLS policies causes
-- "permission denied for table users" because authenticated role lacks SELECT
-- on auth.users.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "User can link own supabase_uid" ON public.role_recipients;
DROP POLICY IF EXISTS "User can link supabase_uid by email" ON public.role_recipients;

CREATE POLICY "User can link supabase_uid by email"
  ON public.role_recipients
  FOR UPDATE
  TO authenticated
  USING  (supabase_uid = auth.uid() OR supabase_uid IS NULL)
  WITH CHECK (supabase_uid = auth.uid() OR supabase_uid IS NULL);


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 4: Reconcile documents table schema drift
--
-- 20240120 creates documents WITHOUT: files, file_assignments, recipient_ids,
-- recipients.  20240131 has them but is a no-op (table already exists).
-- 20240137 adds recipient_ids + recipients but NOT files / file_assignments.
-- DocumentService.createDocument() updates documents.files JSONB after upload.
-- If the column is missing, file metadata is silently lost.
--
-- Also: 20240120 defines submitter_id as UUID NOT NULL but the app may pass
-- a text string fallback (e.g. "principal-1709398400000"). Convert to TEXT.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add missing columns
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_assignments JSONB DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipient_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipients TEXT[] DEFAULT '{}';

-- Fix submitter_id type: UUID → TEXT (PostgREST accepts UUID strings for TEXT
-- but rejects non-UUID strings for UUID columns).
-- Must drop+recreate any RLS policies that reference submitter_id first.
DO $$
DECLARE
  pol RECORD;
  pol_defs TEXT[] := '{}';
BEGIN
  -- Check if submitter_id exists AT ALL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'submitter_id'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN submitter_id TEXT;
    RAISE NOTICE 'Added missing column documents.submitter_id as TEXT';
    RETURN; -- Added as TEXT, no need to alter type
  END IF;

  -- It exists. Check if it is UUID. If not UUID, it is likely already TEXT.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'submitter_id'
      AND data_type = 'uuid'
  ) THEN
    RAISE NOTICE 'documents.submitter_id is already TEXT or not UUID — skipping alter.';
    RETURN;
  END IF;


  -- Collect and drop all policies on documents that reference submitter_id
  FOR pol IN
    SELECT polname AS policyname, pg_get_expr(polqual, polrelid) AS qual,
           pg_get_expr(polwithcheck, polrelid) AS withcheck,
           CASE polcmd
             WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
             WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
             ELSE 'ALL'
           END AS cmd,
           polpermissive
    FROM pg_policy
    WHERE polrelid = 'public.documents'::regclass
  LOOP
    IF pol.qual LIKE '%submitter_id%' OR pol.withcheck LIKE '%submitter_id%' THEN
      pol_defs := array_append(pol_defs,
        pol.policyname || '|' || pol.cmd || '|' ||
        COALESCE(pol.qual,'true') || '|' ||
        COALESCE(pol.withcheck,'') || '|' ||
        pol.polpermissive::text
      );
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents', pol.policyname);
      RAISE NOTICE 'Dropped policy "%" on documents (references submitter_id)', pol.policyname;
    END IF;
  END LOOP;

  -- Now safe to alter the column type
  ALTER TABLE public.documents ALTER COLUMN submitter_id TYPE TEXT USING submitter_id::TEXT;
  RAISE NOTICE 'Changed documents.submitter_id from UUID to TEXT';

  -- Recreate dropped policies with the same definitions
  FOR i IN 1..array_length(pol_defs, 1) LOOP
    DECLARE
      parts TEXT[] := string_to_array(pol_defs[i], '|');
      p_name TEXT := parts[1];
      p_cmd TEXT := parts[2];
      p_qual TEXT := parts[3];
      p_check TEXT := parts[4];
      p_permissive BOOLEAN := parts[5]::boolean;
      sql_stmt TEXT;
    BEGIN
      sql_stmt := format(
        'CREATE POLICY %I ON public.documents AS %s FOR %s USING (%s)',
        p_name,
        CASE WHEN p_permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        p_cmd,
        p_qual
      );
      IF p_check IS NOT NULL AND p_check <> '' THEN
        sql_stmt := sql_stmt || format(' WITH CHECK (%s)', p_check);
      END IF;
      EXECUTE sql_stmt;
      RAISE NOTICE 'Recreated policy "%" on documents', p_name;
    END;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 5: Ensure approval_comments table exists
--
-- 20240120 creates document_comments. 20240131 creates approval_comments but
-- is a no-op. The app code (ApprovalService, useSupabaseApprovals realtime)
-- uses approval_comments. If missing, addComment throws and the realtime
-- subscription references a non-existent table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  shared_for TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can insert comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can update comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can delete comments" ON approval_comments;

CREATE POLICY "Users can view comments" ON approval_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON approval_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update comments" ON approval_comments FOR UPDATE USING (true);
CREATE POLICY "Users can delete comments" ON approval_comments FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_approval_comments_document ON approval_comments(document_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'approval_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE approval_comments;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 6: Verify FK constraints
--
-- PostgREST uses FK metadata for !inner() joins. Without the FK,
-- .select('*, document:documents!inner(*)') fails and returns [].
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE fk_exists BOOLEAN;
BEGIN
  -- document_workflows → documents
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'document_workflows'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'documents'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    RAISE WARNING 'FK document_workflows → documents MISSING! Recreating...';
    ALTER TABLE public.document_workflows
      ADD CONSTRAINT fk_document_workflows_document
      FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
    RAISE NOTICE 'FK document_workflows → documents recreated.';
  ELSE
    RAISE NOTICE 'FK document_workflows → documents exists.';
  END IF;

  -- workflow_steps → document_workflows
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'workflow_steps'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'document_workflows'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    RAISE WARNING 'FK workflow_steps → document_workflows MISSING! Recreating...';
    ALTER TABLE public.workflow_steps
      ADD CONSTRAINT fk_workflow_steps_workflow
      FOREIGN KEY (workflow_id) REFERENCES public.document_workflows(id) ON DELETE CASCADE;
    RAISE NOTICE 'FK workflow_steps → document_workflows recreated.';
  ELSE
    RAISE NOTICE 'FK workflow_steps → document_workflows exists.';
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part 7: Post-migration diagnostics + PostgREST cache reload
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  bad_steps       INTEGER;
  unlinked_rr     INTEGER;
  ambiguous_names INTEGER;
  has_name_col    BOOLEAN;
  has_assignee_col BOOLEAN;
  has_files_col   BOOLEAN;
  has_comments_tbl BOOLEAN;
BEGIN
  -- workflow_steps columns
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workflow_steps' AND column_name='name')
    INTO has_name_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workflow_steps' AND column_name='assignee')
    INTO has_assignee_col;

  IF has_name_col AND has_assignee_col THEN
    RAISE NOTICE 'OK: workflow_steps has "name" and "assignee" columns.';
  ELSE
    RAISE WARNING 'CRITICAL: workflow_steps missing columns! name=%, assignee=%', has_name_col, has_assignee_col;
  END IF;

  -- documents.files
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='files')
    INTO has_files_col;
  IF has_files_col THEN
    RAISE NOTICE 'OK: documents has "files" column.';
  ELSE
    RAISE WARNING 'CRITICAL: documents is missing "files" column!';
  END IF;

  -- approval_comments table
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='approval_comments')
    INTO has_comments_tbl;
  IF has_comments_tbl THEN
    RAISE NOTICE 'OK: approval_comments table exists.';
  ELSE
    RAISE WARNING 'CRITICAL: approval_comments table is missing!';
  END IF;

  -- Bad assignee_ids
  SELECT COUNT(*) INTO bad_steps FROM public.workflow_steps
  WHERE assignee_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF bad_steps > 0 THEN
    RAISE WARNING '% workflow_steps row(s) still have non-UUID assignee_id.', bad_steps;
  ELSE
    RAISE NOTICE 'OK: All assignee_id values are valid UUIDs.';
  END IF;

  -- Unlinked recipients
  SELECT COUNT(*) INTO unlinked_rr FROM public.role_recipients
  WHERE supabase_uid IS NULL AND is_active = TRUE;
  IF unlinked_rr > 0 THEN
    RAISE WARNING '% active role_recipients without supabase_uid.', unlinked_rr;
  ELSE
    RAISE NOTICE 'OK: All active role_recipients have supabase_uid.';
  END IF;

  -- Duplicate names
  SELECT COUNT(*) INTO ambiguous_names FROM (
    SELECT name FROM public.role_recipients
    WHERE is_active = TRUE GROUP BY name HAVING COUNT(*) > 1
  ) dupes;
  IF ambiguous_names > 0 THEN
    RAISE WARNING '% duplicate display name(s) in active role_recipients.', ambiguous_names;
  ELSE
    RAISE NOTICE 'OK: No duplicate names.';
  END IF;
END;
$$;

-- Show workflows with zero steps (broken records from prior failed inserts)
SELECT dw.id AS workflow_id, dw.document_id, d.title, d.status,
       COUNT(ws.id) AS step_count
FROM document_workflows dw
JOIN documents d ON d.id = dw.document_id
LEFT JOIN workflow_steps ws ON ws.workflow_id = dw.id
WHERE d.status = 'pending'
GROUP BY dw.id, dw.document_id, d.title, d.status
HAVING COUNT(ws.id) = 0;

-- Force PostgREST to reload its schema cache immediately
-- Without this, PostgREST may not recognize new columns/FKs until next auto-refresh
NOTIFY pgrst, 'reload schema';
