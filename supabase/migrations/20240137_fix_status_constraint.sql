-- ============================================
-- Fix Status CHECK Constraint
-- Adds 'in-review' and 'emergency' as valid document statuses
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop old constraint and recreate with expanded values
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents ADD CONSTRAINT documents_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'partially-approved', 'in-review', 'emergency', 'draft'));

-- Also ensure submitter_department and submitter_designation columns exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='submitter_department') THEN
    ALTER TABLE documents ADD COLUMN submitter_department TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='submitter_designation') THEN
    ALTER TABLE documents ADD COLUMN submitter_designation TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='routing_type') THEN
    ALTER TABLE documents ADD COLUMN routing_type TEXT DEFAULT 'sequential';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='is_parallel') THEN
    ALTER TABLE documents ADD COLUMN is_parallel BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='recipient_ids') THEN
    ALTER TABLE documents ADD COLUMN recipient_ids TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='recipients') THEN
    ALTER TABLE documents ADD COLUMN recipients TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Verify
SELECT 'Status constraint updated' as status;
