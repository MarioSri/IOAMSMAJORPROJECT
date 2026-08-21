# 🎯 ACTION REQUIRED - Fix Authentication (5 Minutes)

## ✅ Email Service - ALREADY FIXED
Email notifications are now working. Test confirmed successful delivery.

## 🔧 Authentication - ONE MANUAL STEP REQUIRED

### STEP 1: Open Supabase SQL Editor
👉 **Click here:** https://supabase.com/dashboard/project/lyyuslwdibcscpdfzeww/sql/new

### STEP 2: Copy & Paste This SQL (Click "Run")

```sql
DO $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
  rec RECORD;
BEGIN
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
    v_encrypted_password := crypt(rec.password, gen_salt('bf'));
    
    SELECT id INTO v_user_id FROM auth.users WHERE email = rec.email;
    
    IF v_user_id IS NULL THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', rec.email, v_encrypted_password,
        NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', rec.name, 'employee_id', rec.employee_id),
        NOW(), NOW(), '', '', '', ''
      ) RETURNING id INTO v_user_id;
      
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', rec.email, 'name', rec.name),
        'email', rec.email, NOW(), NOW(), NOW()
      );
      
      RAISE NOTICE 'Created: %', rec.email;
    ELSE
      UPDATE auth.users
      SET encrypted_password = v_encrypted_password, updated_at = NOW()
      WHERE id = v_user_id;
      RAISE NOTICE 'Updated: %', rec.email;
    END IF;
    
    UPDATE public.role_recipients
    SET supabase_uid = v_user_id, updated_at = NOW()
    WHERE email = rec.email;
  END LOOP;
END $$;
```

### STEP 3: Verify Success
You should see 5 NOTICE messages like:
```
NOTICE: Created: 22e51a6917@hitam.org
NOTICE: Created: 22e51a6914@hitam.org
...
```

### STEP 4: Test Login
Open Command Prompt in backend folder and run:
```bash
node test-login.js
```

Expected output:
```
✅ Principal              (22e51a6917@hitam.org)
✅ HOD                    (22e51a6914@hitam.org)
✅ Registrar              (22e51a6903@hitam.org)
✅ Program Head           (programhead.cse@hitam.org)
✅ Employee               (22e51a6925@hitam.org)

Results: 5 successful, 0 failed
```

---

## 🎉 DONE!

Now test login at: https://app.iaoms.dev

### Test Credentials:
- **Principal:** 22e51a6917@hitam.org / Principal@123
- **HOD:** 22e51a6914@hitam.org / HOD@123
- **Registrar:** 22e51a6903@hitam.org / Registrar@123
- **Program Head:** programhead.cse@hitam.org / ProgramHead@123
- **Employee:** 22e51a6925@hitam.org / Employee@123

---

## 📧 Email Notifications
After login, submit a test document. Email notification will arrive within 1-2 minutes.

---

**Total Time:** 5 minutes  
**Files Modified:** 1 (.env - already done)  
**SQL Queries:** 1 (manual execution required)  
**Status:** ✅ Email Working | 🔄 Auth Ready (1 SQL query away)
