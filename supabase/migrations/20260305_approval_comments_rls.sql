-- ============================================================
-- Approval Comments RLS Tightening (Strict Privacy)
-- Date: 2026-03-05
--
-- Visibility Rules:
--   "Your Comment" (is_shared=false): Author + Document submitter only
--   "Shared Comment" (is_shared=true): Author + Intended recipients only
--
-- Changes:
--   1. Performance indexes on documents, approval_comments,
--      and role_recipients to support the visibility checks
--   2. Helper functions:
--        is_document_submitter()  — fast submitter check
--        can_see_shared_comment() — mirrors shouldSeeSharedComment()
--                                   client logic server-side
--        is_document_participant() — used for INSERT gate only
--   3. Scoped RLS policies on approval_comments replacing
--      the four permissive USING(true) policies
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Performance indexes
--    All created with IF NOT EXISTS — safe to run on any
--    environment regardless of which prior migrations ran.
-- ──────────────────────────────────────────────────────────

-- Fast equality check on documents.submitter_id (TEXT).
-- A previous migration created idx_documents_submitter; this
-- distinct name is a no-op duplicate if needed.
CREATE INDEX IF NOT EXISTS idx_documents_submitter_id
  ON documents(submitter_id);

-- GIN index enables fast auth.uid()::text = ANY(recipient_ids)
-- checks without a full table scan. recipient_ids is TEXT[].
CREATE INDEX IF NOT EXISTS idx_documents_recipient_ids
  ON documents USING GIN(recipient_ids);

-- Fast author_id lookup used by SELECT/UPDATE/DELETE policies.
CREATE INDEX IF NOT EXISTS idx_approval_comments_author
  ON approval_comments(author_id);

-- Partial index covers shared-comment recipient resolution:
-- only rows with is_shared=true need the shared_for lookup.
CREATE INDEX IF NOT EXISTS idx_approval_comments_shared
  ON approval_comments(is_shared, shared_for)
  WHERE is_shared = true;

-- Covers the supabase_uid → name lookup in can_see_shared_comment().
CREATE INDEX IF NOT EXISTS idx_role_recipients_supabase_uid_name
  ON role_recipients(supabase_uid, name);

-- ──────────────────────────────────────────────────────────
-- 2. Helper functions
--
--    Three SECURITY DEFINER STABLE functions so the policies
--    remain readable and the planner can cache results within
--    a single statement. All run as the function owner so
--    they are unaffected by the calling user's RLS context.
-- ──────────────────────────────────────────────────────────

-- is_document_submitter
--   TRUE when the calling user is the document submitter.
--   Used by the SELECT policy so DocumentTracker.tsx can show
--   all non-shared comments on the submitter's own documents.
CREATE OR REPLACE FUNCTION is_document_submitter(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM documents
    WHERE id = p_document_id
      AND submitter_id = auth.uid()::text  -- submitter_id is TEXT (20260302 migration)
  );
END;
$$;

-- can_see_shared_comment
--   Server-side mirror of shouldSeeSharedComment() in Approvals.tsx.
--   TRUE when:
--     • shared_for = 'all', OR
--     • the calling user's display name (from role_recipients) is
--       contained in shared_for OR vice-versa (case-insensitive).
--   This matches the client logic so RLS and UI are consistent;
--   the client-side filter becomes a redundant safety net.
CREATE OR REPLACE FUNCTION can_see_shared_comment(p_shared_for TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- 'all' means every participant may see it
  IF p_shared_for = 'all' THEN
    RETURN TRUE;
  END IF;

  -- Resolve the calling user's display name via role_recipients
  SELECT name INTO v_name
  FROM role_recipients
  WHERE supabase_uid = auth.uid()::text
  LIMIT 1;

  -- No matching recipient row → cannot see private shared comments
  IF v_name IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Bidirectional substring match (mirrors the client logic)
  RETURN LOWER(p_shared_for) LIKE '%' || LOWER(v_name) || '%'
      OR LOWER(v_name)       LIKE '%' || LOWER(p_shared_for) || '%';
END;
$$;

-- is_document_participant
--   TRUE when the calling user is the submitter, a recipient,
--   or any workflow assignee (status-agnostic).
--   Used exclusively for the INSERT WITH CHECK guard so only
--   legitimate participants can create comments.
CREATE OR REPLACE FUNCTION is_document_participant(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = p_document_id
      AND (
        d.submitter_id = auth.uid()::text
        OR auth.uid()::text = ANY(d.recipient_ids)
        OR EXISTS (
          SELECT 1
          FROM document_workflows dw
          JOIN workflow_steps ws ON ws.workflow_id = dw.id
          WHERE dw.document_id = d.id
            AND ws.assignee_id = auth.uid()::text
        )
      )
  );
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 3. Scoped RLS policies on approval_comments
--
--    Replaces the four permissive USING(true) policies that
--    were created in 20240131_approval_center.sql and
--    re-declared in 20260302_fix_approval_chain.sql.
--
--    SELECT visibility rules (strict privacy):
--      Rule 1 — Author always sees their own comments
--      Rule 2 — Submitter sees all non-shared comments
--               (powers DocumentTracker.tsx comment display)
--      Rule 3 — Shared comments visible to intended recipients
--               only (mirrors shouldSeeSharedComment() logic)
--
--    INSERT  — participant who sets themselves as author
--    UPDATE  — own comments only
--    DELETE  — own comments only
-- ──────────────────────────────────────────────────────────

-- Drop existing policies by both name variants across migrations.
DROP POLICY IF EXISTS "Users can view comments"   ON approval_comments;
DROP POLICY IF EXISTS "Users can insert comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can update comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can delete comments" ON approval_comments;
-- Also drop scoped names so the migration is idempotent on re-run.
DROP POLICY IF EXISTS "approval_comments_select"  ON approval_comments;
DROP POLICY IF EXISTS "approval_comments_insert"  ON approval_comments;
DROP POLICY IF EXISTS "approval_comments_update"  ON approval_comments;
DROP POLICY IF EXISTS "approval_comments_delete"  ON approval_comments;

-- SELECT: strict visibility based on comment type.
-- Supabase Realtime automatically scopes realtime events through
-- SELECT RLS — no subscription code changes needed.
CREATE POLICY "approval_comments_select" ON approval_comments
  FOR SELECT
  USING (
    -- Rule 1: Author always sees their own comments
    author_id = auth.uid()::text
    OR
    -- Rule 2: Submitter sees all non-shared ("Your Comment") entries
    --         so DocumentTracker and Approval History display correctly
    (NOT is_shared AND is_document_submitter(document_id))
    OR
    -- Rule 3: Shared comments are private to the intended recipient(s)
    --         Mirrors shouldSeeSharedComment() in Approvals.tsx
    (is_shared AND can_see_shared_comment(shared_for))
  );

-- INSERT: caller must be a document participant and set their
-- own auth UID as author_id. ApprovalService.addComment() already
-- passes user.id as authorId, so this check is always satisfied
-- for legitimate calls.
CREATE POLICY "approval_comments_insert" ON approval_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()::text
    AND is_document_participant(document_id)
  );

-- UPDATE: own comments only.
CREATE POLICY "approval_comments_update" ON approval_comments
  FOR UPDATE
  USING (author_id = auth.uid()::text);

-- DELETE: own comments only. ApprovalService.deleteComment()
-- already targets by comment id; this enforces row-level
-- ownership server-side.
CREATE POLICY "approval_comments_delete" ON approval_comments
  FOR DELETE
  USING (author_id = auth.uid()::text);
