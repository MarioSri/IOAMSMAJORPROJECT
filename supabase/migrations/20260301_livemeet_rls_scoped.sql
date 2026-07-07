-- Migration: Tighten RLS on live_meeting_requests
-- Replaces the permissive USING (true) policies with per-user row isolation.
-- Users can only access rows where they are the requester or the target.
-- Note: requester_id and target_user_id are stored as TEXT, so auth.uid() is cast accordingly.

-- Drop the original permissive USING (true) policies from 20240129_livemeet_plus.sql
DROP POLICY IF EXISTS "Users can view their requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can insert requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can update their requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can delete their requests" ON live_meeting_requests;
-- Also drop any alternative names that may have been applied
DROP POLICY IF EXISTS "Allow all select on live_meeting_requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all insert on live_meeting_requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all update on live_meeting_requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all delete on live_meeting_requests" ON live_meeting_requests;

-- SELECT: user can see requests they sent or received
CREATE POLICY "Users can view their own live meeting requests"
  ON live_meeting_requests
  FOR SELECT
  USING (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
  );

-- INSERT: users can only create requests where they are the requester
CREATE POLICY "Users can create live meeting requests as requester"
  ON live_meeting_requests
  FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()::text
  );

-- UPDATE: requester can update (withdraw/edit), target can update status (accept/decline)
CREATE POLICY "Requester or target can update live meeting requests"
  ON live_meeting_requests
  FOR UPDATE
  USING (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
  )
  WITH CHECK (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
  );

-- DELETE: only the requester can delete a request
CREATE POLICY "Requester can delete their live meeting requests"
  ON live_meeting_requests
  FOR DELETE
  USING (
    requester_id = auth.uid()::text
  );
