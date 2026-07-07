-- =========================================================================
-- Fix Sync between Supabase Auth and role_recipients
-- Resolves "Invalid login credentials" by ensuring emails and passwords match
-- =========================================================================

DO $$
BEGIN
  -- 1. If supabase_uid is set, sync email from auth.users -> role_recipients
  -- This handles the case where user ID/email was updated in Supabase Auth
  -- but not pushed to the role_recipients table.
  UPDATE public.role_recipients r
  SET email = au.email
  FROM auth.users au
  WHERE r.supabase_uid = au.id
    AND r.email IS DISTINCT FROM au.email;

  -- 2. Link any unmatched recipients if the email matches
  UPDATE public.role_recipients r
  SET supabase_uid = au.id
  FROM auth.users au
  WHERE r.supabase_uid IS NULL
    AND r.email = au.email;

  -- 3. Force sync passwords from role_recipients -> auth.users
  -- This ensures that the password displayed in the SQL table matches
  -- the crypt() hashed password in Supabase Auth, preventing credential errors.
  UPDATE auth.users au
  SET encrypted_password = crypt(r.password, gen_salt('bf')),
      updated_at = NOW()
  FROM public.role_recipients r
  WHERE au.id = r.supabase_uid
    AND r.password IS NOT NULL;

  -- 4. Update the 'email' provider identity to match the current email
  UPDATE auth.identities ident
  SET provider_id = au.email,
      identity_data = jsonb_set(
        jsonb_set(COALESCE(ident.identity_data, '{}'::jsonb), '{email}', to_jsonb(au.email)),
        '{name}', to_jsonb(r.name)
      ),
      updated_at = NOW()
  FROM auth.users au
  JOIN public.role_recipients r ON r.supabase_uid = au.id
  WHERE ident.user_id = au.id AND ident.provider = 'email'
    AND (ident.provider_id IS DISTINCT FROM au.email OR ident.identity_data->>'email' IS DISTINCT FROM au.email);

END $$;
