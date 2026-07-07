-- =====================================================
-- Emergency Management Verification Diagnostic
-- Run this in Supabase SQL Editor AFTER submitting
-- a test emergency document. It traces every layer
-- of the data flow from creation → storage → UI.
-- =====================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Did the emergency doc land in emergency_documents?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  urgency_level,
  submitter_id,
  submitter_name,
  status,
  array_length(recipients, 1) AS recipient_count,
  created_at
FROM emergency_documents
ORDER BY created_at DESC
LIMIT 5;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Did the unified entry land in documents (Track Documents source)?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  type,
  source,
  status,
  submitter_id,
  submitter_name,
  array_length(recipient_ids, 1) AS recipient_count,
  created_at
FROM documents
WHERE source = 'emergency-management'
ORDER BY created_at DESC
LIMIT 5;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Was a workflow created for each emergency document?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  dw.id AS workflow_id,
  d.title,
  d.source,
  d.status,
  dw.routing_type,
  dw.has_bypass,
  dw.source AS workflow_source,
  COUNT(ws.id) AS step_count,
  STRING_AGG(ws.assignee || ' [' || ws.assignee_id || '] (' || ws.status || ')', E'\n') AS steps
FROM document_workflows dw
JOIN documents d ON d.id = dw.document_id
LEFT JOIN workflow_steps ws ON ws.workflow_id = dw.id
WHERE d.source = 'emergency-management'
GROUP BY dw.id, d.title, d.source, d.status, dw.routing_type, dw.has_bypass, dw.source, dw.created_at
ORDER BY dw.created_at DESC
LIMIT 5;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Do the workflow_steps.assignee_id values match role_recipients?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  ws.id AS step_id,
  ws.assignee AS step_assignee,
  ws.assignee_id AS step_assignee_id,
  ws.status AS step_status,
  rr.id AS rr_id,
  rr.name AS rr_name,
  rr.supabase_uid,
  CASE
    WHEN rr.id IS NOT NULL THEN '✅ assignee_id matches role_recipients.id'
    ELSE '❌ NO MATCH — orphaned step'
  END AS match_status
FROM workflow_steps ws
JOIN document_workflows dw ON dw.id = ws.workflow_id
JOIN documents d ON d.id = dw.document_id
LEFT JOIN role_recipients rr ON rr.id::text = ws.assignee_id
WHERE d.source = 'emergency-management'
ORDER BY d.created_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Is role_recipients.supabase_uid populated for all active users?
--            If NULL, the recipient can NEVER see approval cards.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  rr.id,
  rr.name,
  rr.email,
  rr.role,
  rr.supabase_uid,
  CASE
    WHEN rr.supabase_uid IS NOT NULL THEN '✅ linked'
    ELSE '❌ UNLINKED — cannot receive approval cards'
  END AS link_status
FROM role_recipients rr
WHERE rr.is_active = TRUE
ORDER BY link_status, rr.name;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Does the submitter's Supabase Auth UID match documents.submitter_id?
--            If NOT, Track Documents page will show empty (filters by user.id)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  d.id,
  d.title,
  d.source,
  d.submitter_id AS stored_submitter_id,
  au.id AS auth_uuid,
  au.email AS auth_email,
  CASE
    WHEN d.submitter_id = au.id::text THEN '✅ submitter_id matches auth.users.id'
    ELSE '❌ MISMATCH — Track Documents wont show this doc for this user'
  END AS match_status
FROM documents d
CROSS JOIN auth.users au
WHERE d.source = 'emergency-management'
  AND au.email = d.submitter_name  -- approximate match via name
ORDER BY d.created_at DESC
LIMIT 10;

-- ALTERNATIVE version using submitter_id directly
-- (replace 'YOUR-SUPABASE-AUTH-UID-HERE' with your actual UUID from auth.users)
-- SELECT id, title, source, submitter_id FROM documents
-- WHERE submitter_id = 'YOUR-SUPABASE-AUTH-UID-HERE'
--   AND source = 'emergency-management';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: Realtime — are all required tables in supabase_realtime publication?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tablename,
  CASE WHEN tablename IN (
    'documents', 'document_workflows', 'workflow_steps',
    'document_approvals', 'approval_comments', 'emergency_documents'
  ) THEN '✅ in realtime' ELSE 'other' END AS realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN (
    'documents', 'document_workflows', 'workflow_steps',
    'document_approvals', 'approval_comments', 'emergency_documents'
  )
ORDER BY tablename;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: Full health snapshot — all pending workflows
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  d.source,
  d.title,
  d.status,
  d.submitter_name,
  d.submitter_id,
  COUNT(ws.id) AS step_count,
  SUM(CASE WHEN ws.status = 'current' THEN 1 ELSE 0 END) AS current_steps,
  SUM(CASE WHEN ws.assignee_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 ELSE 0 END) AS valid_uuid_steps,
  SUM(CASE WHEN rr.id IS NOT NULL THEN 1 ELSE 0 END) AS matched_recipient_steps
FROM documents d
JOIN document_workflows dw ON dw.document_id = d.id
LEFT JOIN workflow_steps ws ON ws.workflow_id = dw.id
LEFT JOIN role_recipients rr ON rr.id::text = ws.assignee_id
WHERE d.status IN ('pending', 'in_progress')
GROUP BY d.source, d.title, d.status, d.submitter_name, d.submitter_id, d.created_at
ORDER BY d.source, d.created_at DESC
LIMIT 20;
