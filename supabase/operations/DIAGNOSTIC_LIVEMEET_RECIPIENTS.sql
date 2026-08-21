-- ============================================================================
-- LiveMeet+ Recipient Diagnostic
-- Run this in Supabase SQL Editor to identify why recipients are not showing.
-- ============================================================================

-- ════════════════════════════════════════════════════
-- 1. ROLE_RECIPIENTS TABLE — data + RLS state
-- ════════════════════════════════════════════════════
SELECT '=== 1. RECIPIENT DATA ===' AS section;

SELECT
  COUNT(*)                                          AS total_rows,
  COUNT(*) FILTER (WHERE is_active = TRUE)          AS active_recipients,
  COUNT(*) FILTER (WHERE supabase_uid IS NOT NULL)  AS with_supabase_uid,
  array_agg(DISTINCT role ORDER BY role)            AS distinct_roles
FROM role_recipients;

-- ════════════════════════════════════════════════════
-- 2. RLS POLICIES on role_recipients
-- ════════════════════════════════════════════════════
SELECT '=== 2. role_recipients RLS ===' AS section;

SELECT relrowsecurity AS rls_enabled
FROM pg_class WHERE relname = 'role_recipients';

SELECT policyname, cmd, roles::text, qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'role_recipients'
ORDER BY cmd, policyname;

-- ════════════════════════════════════════════════════
-- 3. TEST QUERY — simulates what the frontend does
--    (run as authenticated user; errors indicate RLS block)
-- ════════════════════════════════════════════════════
SELECT '=== 3. SAMPLE RECIPIENTS ===' AS section;

SELECT id, name, role, email, department, is_active
FROM role_recipients
WHERE is_active = TRUE
LIMIT 10;

-- ════════════════════════════════════════════════════
-- 4. live_meeting_requests — RLS state
-- ════════════════════════════════════════════════════
SELECT '=== 4. live_meeting_requests RLS ===' AS section;

SELECT
  policyname,
  cmd,
  qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'live_meeting_requests'
ORDER BY cmd, policyname;

-- ════════════════════════════════════════════════════
-- 5. SUPABASE_UID LINKAGE
-- ════════════════════════════════════════════════════
SELECT '=== 5. supabase_uid linkage ===' AS section;

SELECT
  COUNT(*)                                        AS total_active,
  COUNT(supabase_uid)                             AS linked,
  COUNT(*) - COUNT(supabase_uid)                  AS unlinked
FROM role_recipients
WHERE is_active = TRUE;

-- Show unlinked recipients if any
SELECT id, name, email, role
FROM role_recipients
WHERE is_active = TRUE AND supabase_uid IS NULL
LIMIT 10;

-- ════════════════════════════════════════════════════
-- AUTO-FIX A: Add SELECT policy if missing
-- (safe to run even if policy already exists)
-- ════════════════════════════════════════════════════
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'role_recipients' AND cmd = 'SELECT'
  ) INTO policy_exists;

  IF NOT policy_exists THEN
    RAISE NOTICE '[FIX A] No SELECT policy on role_recipients — creating one...';
    EXECUTE $pol$
      CREATE POLICY "Authenticated users can read active recipients"
        ON public.role_recipients FOR SELECT TO authenticated
        USING (is_active = TRUE);
    $pol$;
    RAISE NOTICE '[FIX A] ✓ SELECT policy created.';
  ELSE
    RAISE NOTICE '[FIX A] ✓ SELECT policy already exists — no action needed.';
  END IF;
END $$;

-- ════════════════════════════════════════════════════
-- AUTO-FIX B: Backfill supabase_uid if any are NULL
-- ════════════════════════════════════════════════════
DO $$
DECLARE
  backfilled INT;
BEGIN
  UPDATE public.role_recipients rr
  SET supabase_uid = au.id
  FROM auth.users au
  WHERE lower(rr.email) = lower(au.email)
    AND rr.supabase_uid IS NULL;

  GET DIAGNOSTICS backfilled = ROW_COUNT;

  IF backfilled > 0 THEN
    RAISE NOTICE '[FIX B] Backfilled supabase_uid for % recipient(s).', backfilled;
  ELSE
    RAISE NOTICE '[FIX B] ✓ No backfill needed.';
  END IF;
END $$;

-- ════════════════════════════════════════════════════
-- FINAL STATUS
-- ════════════════════════════════════════════════════
SELECT '=== FINAL STATUS ===' AS section;

SELECT
  (SELECT COUNT(*) FROM role_recipients WHERE is_active = TRUE)       AS active_recipients,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'role_recipients' AND cmd = 'SELECT') AS select_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'live_meeting_requests') AS livemeet_policies,
  (SELECT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_meeting_requests' AND qual::text LIKE '%role_recipients%'))
                                                                        AS rls_bridge_applied,
  (SELECT COUNT(*) FROM role_recipients WHERE is_active = TRUE AND supabase_uid IS NULL) AS unlinked_recipients;
