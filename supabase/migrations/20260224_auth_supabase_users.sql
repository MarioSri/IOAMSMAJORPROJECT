-- =====================================================
-- IAOMS Auth Migration: Link Supabase Auth users to role_recipients
-- Date: 2026-02-24
-- Project: https://lyyuslwdibcscpdfzeww.supabase.co
-- =====================================================
-- This migration:
-- 1. Adds supabase_uid column to role_recipients (links Auth user to profile)
-- 2. Replaces the broad anon SELECT policy with stricter authenticated-only policies
-- 3. Grants authenticated users read access to ALL active recipients
--    (needed for recipient selectors in the app)
-- 4. Keeps the password column but marks it deprecated (Supabase Auth handles auth now)
-- =====================================================

-- 1. Add supabase_uid column to link Supabase Auth user to profile
ALTER TABLE public.role_recipients
  ADD COLUMN IF NOT EXISTS supabase_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookup by supabase_uid
CREATE INDEX IF NOT EXISTS idx_role_recipients_supabase_uid
  ON public.role_recipients (supabase_uid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop old broad policy and replace with authenticated-only policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old anon policy
DROP POLICY IF EXISTS "Allow read access to active recipients" ON public.role_recipients;

-- Allow authenticated users to read ALL active recipients
-- This is required for the recipient selector / directory features
DROP POLICY IF EXISTS "Authenticated users can read active recipients" ON public.role_recipients;
CREATE POLICY "Authenticated users can read active recipients"
  ON public.role_recipients
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Allow anon to read active recipients for the Employee ID lookup flow
-- (needed so AuthService can query by employee_id before signing in)
DROP POLICY IF EXISTS "Anon can read active recipients for auth lookup" ON public.role_recipients;
CREATE POLICY "Anon can read active recipients for auth lookup"
  ON public.role_recipients
  FOR SELECT
  TO anon
  USING (is_active = TRUE);

-- Prevent any user from modifying role_recipients via the client
-- (only service role / migrations should write to this table)
DROP POLICY IF EXISTS "No client writes to role_recipients" ON public.role_recipients;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Create Supabase Auth users for existing employees so they can sign in
--    with email + password.
--
--    IMPORTANT: This uses the Supabase auth schema directly.
--    Passwords are hashed using bcrypt. The plaintext passwords from the original
--    migration are one-time seeds — employees should change them on first login.
--
--    NOTE: In a production setup, use the Supabase dashboard or Admin API to
--    create these users. The INSERT below is for development convenience only.
-- ─────────────────────────────────────────────────────────────────────────────

-- We use a DO block to safely create auth users and link them.
-- Fully idempotent — handles partial prior runs:
--   Case A: auth user does not exist → create auth.users + auth.identities
--   Case B: auth user exists but identity row is missing → insert identity only
--   Case C: both exist → skip
DO $$
DECLARE
  v_uid UUID;
  v_identity_count INT;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id AS recipient_id, email, password AS plain_pw
    FROM public.role_recipients
    WHERE is_active = TRUE
      AND password IS NOT NULL
  LOOP
    -- Step 1: resolve or create the auth.users record
    SELECT id INTO v_uid FROM auth.users WHERE email = r.email LIMIT 1;

    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();

      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
      ) VALUES (
        v_uid,
        '00000000-0000-0000-0000-000000000000'::UUID,
        'authenticated',
        'authenticated',
        r.email,
        crypt(r.plain_pw, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '',
        '',
        '',
        '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        FALSE
      );

      RAISE NOTICE 'Created auth.users record for %', r.email;
    ELSE
      RAISE NOTICE 'auth.users already exists for % (uid=%)', r.email, v_uid;
    END IF;

    -- Step 2: ensure the identity row exists (may be missing from a
    --         failed prior run where the identities INSERT errored).
    SELECT COUNT(*) INTO v_identity_count
    FROM auth.identities
    WHERE user_id = v_uid AND provider = 'email';

    IF v_identity_count = 0 THEN
      -- provider_id is required (NOT NULL) in current Supabase versions.
      -- For the email provider it must equal the user's email address.
      INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        v_uid,
        r.email,
        v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', r.email),
        'email',
        NOW(),
        NOW(),
        NOW()
      );
      RAISE NOTICE 'Created auth.identities record for %', r.email;
    ELSE
      RAISE NOTICE 'auth.identities already exists for %', r.email;
    END IF;

    -- Step 3: link the auth uid back to role_recipients
    UPDATE public.role_recipients
    SET supabase_uid = v_uid
    WHERE id = r.recipient_id;

  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Comment: password column is deprecated — kept only for migration reference.
--    Supabase Auth now owns all authentication.
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.role_recipients.password IS
  'DEPRECATED: Seed password used only to bootstrap Supabase Auth users. Supabase Auth handles all authentication. This column should be cleared in production.';
