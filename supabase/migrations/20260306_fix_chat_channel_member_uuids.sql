-- ============================================================
-- Migration: 20260306_fix_chat_channel_member_uuids
-- Purpose:   Repair chat_channels.members[] entries that contain
--            role_recipients.id values instead of supabase_uid values.
--
-- Background:
--   When users created channels via the UI, selected recipient IDs
--   (role_recipients.id) were stored directly in the members[] array.
--   RLS policies check auth.uid() = ANY(members), but auth.uid()
--   equals supabase_uid — a different UUID. This caused recipients
--   to be silently blocked from seeing channels and messages.
--
--   Document-triggered channels (create_document_chat_channel trigger)
--   were correctly resolving to supabase_uid, so only manually-created
--   channels are affected.
--
-- Fix:
--   For every member entry in chat_channels.members that matches a
--   role_recipients.id, replace it with the corresponding supabase_uid.
--   Member entries that are already supabase_uid values (and have no
--   matching role_recipients.id row) are left unchanged.
-- ============================================================

BEGIN;

-- Step 1: Repair members[] in all affected channels.
-- Only updates channels where at least one member element matches
-- a role_recipients.id that has a non-null supabase_uid.
UPDATE chat_channels cc
SET members = (
  SELECT array_agg(
    COALESCE(rr.supabase_uid::text, m)   -- swap to supabase_uid if found, else keep as-is
    ORDER BY ord
  )
  FROM unnest(cc.members) WITH ORDINALITY AS t(m, ord)
  LEFT JOIN role_recipients rr
    ON rr.id::text = t.m
   AND rr.supabase_uid IS NOT NULL
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM unnest(cc.members) AS m
  JOIN role_recipients rr ON rr.id::text = m
  WHERE rr.supabase_uid IS NOT NULL
);

-- Step 2: Safety — remove any NULL entries that may have been introduced
-- if a matched role_recipient had supabase_uid = NULL (should not happen
-- due to the IS NOT NULL guard above, but defensive cleanup).
UPDATE chat_channels
SET members = array_remove(members, NULL::text),
    updated_at = NOW()
WHERE NULL::text = ANY(members);

-- Step 3: Report how many channels were affected (visible in migration logs).
DO $$
DECLARE
  repaired_count INT;
BEGIN
  SELECT COUNT(*) INTO repaired_count
  FROM chat_channels
  WHERE updated_at >= NOW() - INTERVAL '5 seconds';

  RAISE NOTICE 'chat_channel member UUID repair complete. Channels updated: %', repaired_count;
END;
$$;

COMMIT;
