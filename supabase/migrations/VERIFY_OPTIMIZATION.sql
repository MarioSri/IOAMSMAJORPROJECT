-- ============================================
-- Metrics Optimization Verification Script
-- Run this in Supabase SQL Editor to verify optimizations
-- ============================================

-- 1. Verify all indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('documents', 'emergency_documents', 'bypass_documents')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Expected indexes:
-- documents: idx_documents_submitter_status, idx_documents_submitter_created, idx_documents_status_updated
-- emergency_documents: idx_emergency_submitter_status, idx_emergency_submitter_created, idx_emergency_status_updated
-- bypass_documents: idx_bypass_submitter_status, idx_bypass_submitter_created, idx_bypass_status_updated

-- 2. Check index usage statistics (run after some queries)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('documents', 'emergency_documents', 'bypass_documents')
  AND indexname LIKE 'idx_%submitter%'
ORDER BY tablename, idx_scan DESC;

-- 3. Verify RLS policies are active
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('documents', 'emergency_documents', 'bypass_documents')
ORDER BY tablename, policyname;

-- 4. Check table statistics
SELECT
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('documents', 'emergency_documents', 'bypass_documents')
ORDER BY tablename;

-- 5. Test query performance (replace 'YOUR_USER_ID' with actual user ID)
EXPLAIN ANALYZE
SELECT id, title, status, created_at, updated_at
FROM documents
WHERE submitter_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Expected: Should use idx_documents_submitter_created index
-- Execution time should be < 10ms for typical datasets

-- 6. Test filtered query performance
EXPLAIN ANALYZE
SELECT id, title, status, created_at, updated_at
FROM documents
WHERE submitter_id = 'YOUR_USER_ID'
  AND status = 'pending'
ORDER BY created_at DESC;

-- Expected: Should use idx_documents_submitter_status index
-- Execution time should be < 5ms for typical datasets

-- 7. Verify Realtime is enabled
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('documents', 'emergency_documents', 'bypass_documents')
ORDER BY tablename;

-- Expected: All three tables should be listed

-- 8. Check for missing indexes (should return no rows)
SELECT
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation
FROM pg_stats
WHERE tablename IN ('documents', 'emergency_documents', 'bypass_documents')
  AND attname IN ('submitter_id', 'status', 'created_at')
  AND n_distinct > 10  -- High cardinality columns that might need indexes
ORDER BY tablename, attname;

-- 9. Performance baseline - Count queries
-- These should be fast with proper indexes
SELECT 'documents' as table_name, COUNT(*) as total_count FROM documents;
SELECT 'emergency_documents' as table_name, COUNT(*) as total_count FROM emergency_documents;
SELECT 'bypass_documents' as table_name, COUNT(*) as total_count FROM bypass_documents;

-- 10. Verify data integrity
-- Check for any documents without submitter_id (should be 0)
SELECT 'documents' as table_name, COUNT(*) as missing_submitter
FROM documents
WHERE submitter_id IS NULL OR submitter_id = '';

SELECT 'emergency_documents' as table_name, COUNT(*) as missing_submitter
FROM emergency_documents
WHERE submitter_id IS NULL OR submitter_id = '';

SELECT 'bypass_documents' as table_name, COUNT(*) as missing_submitter
FROM bypass_documents
WHERE submitter_id IS NULL OR submitter_id = '';

-- ============================================
-- Optimization Tips
-- ============================================

-- If indexes are not being used, try:
-- 1. VACUUM ANALYZE documents;
-- 2. VACUUM ANALYZE emergency_documents;
-- 3. VACUUM ANALYZE bypass_documents;

-- If queries are still slow, check:
-- 1. Table size: SELECT pg_size_pretty(pg_total_relation_size('documents'));
-- 2. Index size: SELECT pg_size_pretty(pg_total_relation_size('idx_documents_submitter_status'));
-- 3. Cache hit ratio: SELECT * FROM pg_stat_database WHERE datname = current_database();

-- ============================================
-- Success Criteria
-- ============================================

-- ✅ All expected indexes exist
-- ✅ RLS policies are active on all tables
-- ✅ Realtime is enabled for all tables
-- ✅ Query execution time < 10ms
-- ✅ Indexes are being used (idx_scan > 0)
-- ✅ No missing submitter_id values
-- ✅ Table statistics are up to date
