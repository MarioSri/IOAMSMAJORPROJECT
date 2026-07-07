-- ============================================
-- Approval Chain Bypass Enhancement
-- Adds state machine columns to workflow_steps
-- ============================================

-- Ensure document_files table exists (Safety Net)
CREATE TABLE IF NOT EXISTS document_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security (Safety Net)
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for compatibility with existing flow)
DROP POLICY IF EXISTS "Users can view document files" ON document_files;
DROP POLICY IF EXISTS "Users can insert document files" ON document_files;
DROP POLICY IF EXISTS "Users can update document files" ON document_files;
DROP POLICY IF EXISTS "Users can delete document files" ON document_files;

CREATE POLICY "Users can view document files" ON document_files FOR SELECT USING (true);
CREATE POLICY "Users can insert document files" ON document_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update document files" ON document_files FOR UPDATE USING (true);
CREATE POLICY "Users can delete document files" ON document_files FOR DELETE USING (true);

-- Add bypass tracking columns
ALTER TABLE workflow_steps 
  ADD COLUMN IF NOT EXISTS bypassed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reupload_file_id UUID REFERENCES document_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_version_at_action INT DEFAULT 1;

-- Update status constraint to include 'resent'
ALTER TABLE workflow_steps 
  DROP CONSTRAINT IF EXISTS workflow_steps_status_check;

ALTER TABLE workflow_steps 
  ADD CONSTRAINT workflow_steps_status_check 
  CHECK (status IN ('pending', 'current', 'completed', 'rejected', 'bypassed', 'cancelled', 'resent'));

-- Add index for file version queries
CREATE INDEX IF NOT EXISTS idx_workflow_steps_file_version 
  ON workflow_steps(file_version_at_action);

-- Add index for reupload tracking
CREATE INDEX IF NOT EXISTS idx_workflow_steps_reupload 
  ON workflow_steps(reupload_file_id) 
  WHERE reupload_file_id IS NOT NULL;

-- Verify
SELECT 'Bypass columns added' as status;
