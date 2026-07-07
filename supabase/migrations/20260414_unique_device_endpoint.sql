-- ============================================================
-- Add unique constraint on fcm_token (Web Push endpoint)
-- Prevents duplicate device registrations for the same endpoint
-- Date: 2026-04-14
-- ============================================================

-- Drop if exists to make migration idempotent
ALTER TABLE public.user_devices
  DROP CONSTRAINT IF EXISTS uq_user_fcm_token;

ALTER TABLE public.user_devices
  DROP CONSTRAINT IF EXISTS unique_fcm_token_global;

-- One endpoint = one device row globally (endpoints are globally unique per browser)
ALTER TABLE public.user_devices
  ADD CONSTRAINT unique_fcm_token_global UNIQUE (fcm_token);

-- Index on email for fast email-based push lookups (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_user_devices_email
  ON public.user_devices(email)
  WHERE email IS NOT NULL;

COMMENT ON CONSTRAINT unique_fcm_token_global ON public.user_devices IS
  'Each Web Push endpoint is globally unique — one row per browser subscription';
