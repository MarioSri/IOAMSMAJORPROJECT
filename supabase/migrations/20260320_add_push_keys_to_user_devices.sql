-- ============================================================
-- Add push_keys column to user_devices for Web Push
-- Date: 2026-03-20
--
-- Stores the p256dh and auth keys required for Web Push API.
-- These keys are part of the PushSubscription object returned
-- by the browser's pushManager.subscribe() method.
-- ============================================================

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_keys JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.user_devices.push_keys IS 'Web Push subscription keys: { p256dh: string, auth: string }';
