-- ============================================================
-- Department Analytics RPC
-- Aggregates document counts by recipient's department.
-- 
-- Logic:
--   • All 3 workflow modules (Document Management, Emergency
--     Management, Approval Chain with Bypass) write a unified
--     row to the `documents` table with:
--       - source TEXT  ('document-management' |
--                       'emergency-management' |
--                       'approval-chain-bypass')
--       - recipient_ids TEXT[]  (role_recipients UUIDs as strings)
--   • We LATERAL-unnest recipient_ids and JOIN to role_recipients
--     on rr.id::TEXT = rid to resolve the department.
--   • DISTINCT ON (doc_id, department) ensures one document
--     counts once per department even when multiple recipients
--     share the same department.
--   • Status normalization (source-aware):
--       emergency  resolved/acknowledged  → approved
--       emergency  submitted/escalated    → pending
--       bypass     bypassed               → approved
-- ============================================================

CREATE OR REPLACE FUNCTION get_department_analytics()
RETURNS TABLE (
  department    TEXT,
  total_received BIGINT,
  approved      BIGINT,
  rejected      BIGINT,
  pending       BIGINT,
  approval_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH dept_docs AS (
    SELECT DISTINCT ON (d.id, rr.department)
      rr.department,
      CASE
        WHEN d.source = 'emergency-management'
             AND d.status IN ('resolved', 'acknowledged') THEN 'approved'
        WHEN d.source = 'approval-chain-bypass'
             AND d.status = 'bypassed'                   THEN 'approved'
        WHEN d.source = 'emergency-management'
             AND d.status IN ('submitted', 'escalated')  THEN 'pending'
        ELSE d.status
      END AS normalized_status
    FROM documents d
    CROSS JOIN LATERAL unnest(d.recipient_ids) AS rid
    INNER JOIN role_recipients rr ON rr.id::TEXT = rid
    WHERE rr.department IS NOT NULL
      AND rr.department != ''
      AND array_length(d.recipient_ids, 1) > 0
    ORDER BY d.id, rr.department
  )
  SELECT
    dept_docs.department,
    COUNT(*)::BIGINT                                                        AS total_received,
    COUNT(*) FILTER (WHERE normalized_status = 'approved')::BIGINT         AS approved,
    COUNT(*) FILTER (WHERE normalized_status = 'rejected')::BIGINT         AS rejected,
    COUNT(*) FILTER (WHERE normalized_status NOT IN ('approved','rejected'))::BIGINT AS pending,
    CASE
      WHEN COUNT(*) > 0
        THEN ROUND(
               (COUNT(*) FILTER (WHERE normalized_status = 'approved')::NUMERIC
                / COUNT(*)) * 100,
               2
             )
      ELSE 0
    END                                                                     AS approval_rate
  FROM dept_docs
  GROUP BY dept_docs.department
  ORDER BY dept_docs.department;
END;
$$;

-- Allow both authenticated users and the anon key to call this function
GRANT EXECUTE ON FUNCTION get_department_analytics() TO authenticated, anon;
