-- ============================================================
-- IAOMS: User-Scoped Department Analytics RPC (Updated)
-- Date: 2026-04-01
--
-- Logic:
--   • All 3 workflow modules write to the `documents` table.
--   • We resolve the departments for each document's recipients.
--   • We filter by current active user (p_user_id) for record-keeping.
--   • status normalization is module aware.
--   • Added avg_processing_time (days).
-- ============================================================

DROP FUNCTION IF EXISTS get_department_analytics(UUID);
DROP FUNCTION IF EXISTS get_department_analytics();

CREATE OR REPLACE FUNCTION get_department_analytics(p_user_id UUID)
RETURNS TABLE (
  department    TEXT,
  total_received BIGINT,
  approved      BIGINT,
  rejected      BIGINT,
  pending       BIGINT,
  approval_rate NUMERIC,
  avg_processing_time NUMERIC
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
      d.created_at,
      d.updated_at,
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
      AND (d.submitter_id = p_user_id::TEXT OR p_user_id IS NULL)
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
    END                                                                     AS approval_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE normalized_status IN ('approved','rejected')) > 0
        THEN ROUND(
               AVG(EXTRACT(EPOCH FROM (dept_docs.updated_at - dept_docs.created_at)) / 86400)::NUMERIC,
               2
             )
      ELSE 0
    END AS avg_processing_time
  FROM dept_docs
  GROUP BY dept_docs.department
  ORDER BY dept_docs.department;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION get_department_analytics(UUID) TO authenticated, anon;
