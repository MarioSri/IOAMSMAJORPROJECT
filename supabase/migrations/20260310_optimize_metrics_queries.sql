-- ============================================
-- Optimize Metrics Queries for Real-Time Performance
-- Adds composite indexes for user-specific queries
-- ============================================

-- Documents table: Optimize user-specific status queries
CREATE INDEX IF NOT EXISTS idx_documents_submitter_status ON documents(submitter_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_submitter_created ON documents(submitter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status_updated ON documents(status, updated_at) WHERE status = 'approved';

-- Emergency documents: Optimize user-specific queries
CREATE INDEX IF NOT EXISTS idx_emergency_submitter_status ON emergency_documents(submitter_id, status);
CREATE INDEX IF NOT EXISTS idx_emergency_submitter_created ON emergency_documents(submitter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_status_updated ON emergency_documents(status, updated_at) WHERE status = 'resolved';

-- Bypass documents: Optimize user-specific queries
CREATE INDEX IF NOT EXISTS idx_bypass_submitter_status ON bypass_documents(submitter_id, status);
CREATE INDEX IF NOT EXISTS idx_bypass_submitter_created ON bypass_documents(submitter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bypass_status_updated ON bypass_documents(status, updated_at) WHERE status IN ('approved', 'bypassed');

-- Analyze tables to update query planner statistics
ANALYZE documents;
ANALYZE emergency_documents;
ANALYZE bypass_documents;
