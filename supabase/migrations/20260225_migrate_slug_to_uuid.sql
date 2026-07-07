-- Migration: Convert legacy slug-based assignee_id values in workflow_steps to role_recipients UUIDs
-- This migration updates existing workflow_steps rows that have slug-format assignee_id values
-- (e.g., 'principal-dr.-robert-principal') to use the corresponding role_recipients.id (UUID).
--
-- The matching is done by comparing the slug-derived name against role_recipients.name.
-- Only rows where assignee_id is NOT already a valid UUID are updated.

-- Step 1: Update workflow_steps.assignee_id from slug to role_recipients.id
-- Match by comparing the assignee (display name) to role_recipients.name
UPDATE workflow_steps ws
SET assignee_id = rr.id::text
FROM role_recipients rr
WHERE ws.assignee_id NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  AND LOWER(rr.name) = LOWER(ws.assignee)
  AND rr.is_active = true;

-- Step 2: Log any remaining unmatched slug IDs for manual review
-- Run this SELECT to identify any workflow_steps that still have non-UUID assignee_id
-- SELECT ws.id, ws.assignee_id, ws.assignee, ws.name
-- FROM workflow_steps ws
-- WHERE ws.assignee_id NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

-- Step 3: Also update document_approvals.approver_id if they contain slug IDs
UPDATE document_approvals da
SET approver_id = rr.id::text
FROM role_recipients rr
WHERE da.approver_id NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  AND LOWER(rr.name) = LOWER(da.approver_name)
  AND rr.is_active = true;
