-- ============================================================
-- QUICK FIX: Add push_keys column to user_devices
-- ============================================================
-- This fixes the 500 error when registering Web Push notifications
-- 
-- HOW TO APPLY:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run"
-- ============================================================

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_keys JSONB;

COMMENT ON COLUMN public.user_devices.push_keys IS 'Web Push subscription keys: { p256dh: string, auth: string }';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_devices' 
  AND column_name = 'push_keys';
