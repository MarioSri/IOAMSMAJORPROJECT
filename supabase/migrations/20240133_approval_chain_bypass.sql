-- ============================================
-- Approval Chain with Bypass Migration
-- ============================================

-- Bypass Documents table
CREATE TABLE IF NOT EXISTS bypass_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  document_types TEXT[] DEFAULT '{}',
  routing_type TEXT NOT NULL CHECK (routing_type IN ('sequential', 'parallel', 'reverse', 'bidirectional')),
  priority TEXT NOT NULL DEFAULT 'normal',
  submitter_id TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  submitter_role TEXT,
  submitted_date TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'bypassed')),
  files JSONB DEFAULT '[]',
  file_assignments JSONB DEFAULT '{}',
  recipients TEXT[] DEFAULT '{}',
  recipient_names TEXT[] DEFAULT '{}',
  bypassed_recipients TEXT[] DEFAULT '{}',
  resubmitted_recipients TEXT[] DEFAULT '{}',
  signed_by TEXT[] DEFAULT '{}',
  total_recipients INTEGER DEFAULT 0,
  signature_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bypass Workflow Steps table
CREATE TABLE IF NOT EXISTS bypass_workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES bypass_documents(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  assignee TEXT NOT NULL,
  recipient_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed', 'bypassed')),
  completed_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bypass_docs_submitter ON bypass_documents(submitter_id);
CREATE INDEX IF NOT EXISTS idx_bypass_docs_status ON bypass_documents(status);
CREATE INDEX IF NOT EXISTS idx_bypass_docs_routing ON bypass_documents(routing_type);
CREATE INDEX IF NOT EXISTS idx_bypass_docs_created ON bypass_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bypass_steps_document ON bypass_workflow_steps(document_id);
CREATE INDEX IF NOT EXISTS idx_bypass_steps_status ON bypass_workflow_steps(status);

-- Enable RLS
ALTER TABLE bypass_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bypass_workflow_steps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view bypass documents" ON bypass_documents;
DROP POLICY IF EXISTS "Users can insert bypass documents" ON bypass_documents;
DROP POLICY IF EXISTS "Users can update bypass documents" ON bypass_documents;
DROP POLICY IF EXISTS "Users can delete bypass documents" ON bypass_documents;

DROP POLICY IF EXISTS "Users can view bypass steps" ON bypass_workflow_steps;
DROP POLICY IF EXISTS "Users can insert bypass steps" ON bypass_workflow_steps;
DROP POLICY IF EXISTS "Users can update bypass steps" ON bypass_workflow_steps;

-- RLS Policies
CREATE POLICY "Users can view bypass documents" ON bypass_documents FOR SELECT USING (true);
CREATE POLICY "Users can insert bypass documents" ON bypass_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update bypass documents" ON bypass_documents FOR UPDATE USING (true);
CREATE POLICY "Users can delete bypass documents" ON bypass_documents FOR DELETE USING (true);

CREATE POLICY "Users can view bypass steps" ON bypass_workflow_steps FOR SELECT USING (true);
CREATE POLICY "Users can insert bypass steps" ON bypass_workflow_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update bypass steps" ON bypass_workflow_steps FOR UPDATE USING (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bypass_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bypass_documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bypass_workflow_steps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bypass_workflow_steps;
  END IF;
END $$;

-- Triggers
CREATE TRIGGER update_bypass_document_timestamp
  BEFORE UPDATE ON bypass_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_timestamp();

CREATE TRIGGER update_bypass_step_timestamp
  BEFORE UPDATE ON bypass_workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_timestamp();
