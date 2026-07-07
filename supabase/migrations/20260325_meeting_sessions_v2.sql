-- ============================================================
-- Meeting Sessions V2 — Add end_time, unique active session,
-- participants array, and 'expired' status
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add end_time column to track meeting expiry
ALTER TABLE meeting_sessions
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- 2. Add participants array column
ALTER TABLE meeting_sessions
  ADD COLUMN IF NOT EXISTS participants TEXT[] DEFAULT '{}';

-- 3. Expand status CHECK to allow 'expired'
ALTER TABLE meeting_sessions
  DROP CONSTRAINT IF EXISTS meeting_sessions_status_check;

ALTER TABLE meeting_sessions
  ADD CONSTRAINT meeting_sessions_status_check
  CHECK (status IN ('active', 'ended', 'expired'));

-- 4. Unique partial index: only one active session per meeting
-- Prevents duplicate session rows when multiple users hit /join simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_sessions_unique_active
  ON meeting_sessions (meeting_id)
  WHERE status = 'active';

-- 5. Verify
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'meeting_sessions'
ORDER BY ordinal_position;
