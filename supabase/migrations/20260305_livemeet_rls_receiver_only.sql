-- ============================================================
-- LiveMeet+ RLS: Receiver-Only Visibility
-- Date: 2026-03-05
--
-- Problem: The SELECT policy added in 20260304_livemeet_rls_recipient_fix.sql
--   includes requester_id = auth.uid()::text, which allows initiators to
--   query their own sent requests. Per requirements, the LiveMeet+ card view
--   is for RECEIVERS only — initiators should not see requests they sent.
--
-- Fix: Replace the SELECT policy to scope visibility to target_user_id only.
--   INSERT, UPDATE, DELETE policies are unchanged — requesters retain the
--   ability to create and delete their own requests.
-- ============================================================

-- Drop the current SELECT policy (defined in 20260304_livemeet_rls_recipient_fix.sql)
DROP POLICY IF EXISTS "Users can view their own live meeting requests" ON live_meeting_requests;

-- New SELECT policy: only the target (receiver) can view requests
-- Two conditions cover both UUID storage formats for target_user_id:
--   1. Direct auth UID match (target stores auth.uid() directly)
--   2. role_recipients.id match resolved via supabase_uid column
CREATE POLICY "Receivers can view live meeting requests"
  ON live_meeting_requests
  FOR SELECT
  USING (
    target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  );

-- Verification: confirm policy is receiver-scoped only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'live_meeting_requests'
      AND policyname = 'Receivers can view live meeting requests'
  ) THEN
    RAISE EXCEPTION '[livemeet_rls_receiver_only] Policy was not created correctly.';
  END IF;
  RAISE NOTICE '[livemeet_rls_receiver_only] SELECT policy scoped to receivers only. Initiators can no longer SELECT their sent requests.';
END $$;
