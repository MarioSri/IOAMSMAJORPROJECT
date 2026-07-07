# 🔧 Authentication & Email Fix - Deployment Guide

## Overview
This guide fixes two critical issues:
1. **Invalid credentials** error for 5 HITAM users
2. **Email delivery failures** due to misconfigured API key

## Files Modified/Created

### ✅ Created Files
- `supabase/migrations/20260414_sync_five_users.sql` - Syncs 5 users to Supabase Auth
- `backend/test-login.js` - Tests authentication for all 5 users
- `backend/test-email.js` - Tests Resend email service

### ✅ Modified Files
- `backend/.env` - Fixed RESEND_API_KEY format (removed quotes)

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard
2. Select your project: `lyyuslwdibcscpdfzeww`
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy the contents of `supabase/migrations/20260414_sync_five_users.sql`
6. Paste and click **Run**
7. Verify output shows 5 users created/updated

**Option B: Via Supabase CLI**
```bash
cd "d:\IAOMS-BCXN - Copy (7)\IAOMS-MAIN"
supabase db push
```

### Step 2: Restart Backend Server

The .env file has been updated, so restart the backend to reload environment variables:

```bash
cd backend
# Stop the current backend process (Ctrl+C if running)
npm run dev
```

Or if using the start script:
```bash
cd "d:\IAOMS-BCXN - Copy (7)\IAOMS-MAIN"
.\scripts\START_BACKEND.bat
```

### Step 3: Test Authentication

Run the login test script:
```bash
cd backend
node test-login.js
```

**Expected Output:**
```
============================================================
Testing Login for 5 HITAM Users
============================================================

✅ Principal              (22e51a6917@hitam.org)
   User ID: <uuid>

✅ HOD                    (22e51a6914@hitam.org)
   User ID: <uuid>

✅ Registrar              (22e51a6903@hitam.org)
   User ID: <uuid>

✅ Program Head           (programhead.cse@hitam.org)
   User ID: <uuid>

✅ Employee               (22e51a6925@hitam.org)
   User ID: <uuid>

============================================================
Results: 5 successful, 0 failed
============================================================
```

### Step 4: Test Email Service

Run the email test script:
```bash
cd backend
node test-email.js
```

**Expected Output:**
```
============================================================
Testing Resend Email Service
============================================================

1. Checking API Key Configuration:
   ✅ API Key format valid: re_Ct28V5...

2. Initializing Resend Client:
   ✅ Resend client initialized

3. Sending Test Email:
   ✅ Email sent successfully!
   Email ID: <resend-id>
   Recipient: 22e51a6917@hitam.org
   From: notifications@iaoms.dev

============================================================
✅ All Email Tests Passed
============================================================
```

### Step 5: Manual Login Verification

Test login via the frontend:

1. Open https://app.iaoms.dev (or http://localhost:5173)
2. Click **Sign in with HITAM ID**
3. Test each user:

| Email | Password | Role |
|-------|----------|------|
| 22e51a6917@hitam.org | Principal@123 | Principal |
| 22e51a6914@hitam.org | HOD@123 | HOD |
| 22e51a6903@hitam.org | Registrar@123 | Registrar |
| programhead.cse@hitam.org | ProgramHead@123 | Program Head |
| 22e51a6925@hitam.org | Employee@123 | Employee |

### Step 6: Test Email Notifications

1. Login as Principal (22e51a6917@hitam.org)
2. Submit a test document
3. Check the Principal's email inbox for notification
4. Verify email arrives within 1-2 minutes

---

## 🔍 Troubleshooting

### Issue: Migration fails with "relation does not exist"
**Solution:** Ensure you're running the migration on the correct Supabase project. Check `SUPABASE_URL` in `.env`.

### Issue: Login still fails after migration
**Solution:** 
1. Verify migration ran successfully (check Supabase logs)
2. Clear browser cache and cookies
3. Check that `supabase_uid` is populated in `role_recipients` table:
   ```sql
   SELECT email, supabase_uid FROM role_recipients 
   WHERE email IN ('22e51a6917@hitam.org', '22e51a6914@hitam.org');
   ```

### Issue: Email test fails with "Invalid API key"
**Solution:**
1. Verify `.env` has no quotes: `RESEND_API_KEY=re_...` (not `'re_...'`)
2. Restart backend after .env changes
3. Check API key is valid in Resend dashboard

### Issue: Email sent but not received
**Solution:**
1. Check spam/junk folder
2. Verify domain `iaoms.dev` is verified in Resend dashboard
3. Check Resend logs: https://resend.com/logs
4. Run diagnostic: `node backend/scratch/diagnose_emails.js`

---

## 📊 Verification Checklist

- [ ] Migration executed successfully (5 users created/updated)
- [ ] Backend restarted with updated .env
- [ ] `test-login.js` shows 5/5 successful logins
- [ ] `test-email.js` sends email successfully
- [ ] Manual login works for all 5 users via frontend
- [ ] Email notification received in inbox
- [ ] No errors in backend console logs

---

## 🎯 What Was Fixed

### Authentication Fix
- Created/updated 5 users in `auth.users` table
- Hashed passwords using bcrypt (matching role_recipients)
- Created email identities in `auth.identities`
- Linked `supabase_uid` in `role_recipients` table

### Email Fix
- Removed extra quotes from `RESEND_API_KEY` in `.env`
- API key now properly recognized by Resend client
- Email service initializes correctly on backend startup

---

## 📝 Next Steps

After successful deployment:

1. **Monitor Email Delivery**: Check `notifications` table for `email_sent` status
2. **Test All Roles**: Verify each role can submit/approve documents
3. **Check Notification Preferences**: Ensure users can manage email preferences
4. **Production Monitoring**: Set up alerts for failed email deliveries

---

## 🆘 Support

If issues persist:
1. Check backend logs: `backend/error.log` and `backend/info.log`
2. Run diagnostics: `node backend/scratch/diagnose_emails.js`
3. Verify Supabase Auth users: Dashboard → Authentication → Users
4. Check Resend logs: https://resend.com/logs

---

**Last Updated:** 2026-04-14  
**Status:** Ready for Deployment ✅
