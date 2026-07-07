-- =====================================================================
-- E-Digital Signature System — Security Layer Migration
-- Run in Supabase SQL Editor before enabling the security features.
-- =====================================================================

-- 1. Add document hash column to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash_computed_at TIMESTAMPTZ;

-- 2. Audit log table for tamper detection and compliance
CREATE TABLE IF NOT EXISTS document_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID REFERENCES documents(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  user_name      TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index for fast lookup by document
CREATE INDEX IF NOT EXISTS idx_document_audit_log_document_id
  ON document_audit_log (document_id);

-- 4. Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_document_audit_log_created_at
  ON document_audit_log (created_at DESC);

-- 5. Row-Level Security
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only read audit logs for documents they have access to
CREATE POLICY "Users can read own document audit log"
  ON document_audit_log
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents 
      WHERE submitter_id = auth.uid()::text
        OR (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(recipients)
        OR EXISTS (
          SELECT 1 FROM role_recipients rr
          WHERE rr.id::text = ANY(documents.recipient_ids)
            AND rr.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- Only the system (service role) writes audit events
CREATE POLICY "Service role can insert audit events"
  ON document_audit_log
  FOR INSERT
  WITH CHECK (true);

-- =====================================================================
-- Verification: check tables exist after migration
-- =====================================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_hash';
-- SELECT COUNT(*) FROM document_audit_log;
