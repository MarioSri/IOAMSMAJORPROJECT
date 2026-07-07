-- ============================================================
-- IAOMS: User-Scoped Department Analytics RPC
-- Date: 2026-04-01
-- Version: 2.0 (User-Scoped)
--
-- Purpose:
--   Updates get_department_analytics() to accept a user_id parameter
--   ensuring each user sees only their own department analytics data.
--
-- Changes from v1.0:
--   - Added p_user_id parameter
--   - Added WHERE filter: d.submitter_id = p_user_id
--   - Maintains all existing status normalization logic
--   - Maintains LATERAL UNNEST and department resolution
--
-- Usage:
--   SELECT * FROM get_department_analytics('user-uuid-here');
-- ============================================================

CREATE OR REPLACE FUNCTION get_department_analytics(p_user_id UUID)
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
        -- Emergency Management status normalization
        WHEN d.source = 'emergency-management'
             AND d.status IN ('resolved', 'acknowledged') THEN 'approved'

        -- Approval Chain with Bypass status normalization
        WHEN d.source = 'approval-chain-bypass'
             AND d.status = 'bypassed' THEN 'approved'

        -- Emergency Management pending states
        WHEN d.source = 'emergency-management'
             AND d.status IN ('submitted', 'escalated') THEN 'pending'

        -- Document Management (use status as-is)
        ELSE d.status
      END AS normalized_status
    FROM documents d
    CROSS JOIN LATERAL unnest(d.recipient_ids) AS rid
    INNER JOIN role_recipients rr ON rr.id::TEXT = rid
    WHERE rr.department IS NOT NULL
      AND rr.department != ''
      AND array_length(d.recipient_ids, 1) > 0
      AND d.submitter_id = p_user_id::TEXT  -- ✅ USER ISOLATION FILTER (Fixed: Cast UUID to TEXT)
    ORDER BY d.id, rr.department
  )
  SELECT
    dept_docs.department,
    COUNT(*)::BIGINT AS total_received,
    COUNT(*) FILTER (WHERE normalized_status = 'approved')::BIGINT AS approved,
    COUNT(*) FILTER (WHERE normalized_status = 'rejected')::BIGINT AS rejected,
    COUNT(*) FILTER (WHERE normalized_status NOT IN ('approved','rejected'))::BIGINT AS pending,
    CASE
      WHEN COUNT(*) > 0
        THEN ROUND(
               (COUNT(*) FILTER (WHERE normalized_status = 'approved')::NUMERIC
                / COUNT(*)) * 100,
               2
             )
      ELSE 0
    END AS approval_rate
  FROM dept_docs
  GROUP BY dept_docs.department
  ORDER BY dept_docs.department;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION get_department_analytics(UUID) TO authenticated, anon;

-- Add helpful comment
COMMENT ON FUNCTION get_department_analytics(UUID) IS
'User-scoped department analytics. Returns document counts by recipient department for documents submitted by the specified user. Handles status normalization across all 3 workflow modules (Document Management, Emergency Management, Approval Chain with Bypass).';
