-- ============================================
-- Approval Center Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Documents table (if not exists)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  submitter_id TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  submitted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partially-approved')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
  is_emergency BOOLEAN DEFAULT FALSE,
  files JSONB DEFAULT '[]',
  file_assignments JSONB DEFAULT '{}',
  recipient_ids TEXT[] DEFAULT '{}',
  recipients TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Schema reconciliation: Add missing columns if documents table already existed (e.g., from 20240120)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS submitter_id TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_assignments JSONB DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipient_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS recipients TEXT[] DEFAULT '{}';


-- Document Workflows table
CREATE TABLE IF NOT EXISTS document_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  routing_type TEXT NOT NULL DEFAULT 'sequential' CHECK (routing_type IN ('sequential', 'parallel', 'bidirectional', 'reverse')),
  is_parallel BOOLEAN DEFAULT FALSE,
  has_bypass BOOLEAN DEFAULT FALSE,
  current_step TEXT NOT NULL DEFAULT 'Submission',
  progress INTEGER DEFAULT 0,
  escalation_level INTEGER DEFAULT 0,
  bypassed_recipients TEXT[] DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflow Steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  assignee TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed', 'rejected', 'bypassed', 'cancelled')),
  completed_date DATE,
  rejected_date DATE,
  rejected_by TEXT,
  bypass_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Document Approvals (history) table
CREATE TABLE IF NOT EXISTS document_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  approver_id TEXT NOT NULL,
  approver_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'bypassed')),
  comment TEXT,
  action_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS approval_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  shared_for TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_submitter ON documents(submitter_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_document ON document_workflows(document_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_assignee ON workflow_steps(assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_approvals_document ON document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON document_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_comments_document ON approval_comments(document_id);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view documents" ON documents;
DROP POLICY IF EXISTS "Users can insert documents" ON documents;
DROP POLICY IF EXISTS "Users can update documents" ON documents;
DROP POLICY IF EXISTS "Users can delete documents" ON documents;

DROP POLICY IF EXISTS "Users can view workflows" ON document_workflows;
DROP POLICY IF EXISTS "Users can insert workflows" ON document_workflows;
DROP POLICY IF EXISTS "Users can update workflows" ON document_workflows;

DROP POLICY IF EXISTS "Users can view workflow steps" ON workflow_steps;
DROP POLICY IF EXISTS "Users can insert workflow steps" ON workflow_steps;
DROP POLICY IF EXISTS "Users can update workflow steps" ON workflow_steps;

DROP POLICY IF EXISTS "Users can view approvals" ON document_approvals;
DROP POLICY IF EXISTS "Users can insert approvals" ON document_approvals;

DROP POLICY IF EXISTS "Users can view comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can insert comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can update comments" ON approval_comments;
DROP POLICY IF EXISTS "Users can delete comments" ON approval_comments;

-- RLS Policies (permissive for now - adjust based on your auth setup)
CREATE POLICY "Users can view documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Users can insert documents" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update documents" ON documents FOR UPDATE USING (true);
CREATE POLICY "Users can delete documents" ON documents FOR DELETE USING (true);

CREATE POLICY "Users can view workflows" ON document_workflows FOR SELECT USING (true);
CREATE POLICY "Users can insert workflows" ON document_workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update workflows" ON document_workflows FOR UPDATE USING (true);

CREATE POLICY "Users can view workflow steps" ON workflow_steps FOR SELECT USING (true);
CREATE POLICY "Users can insert workflow steps" ON workflow_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update workflow steps" ON workflow_steps FOR UPDATE USING (true);

CREATE POLICY "Users can view approvals" ON document_approvals FOR SELECT USING (true);
CREATE POLICY "Users can insert approvals" ON document_approvals FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view comments" ON approval_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON approval_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update comments" ON approval_comments FOR UPDATE USING (true);
CREATE POLICY "Users can delete comments" ON approval_comments FOR DELETE USING (true);

-- Enable Realtime (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'document_workflows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE document_workflows;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'workflow_steps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workflow_steps;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'document_approvals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE document_approvals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'approval_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE approval_comments;
  END IF;
END $$;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_approval_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_document_timestamp ON documents;
CREATE TRIGGER update_document_timestamp
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_timestamp();

DROP TRIGGER IF EXISTS update_workflow_timestamp ON document_workflows;
CREATE TRIGGER update_workflow_timestamp
  BEFORE UPDATE ON document_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_timestamp();

DROP TRIGGER IF EXISTS update_workflow_step_timestamp ON workflow_steps;
CREATE TRIGGER update_workflow_step_timestamp
  BEFORE UPDATE ON workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_timestamp();

DROP TRIGGER IF EXISTS update_comment_timestamp ON approval_comments;
CREATE TRIGGER update_comment_timestamp
  BEFORE UPDATE ON approval_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_approval_timestamp();


-- Verify tables created
SELECT 'Documents table created' as status, COUNT(*) as count FROM documents
UNION ALL
SELECT 'Workflows table created' as status, COUNT(*) as count FROM document_workflows
UNION ALL
SELECT 'Workflow steps table created' as status, COUNT(*) as count FROM workflow_steps
UNION ALL
SELECT 'Approvals table created' as status, COUNT(*) as count FROM document_approvals
UNION ALL
SELECT 'Comments table created' as status, COUNT(*) as count FROM approval_comments;
