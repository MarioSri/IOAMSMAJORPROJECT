# 🔧 COMPLETE FIX GUIDE - Web Push Notifications & Port Conflicts

## ✅ FIXES APPLIED

### 1. Port Conflicts (FIXED ✓)
- Changed Vite from port 8080 → 5173
- Killed blocking processes on ports 8080 and 3001
- Updated `vite.config.ts` with proper port configuration

### 2. Backend Validation (FIXED ✓)
- Improved `registerDevice` validation logic
- Added detailed error logging
- Better error messages for debugging

### 3. Database Schema (NEEDS YOUR ACTION ⚠️)
**This is the root cause of the 500 error!**

The `user_devices` table is missing the `push_keys` column required for Web Push.

## 🚀 APPLY THE DATABASE FIX

### Option 1: Supabase Dashboard (RECOMMENDED)

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `lyyuslwdibcscpdfzeww`
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_keys JSONB;

COMMENT ON COLUMN public.user_devices.push_keys IS 'Web Push subscription keys: { p256dh: string, auth: string }';
```

6. Click **Run** (or press Ctrl+Enter)
7. You should see: "Success. No rows returned"

### Option 2: Use the SQL File

Open the file `FIX-WEB-PUSH.sql` in this directory and run it in Supabase SQL Editor.

## 🧪 VERIFY THE FIX

After applying the database migration:

1. Restart your dev server:
   ```powershell
   npm run dev
   ```

2. Open your browser to: http://localhost:5173

3. Open DevTools Console (F12)

4. Look for these success messages:
   - `[WebPush] Using VAPID key from environment variable`
   - `[WebPush] Subscription registered successfully.`

5. Check the backend logs for:
   - `[RegisterDevice] Success for user: <user-id>`

## 📋 WHAT WAS FIXED

### Files Modified:
1. ✅ `vite.config.ts` - Changed port to 5173
2. ✅ `backend/src/controllers/notificationController.ts` - Better validation & logging

### Files Created:
1. 📄 `FIX-WEB-PUSH.sql` - Database migration (run this!)
2. 📄 `supabase/migrations/20260320_add_push_keys_to_user_devices.sql` - Migration file
3. 📄 `fix-push-keys.ts` - Alternative fix script (optional)

## 🎯 EXPECTED RESULTS

After applying the database fix:

✅ Web Push notifications will register successfully
✅ No more 500 errors on `/api/notifications/devices/register`
✅ Passkey/WebAuthn will work (already configured correctly)
✅ Port conflicts resolved (Vite on 5173, Backend on 3001)

## 🔍 TROUBLESHOOTING

### Still getting 500 errors?

1. Check backend logs for detailed error messages
2. Verify the `push_keys` column exists:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'user_devices';
   ```

3. Check if you're authenticated:
   - Open DevTools → Application → Local Storage
   - Look for Supabase auth token

### Backend not starting?

1. Make sure ports are free:
   ```powershell
   netstat -ano | findstr ":5173 :3001"
   ```

2. If ports are busy, kill the processes:
   ```powershell
   Get-NetTCPConnection -LocalPort 5173,3001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   ```

## 📞 SUPPORT

If you still have issues after applying the database fix:
1. Check the backend console logs
2. Check the browser DevTools console
3. Verify your `.env` files have the correct VAPID keys

---

**IMPORTANT:** You MUST run the SQL migration in Supabase for Web Push to work!
