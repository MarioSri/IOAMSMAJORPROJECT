-- Fix for the "Could not find the 'recipient_ids' column" error
-- Run this in your Supabase SQL Editor to add the missing column

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='recipient_ids') THEN
    ALTER TABLE documents ADD COLUMN recipient_ids TEXT[] DEFAULT '{}';
  END IF;

  -- Also ensure recipients exists just in case
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='recipients') THEN
    ALTER TABLE documents ADD COLUMN recipients TEXT[] DEFAULT '{}';
  END IF;
END $$;
