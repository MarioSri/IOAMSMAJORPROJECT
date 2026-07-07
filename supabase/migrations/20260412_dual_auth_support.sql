-- Enable dual authentication: Google Sign-In + HITAM ID/Password
-- Users can log in using either method without restrictions

-- Create RPC function to check user's authentication providers
CREATE OR REPLACE FUNCTION get_user_auth_providers(p_email TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT provider
    FROM auth.identities
    WHERE user_id = (SELECT id FROM auth.users WHERE email = p_email LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_user_auth_providers(TEXT) TO authenticated, anon;

-- Ensure all active users have email identity for password authentication
DO $$
DECLARE
  r RECORD;
  v_uid UUID;
  v_identity_count INT;
BEGIN
  FOR r IN
    SELECT id AS recipient_id, email, password AS plain_pw
    FROM public.role_recipients
    WHERE is_active = TRUE
      AND email IS NOT NULL
  LOOP
    -- Get the auth user ID
    SELECT id INTO v_uid FROM auth.users WHERE email = r.email LIMIT 1;
    
    IF v_uid IS NOT NULL THEN
      -- Check if email identity exists
      SELECT COUNT(*) INTO v_identity_count
      FROM auth.identities
      WHERE user_id = v_uid AND provider = 'email';
      
      -- Create email identity if missing
      IF v_identity_count = 0 AND r.plain_pw IS NOT NULL THEN
        INSERT INTO auth.identities (
          id, provider_id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          r.email,
          v_uid,
          jsonb_build_object('sub', v_uid::text, 'email', r.email),
          'email',
          NOW(), NOW(), NOW()
        );
        RAISE NOTICE 'Created email identity for %', r.email;
      END IF;
    END IF;
  END LOOP;
END $$;
