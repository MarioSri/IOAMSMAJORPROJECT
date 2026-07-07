-- ============================================================
-- Preferred Notification Email
-- Date: 2026-03-08
-- Adds preferred_notification_email column to role_recipients
-- Falls back to the user's auth email when NULL
-- ============================================================

ALTER TABLE public.role_recipients
  ADD COLUMN IF NOT EXISTS preferred_notification_email TEXT;

COMMENT ON COLUMN public.role_recipients.preferred_notification_email IS
  'Optional override email for notification delivery. Falls back to the auth email when NULL.';
