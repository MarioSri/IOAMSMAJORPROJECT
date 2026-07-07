-- ============================================================
-- LiveMeet+ — add requested_end_time column
-- Date: 2026-03-10
--
-- The modal collects a "From" (requested_time) and "To" (requested_end_time)
-- time from the sender.  Only requested_time was previously stored.
-- This migration adds the missing column so both endpoints can be persisted.
-- ============================================================

ALTER TABLE live_meeting_requests
  ADD COLUMN IF NOT EXISTS requested_end_time TIMESTAMP;

-- Backfill: existing rows get a 1-hour window after their requested_time
-- (matches the former hard-coded +1 hr fallback in the card component)
UPDATE live_meeting_requests
  SET requested_end_time = requested_time + INTERVAL '1 hour'
  WHERE requested_time IS NOT NULL
    AND requested_end_time IS NULL;

-- Index to support expiry queries ordered by end time
CREATE INDEX IF NOT EXISTS idx_live_meeting_requested_end
  ON live_meeting_requests(requested_end_time);

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_meeting_requests'
      AND column_name = 'requested_end_time'
  ) THEN
    RAISE EXCEPTION '[livemeet_end_time] Column was not added correctly.';
  END IF;
  RAISE NOTICE '[livemeet_end_time] requested_end_time column added successfully.';
END $$;
