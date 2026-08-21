# 🚀 QUICK START - Fix Authentication & Email

## ✅ Email Service - FIXED
The email service is now working correctly. Test confirmed:
```
✅ Email sent successfully!
Email ID: 234bd7bd-a0f5-427b-a37f-bbe371251deb
Recipient: 22e51a6917@hitam.org
```

## 🔧 Authentication Fix - MANUAL STEP REQUIRED

Due to Supabase API limitations, the user sync must be done manually via SQL Editor.

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/lyyuslwdibcscpdfzeww
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Copy & Paste This SQL

```sql
-- Sync 5 Users from role_recipients to Supabase Auth
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
    
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = rec.email;
    
    IF v_user_id IS NULL THEN
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
      UPDATE auth.users
      SET encrypted_password = v_encrypted_password,
          updated_at = NOW()
      WHERE id = v_user_id;
      
      RAISE NOTICE 'Updated password for: % (ID: %)', rec.email, v_user_id;
    END IF;
    
    UPDATE public.role_recipients
    SET supabase_uid = v_user_id,
        updated_at = NOW()
    WHERE email = rec.email;
    
  END LOOP;
END $$;
```

### Step 3: Click "Run" Button

You should see output like:
```
NOTICE: Created user: 22e51a6917@hitam.org (ID: ...)
NOTICE: Created user: 22e51a6914@hitam.org (ID: ...)
...
Success. No rows returned
```

### Step 4: Verify Users Created

Run this query in SQL Editor:
```sql
SELECT 
  rr.email,
  rr.name,
  rr.role,
  rr.supabase_uid,
  au.email as auth_email,
  au.email_confirmed_at
FROM role_recipients rr
LEFT JOIN auth.users au ON rr.supabase_uid = au.id
WHERE rr.email IN (
  '22e51a6917@hitam.org',
  '22e51a6914@hitam.org',
  '22e51a6903@hitam.org',
  'programhead.cse@hitam.org',
  '22e51a6925@hitam.org'
);
```

All 5 rows should show:
- ✅ `supabase_uid` populated
- ✅ `auth_email` matches `email`
- ✅ `email_confirmed_at` has a timestamp

### Step 5: Test Login

Run from backend directory:
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

### Step 6: Test Frontend Login

1. Open: https://app.iaoms.dev (or http://localhost:5173)
2. Click **Sign in with HITAM ID**
3. Test credentials:

| Email | Password | Role |
|-------|----------|------|
| 22e51a6917@hitam.org | Principal@123 | Principal |
| 22e51a6914@hitam.org | HOD@123 | HOD |
| 22e51a6903@hitam.org | Registrar@123 | Registrar |
| programhead.cse@hitam.org | ProgramHead@123 | Program Head |
| 22e51a6925@hitam.org | Employee@123 | Employee |

---

## 📧 Test Email Notifications

After successful login:

1. Login as Principal (22e51a6917@hitam.org)
2. Submit a test document
3. Check email inbox for notification
4. Email should arrive within 1-2 minutes

---

## ✅ What Was Fixed

### 1. Email Service ✅ COMPLETE
- Removed quotes from `RESEND_API_KEY` in `.env`
- Email service now initializes correctly
- Test email sent successfully to 22e51a6917@hitam.org

### 2. Authentication 🔄 REQUIRES MANUAL SQL
- SQL migration created: `supabase/migrations/20260414_sync_five_users.sql`
- Must be run manually via Supabase Dashboard SQL Editor
- Creates/updates 5 users in `auth.users` with correct passwords
- Links users to `role_recipients` via `supabase_uid`

---

## 🆘 Troubleshooting

### Login still fails after SQL execution
1. Clear browser cache and cookies
2. Verify SQL ran successfully (check for NOTICE messages)
3. Run verification query (Step 4 above)
4. Check `supabase_uid` is populated in `role_recipients`

### Email not received
1. Check spam/junk folder
2. Verify domain verified in Resend: https://resend.com/domains
3. Check Resend logs: https://resend.com/logs
4. Run: `node backend/test-email.js`

---

## 📁 Files Created

- ✅ `backend/.env` - Fixed RESEND_API_KEY (removed quotes)
- ✅ `supabase/migrations/20260414_sync_five_users.sql` - User sync migration
- ✅ `backend/test-login.js` - Login verification script
- ✅ `backend/test-email.js` - Email service test script
- ✅ `docs/deployment/DEPLOYMENT_FIX_GUIDE.md` - Comprehensive deployment guide
- ✅ `docs/troubleshooting/QUICK_START_FIX.md` - This file

---

**Status:** Email ✅ | Authentication 🔄 (Manual SQL Required)
