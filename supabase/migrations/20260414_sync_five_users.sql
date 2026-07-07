-- =========================================================================
-- Sync 5 Specific Users from role_recipients to Supabase Auth
-- Creates missing users and syncs passwords to fix "Invalid credentials"
-- =========================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
  rec RECORD;
BEGIN
  -- Process each of the 5 users
  FOR rec IN 
    SELECT email, password, name, employee_id
    FROM public.role_recipients
    WHERE email IN (
      '22e51a6917@hitam.org',
      '22e51a6914@hitam.org', 
      '22e51a6903@hitam.org',
      'programhead.cse@hitam.org',
      '22e51a6925@hitam.org'
    )
  LOOP
    -- Hash the password
    v_encrypted_password := crypt(rec.password, gen_salt('bf'));
    
    -- Check if user exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = rec.email;
    
    IF v_user_id IS NULL THEN
      -- Create new user
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        rec.email,
        v_encrypted_password,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', rec.name, 'employee_id', rec.employee_id),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      )
      RETURNING id INTO v_user_id;
      
      -- Create identity
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', rec.email, 'name', rec.name),
        'email',
        rec.email,
        NOW(),
        NOW(),
        NOW()
      );
      
      RAISE NOTICE 'Created user: % (ID: %)', rec.email, v_user_id;
    ELSE
      -- Update existing user password
      UPDATE auth.users
      SET encrypted_password = v_encrypted_password,
          updated_at = NOW()
      WHERE id = v_user_id;
      
      RAISE NOTICE 'Updated password for: % (ID: %)', rec.email, v_user_id;
    END IF;
    
    -- Link to role_recipients
    UPDATE public.role_recipients
    SET supabase_uid = v_user_id,
        updated_at = NOW()
    WHERE email = rec.email;
    
  END LOOP;
END $$;
