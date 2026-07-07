-- ============================================
-- Document Management Migration
-- Note: This extends the existing documents table from approval_center migration
-- ============================================

-- Add missing columns to documents table if they don't exist
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
END $$;

-- Ensure documents table has proper indexes
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_priority ON documents(priority);
CREATE INDEX IF NOT EXISTS idx_documents_is_emergency ON documents(is_emergency);

-- Ensure Realtime is enabled for documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
END $$;
