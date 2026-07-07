-- ============================================
-- Document Files Migration (Safety Net)
-- Creates document_files table IF it doesn't already exist
-- Run this in Supabase SQL Editor
-- ============================================

-- Document Files table (IF NOT EXISTS — safe to re-run)
CREATE TABLE IF NOT EXISTS document_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_files_document ON document_files(document_id);

-- Enable Row Level Security
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive)
DROP POLICY IF EXISTS "Users can view document files" ON document_files;
DROP POLICY IF EXISTS "Users can insert document files" ON document_files;
DROP POLICY IF EXISTS "Users can update document files" ON document_files;
DROP POLICY IF EXISTS "Users can delete document files" ON document_files;

CREATE POLICY "Users can view document files" ON document_files FOR SELECT USING (true);
CREATE POLICY "Users can insert document files" ON document_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update document files" ON document_files FOR UPDATE USING (true);
CREATE POLICY "Users can delete document files" ON document_files FOR DELETE USING (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'document_files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE document_files;
  END IF;
END $$;

-- Trigger for updated_at
CREATE TRIGGER update_document_files_timestamp
  BEFORE UPDATE ON document_files
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_timestamp();

-- Verify
SELECT 'Document files table created' as status, COUNT(*) as count FROM document_files;
