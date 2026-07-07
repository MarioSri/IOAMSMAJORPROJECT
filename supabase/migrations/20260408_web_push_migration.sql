-- ============================================================
-- Web Push Migration: Replace FCM with standard Web Push
-- Date: 2026-04-08
--
-- fcm_token column is repurposed to store the Web Push endpoint URL.
-- push_keys JSONB stores the p256dh and auth cryptographic keys needed
-- by the backend to encrypt notifications via the Web Push protocol.
-- ============================================================

-- 1. Add push_keys column (stores {p256dh: string, auth: string})
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_keys JSONB;

-- 2. Rename the unique constraint to reflect the new semantics
--    (endpoint URL instead of FCM token)
ALTER TABLE public.user_devices
  DROP CONSTRAINT IF EXISTS uq_user_fcm_token;

ALTER TABLE public.user_devices
  ADD CONSTRAINT uq_user_push_endpoint UNIQUE (user_id, fcm_token);

-- 3. Index on push_keys (GIN for JSONB queries)
CREATE INDEX IF NOT EXISTS idx_user_devices_push_keys
  ON public.user_devices USING GIN (push_keys)
  WHERE push_keys IS NOT NULL;

-- 4. Prune old FCM tokens (entries where push_keys hasn't been populated yet)
DELETE FROM public.user_devices WHERE push_keys IS NULL;
