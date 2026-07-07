-- ============================================================
-- Notification Preferences Migration
-- Date: 2026-03-08
-- Adds:
--   1. user_notification_preferences table (Supabase-backed prefs)
--   2. Email retry tracking columns on the notifications table
-- ============================================================

-- 1. User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_notification_prefs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON public.user_notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_prefs_updated_at();

-- Auto-create default row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_notification_prefs ON auth.users;
CREATE TRIGGER trg_create_default_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can view own notification preferences"
  ON public.user_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own row (on first visit)
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
  ON public.user_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can update own notification preferences"
  ON public.user_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can select all (for backend preference check)
DROP POLICY IF EXISTS "Service role can read all notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Service role can read all notification preferences"
  ON public.user_notification_preferences
  FOR SELECT
  TO service_role
  USING (true);

-- Service role can insert on behalf of users
DROP POLICY IF EXISTS "Service role can insert notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Service role can insert notification preferences"
  ON public.user_notification_preferences
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Backfill preferences for any existing auth users
INSERT INTO public.user_notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notification_preferences;

-- ============================================================
-- 2. Add email retry tracking columns to notifications table
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_failed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_email_attempt_at TIMESTAMPTZ;

-- Partial index for efficient retry queue queries
CREATE INDEX IF NOT EXISTS idx_notifications_email_failed
  ON public.notifications(email_failed)
  WHERE email_failed = TRUE;
