-- ============================================================
-- IAOMS: Department Stats Schema & RPC Fix
-- Date: 2026-04-01
--
-- Purpose:
--   1. Ensures the department_stats table has a user_id column
--      to allow per-user recordings of analytics state.
--   2. Updates the uniqueness constraint to support per-user snapshots.
--   3. Enhances the get_department_analytics RPC to provide the 
--      avg_processing_time metric (in days).
-- ============================================================

-- 1. Update department_stats table schema
ALTER TABLE public.department_stats 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Update unique constraint
-- We drop the old global constraint and replace with a user-scoped one.
ALTER TABLE public.department_stats 
DROP CONSTRAINT IF EXISTS department_stats_department_name_period_start_period_end_key;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'department_stats_user_dept_period_key') THEN
    ALTER TABLE public.department_stats 
    ADD CONSTRAINT department_stats_user_dept_period_key 
    UNIQUE (department_name, period_start, period_end, user_id);
  END IF;
END $$;

-- 3. Update get_department_analytics() RPC to include avg_processing_time
-- We must DROP the function first because PostgreSQL does not allow 
-- CREATE OR REPLACE to change the return type (OUT parameters).
DROP FUNCTION IF EXISTS get_department_analytics(UUID);
DROP FUNCTION IF EXISTS get_department_analytics();

CREATE OR REPLACE FUNCTION get_department_analytics(p_user_id UUID)
RETURNS TABLE (
  department          TEXT,
  total_received      BIGINT,
  approved            BIGINT,
  rejected            BIGINT,
  pending             BIGINT,
  approval_rate       NUMERIC,
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
      AND d.submitter_id = p_user_id::TEXT
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
    END AS approval_rate,
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

-- Ensure permissions are set
GRANT EXECUTE ON FUNCTION get_department_analytics(UUID) TO authenticated, anon;
