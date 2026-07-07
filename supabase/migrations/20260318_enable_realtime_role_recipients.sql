-- ============================================
-- Enable Real-Time for role_recipients Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable Realtime for role_recipients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'role_recipients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE role_recipients;
    RAISE NOTICE 'Real-time enabled for role_recipients table';
  ELSE
    RAISE NOTICE 'Real-time already enabled for role_recipients table';
  END IF;
END $$;
