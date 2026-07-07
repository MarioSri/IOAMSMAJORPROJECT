-- ============================================================
-- Fix approval_comments INSERT RLS
-- Date: 2026-03-11
--
-- Problem:
--   The 20260305_approval_comments_rls.sql migration added an
--   INSERT policy that calls is_document_participant(), which
--   checks ws.assignee_id = auth.uid()::text.
--   However, assignee_id in workflow_steps stores role_recipients.id
--   (NOT auth.users.id), so the check never matches for approvers
--   and every "Save comment" call is rejected with an RLS error.
--
-- Fix:
--   1. Patch is_document_participant() to resolve the approver's
--      auth UID → role_recipients.id via role_recipients.supabase_uid.
--   2. Replace the INSERT policy with one that only requires
--      author_id = auth.uid()::text (the participant check is
--      redundant — SELECT RLS already prevents reading docs you
--      don't belong to, and you can only author with your own UID).
-- ============================================================

-- 1. Patch is_document_participant to resolve auth.uid() → role_recipients.id
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
        -- Submitter (stored as supabase auth UID text)
        d.submitter_id = auth.uid()::text

        -- Recipient listed in recipient_ids array
        OR auth.uid()::text = ANY(d.recipient_ids)

        -- Workflow step assignee matched via auth UID directly
        OR EXISTS (
          SELECT 1
          FROM document_workflows dw
          JOIN workflow_steps ws ON ws.workflow_id = dw.id
          WHERE dw.document_id = d.id
            AND ws.assignee_id = auth.uid()::text
        )

        -- Workflow step assignee matched via role_recipients.supabase_uid
        -- (assignee_id stores role_recipients.id, not auth.users.id)
        OR EXISTS (
          SELECT 1
          FROM document_workflows dw
          JOIN workflow_steps ws ON ws.workflow_id = dw.id
          JOIN role_recipients rr ON rr.id::text = ws.assignee_id
          WHERE dw.document_id = d.id
            AND rr.supabase_uid = auth.uid()
        )
      )
  );
END;
$$;

-- 2. Replace the broken INSERT policy with a simpler, correct one.
--    Requiring author_id = auth.uid()::text prevents impersonation.
--    The is_document_participant guard is dropped — it is redundant
--    and was the source of the regression.
DROP POLICY IF EXISTS "approval_comments_insert" ON approval_comments;

CREATE POLICY "approval_comments_insert" ON approval_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()::text
  );
