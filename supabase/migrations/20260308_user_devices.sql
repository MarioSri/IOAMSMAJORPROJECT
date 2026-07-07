-- ============================================================
-- User Devices Table (FCM token storage)
-- Date: 2026-03-08
-- Stores Firebase Cloud Messaging tokens per user/browser
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
  ON public.user_devices(user_id);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users manage their own devices
DROP POLICY IF EXISTS "Users can view own devices" ON public.user_devices;
CREATE POLICY "Users can view own devices"
  ON public.user_devices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own devices" ON public.user_devices;
CREATE POLICY "Users can insert own devices"
  ON public.user_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own devices" ON public.user_devices;
CREATE POLICY "Users can update own devices"
  ON public.user_devices FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own devices" ON public.user_devices;
CREATE POLICY "Users can delete own devices"
  ON public.user_devices FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access (for backend push delivery)
DROP POLICY IF EXISTS "Service role full access to user_devices" ON public.user_devices;
CREATE POLICY "Service role full access to user_devices"
  ON public.user_devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
