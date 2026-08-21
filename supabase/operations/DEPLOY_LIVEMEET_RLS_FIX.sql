-- ============================================================================
-- DEPLOY: LiveMeet+ RLS Recipient Fix
-- Date:    2026-03-04
-- Usage:   Paste this ENTIRE script into Supabase SQL Editor and click "Run"
--
-- This script:
--   1. Diagnoses current RLS state on live_meeting_requests
--   2. Backfills role_recipients.supabase_uid if any are missing
--   3. Drops ALL existing RLS policies on live_meeting_requests
--   4. Creates fixed policies with role_recipients.supabase_uid bridge
--   5. Verifies everything is correct
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: PRE-FLIGHT DIAGNOSTICS
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl_exists BOOLEAN;
  policy_count INT;
  has_subquery BOOLEAN;
  total_recipients INT;
  linked_recipients INT;
BEGIN
  -- Check table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'live_meeting_requests'
  ) INTO tbl_exists;

  IF NOT tbl_exists THEN
    RAISE EXCEPTION '[DEPLOY] ABORT: live_meeting_requests table does not exist. Run 20240129_livemeet_plus.sql first.';
  END IF;

  -- Count current policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies WHERE tablename = 'live_meeting_requests';

  -- Check if fix already applied (subquery present)
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_meeting_requests'
      AND qual::text LIKE '%role_recipients%'
  ) INTO has_subquery;

  -- Check supabase_uid status
  SELECT COUNT(*), COUNT(supabase_uid)
  INTO total_recipients, linked_recipients
  FROM role_recipients WHERE is_active = TRUE;

  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '  PRE-FLIGHT DIAGNOSTICS';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '  Table exists:            YES';
  RAISE NOTICE '  Current policy count:    %', policy_count;
  RAISE NOTICE '  RLS fix already applied: %', CASE WHEN has_subquery THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '  Active recipients:       %', total_recipients;
  RAISE NOTICE '  With supabase_uid:       %', linked_recipients;
  RAISE NOTICE '  Missing supabase_uid:    %', total_recipients - linked_recipients;
  RAISE NOTICE '════════════════════════════════════════════════════';

  IF has_subquery THEN
    RAISE NOTICE '  ✓ RLS fix appears already applied — re-applying for safety.';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: BACKFILL role_recipients.supabase_uid
-- ═══════════════════════════════════════════════════════════════════════════════
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
    RAISE NOTICE '[STEP 2] Backfilled supabase_uid for % recipient(s).', backfilled;
  ELSE
    RAISE NOTICE '[STEP 2] No backfill needed — all recipients already linked.';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: DROP ALL EXISTING POLICIES (idempotent — covers every naming variant)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Original permissive (20240129)
DROP POLICY IF EXISTS "Users can view their requests"                          ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can insert requests"                              ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can update their requests"                        ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can delete their requests"                        ON live_meeting_requests;

-- Alternative permissive names
DROP POLICY IF EXISTS "Allow all select on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all insert on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all update on live_meeting_requests"              ON live_meeting_requests;
DROP POLICY IF EXISTS "Allow all delete on live_meeting_requests"              ON live_meeting_requests;

-- Scoped policies from 20260301 / 20260304
DROP POLICY IF EXISTS "Users can view their own live meeting requests"         ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can create live meeting requests as requester"    ON live_meeting_requests;
DROP POLICY IF EXISTS "Requester or target can update live meeting requests"   ON live_meeting_requests;
DROP POLICY IF EXISTS "Requester can delete their live meeting requests"       ON live_meeting_requests;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: CREATE FIXED RLS POLICIES
-- The key fix: SELECT and UPDATE include a subquery that bridges
-- target_user_id (role_recipients.id) to auth.uid() via supabase_uid.
-- ═══════════════════════════════════════════════════════════════════════════════

-- SELECT: requester OR target (by auth uid OR by recipient uuid)
CREATE POLICY "Users can view their own live meeting requests"
  ON live_meeting_requests
  FOR SELECT
  USING (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  );

-- INSERT: only the requester can create
CREATE POLICY "Users can create live meeting requests as requester"
  ON live_meeting_requests
  FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()::text
  );

-- UPDATE: requester OR target can update (accept / decline / withdraw)
CREATE POLICY "Requester or target can update live meeting requests"
  ON live_meeting_requests
  FOR UPDATE
  USING (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  )
  WITH CHECK (
    requester_id = auth.uid()::text
    OR target_user_id = auth.uid()::text
    OR target_user_id IN (
      SELECT id::text FROM role_recipients WHERE supabase_uid = auth.uid()
    )
  );

-- DELETE: only the requester can delete
CREATE POLICY "Requester can delete their live meeting requests"
  ON live_meeting_requests
  FOR DELETE
  USING (
    requester_id = auth.uid()::text
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: POST-DEPLOYMENT VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  pol RECORD;
  policy_count INT := 0;
  has_bridge BOOLEAN := FALSE;
  unlinked INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '  POST-DEPLOYMENT VERIFICATION';
  RAISE NOTICE '════════════════════════════════════════════════════';

  -- List all policies
  FOR pol IN
    SELECT policyname, cmd, qual::text as using_clause
    FROM pg_policies
    WHERE tablename = 'live_meeting_requests'
    ORDER BY cmd
  LOOP
    policy_count := policy_count + 1;
    RAISE NOTICE '  [%] % → %', pol.cmd, pol.policyname, LEFT(pol.using_clause, 80);
    IF pol.using_clause LIKE '%role_recipients%' THEN
      has_bridge := TRUE;
    END IF;
  END LOOP;

  -- Validate policy count
  IF policy_count = 4 THEN
    RAISE NOTICE '  ✓ Policy count: 4/4';
  ELSE
    RAISE WARNING '  ✗ Expected 4 policies, found %', policy_count;
  END IF;

  -- Validate subquery bridge
  IF has_bridge THEN
    RAISE NOTICE '  ✓ Subquery bridge: role_recipients.supabase_uid present';
  ELSE
    RAISE WARNING '  ✗ Subquery bridge NOT found in policies — fix was not applied correctly';
  END IF;

  -- Check supabase_uid coverage
  SELECT COUNT(*) INTO unlinked
  FROM role_recipients
  WHERE supabase_uid IS NULL AND is_active = TRUE;

  IF unlinked = 0 THEN
    RAISE NOTICE '  ✓ All active recipients have supabase_uid linked';
  ELSE
    RAISE WARNING '  ✗ % active recipient(s) still missing supabase_uid — they will NOT see requests sent to them', unlinked;
  END IF;

  -- Check realtime
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_meeting_requests'
  ) THEN
    RAISE NOTICE '  ✓ Realtime publication: enabled';
  ELSE
    RAISE WARNING '  ✗ Realtime NOT enabled for live_meeting_requests';
  END IF;

  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '  DEPLOYMENT COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════';
END $$;
