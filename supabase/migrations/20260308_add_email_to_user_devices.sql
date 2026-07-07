-- ============================================================
-- Add email column to user_devices
-- Date: 2026-03-08
--
-- Allows direct token lookup by email without joining role_recipients.
-- Used by chat push notifications and email-based targeting.
-- ============================================================

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Index for fast lookup by email (used by sendPushToEmailDirect)
CREATE INDEX IF NOT EXISTS idx_user_devices_email
  ON public.user_devices(email)
  WHERE email IS NOT NULL;
