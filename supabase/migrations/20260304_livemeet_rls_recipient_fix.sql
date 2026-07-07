-- Migration: Fix LiveMeet+ RLS UUID mismatch
-- Problem: target_user_id stores role_recipients.id, but the old policies compared
--          against auth.uid() directly — two different UUID systems.
-- Fix:     Extend USING clauses to also match via role_recipients.supabase_uid subquery.

-- ── Drop ALL existing policies (original permissive + scoped from 20260301) ───
DROP POLICY IF EXISTS "Users can view their requests"                          ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can insert requests"                              ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can update their requests"                        ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can delete their requests"                        ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all select on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all insert on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all update on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all delete on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can view their own live meeting requests"         ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can create live meeting requests as requester"    ON live_meeting_requests;
DROP POLICY IF EXISTS "Requester or target can update live meeting requests"   ON live_meeting_requests;
DROP POLICY IF EXISTS "Requester can delete their live meeting requests"       ON live_meeting_requests;

-- ── SELECT: requester OR target (by auth uid OR by recipient uuid) ────────────
CREATE POLICY "Users can view their own live meeting requests"
  ON live_meeting_requests
  FOR SELECT
  USING (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  );

-- ── INSERT: only the requester can create ────────────────────────────────────
CREATE POLICY "Users can create live meeting requests as requester"
  ON live_meeting_requests
  FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()::text
  );

-- ── UPDATE: requester OR target can update (accept / decline / withdraw) ─────
CREATE POLICY "Requester or target can update live meeting requests"
  ON live_meeting_requests
  FOR UPDATE
  USING (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  )
  WITH CHECK (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  );

-- ── DELETE: only the requester can delete ────────────────────────────────────
CREATE POLICY "Requester can delete their live meeting requests"
  ON live_meeting_requests
  FOR DELETE
  USING (
    requester_id = auth.uid()::text
  );

-- ── Verification notice ───────────────────────────────────────────────────────
DO $$
DECLARE
  unlinked INT;
BEGIN
  SELECT COUNT(*) INTO unlinked
  FROM role_recipients
  WHERE supabase_uid IS NULL AND is_active = TRUE;

  IF unlinked > 0 THEN
    RAISE WARNING '[livemeet_rls_fix] % active role_recipients row(s) have NULL supabase_uid — run 20260302_fix_approval_chain.sql backfill to populate them.', unlinked;
  ELSE
    RAISE NOTICE '[livemeet_rls_fix] OK: all active role_recipients have supabase_uid set.';
  END IF;
END $$;
