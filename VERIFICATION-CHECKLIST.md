# ✅ VERIFICATION CHECKLIST

Run through this checklist to ensure everything is working:

## 1. Database Migration ✓

- [ ] Opened Supabase Dashboard
- [ ] Ran the SQL from `FIX-WEB-PUSH.sql`
- [ ] Saw "Success. No rows returned" message
- [ ] Verified column exists with this query:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'user_devices' AND column_name = 'push_keys';
  ```

## 2. Server Configuration ✓

- [ ] Vite is configured to use port 5173 (check `vite.config.ts`)
- [ ] Backend is configured to use port 3001 (check `backend/.env`)
- [ ] No processes blocking ports 5173 or 3001

## 3. Environment Variables ✓

### Frontend `.env`:
- [ ] `VITE_VAPID_PUBLIC_KEY` is set
- [ ] `VITE_BACKEND_URL=http://localhost:3001`
- [ ] `VITE_API_URL=/api`

### Backend `backend/.env`:
- [ ] `VAPID_PUBLIC_KEY` matches frontend
- [ ] `VAPID_PRIVATE_KEY` is set
- [ ] `VAPID_SUBJECT=mailto:noreply@iaoms.dev`
- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `FRONTEND_URL` includes `http://localhost:5173`

## 4. Start the Application ✓

```powershell
npm run dev
```

Expected output:
```
[0] VITE v5.x.x ready in xxx ms
[0] ➜ Local: http://localhost:5173/
[1] Server running on port 3001
[1] API Documentation available at http://localhost:3001/api-docs
```

## 5. Test Web Push Registration ✓

1. Open browser to: http://localhost:5173
2. Open DevTools Console (F12)
3. Log in to your account
4. Look for these messages:

**Frontend Console:**
```
[WebPush] Using VAPID key from environment variable
[WebPush] New push subscription created
[WebPush] Subscription registered successfully.
```

**Backend Console:**
```
[RegisterDevice] Registering device for user: <uuid> endpoint: https://...
[RegisterDevice] Inserting new device for user: <uuid>
[RegisterDevice] Success for user: <uuid>
```

## 6. Verify in Database ✓

Run this query in Supabase SQL Editor:
```sql
SELECT 
  id,
  user_id,
  device_type,
  push_keys,
  created_at,
  last_seen
FROM public.user_devices
ORDER BY created_at DESC
LIMIT 5;
```

You should see:
- Your user_id
- device_type: 'web'
- push_keys: `{"auth": "...", "p256dh": "..."}`
- Recent timestamps

## 7. Test Passkey/WebAuthn ✓

1. Go to Settings → Security
2. Try to register a passkey
3. Should work without errors

Expected backend `.env` values:
- `WEBAUTHN_RP_ID=app.iaoms.dev`
- `WEBAUTHN_RP_NAME=IAOMS`
- `WEBAUTHN_ORIGIN=https://app.iaoms.dev`

## 8. Test Notifications ✓

### Test In-App Notification:
1. Trigger any action that creates a notification
2. Check the notification bell icon
3. Should see the notification appear

### Test Web Push:
1. Make sure browser notifications are allowed
2. Trigger a notification (e.g., document approval request)
3. Should see a browser notification popup

## 🎉 SUCCESS CRITERIA

All of these should be true:
- ✅ No 500 errors in browser console
- ✅ No errors in backend logs
- ✅ Device registered in `user_devices` table
- ✅ Web Push notifications appear
- ✅ Passkeys work correctly
- ✅ Ports 5173 and 3001 are in use by your app

## ❌ COMMON ISSUES

### "Port already in use"
```powershell
Get-NetTCPConnection -LocalPort 5173,3001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### "Column push_keys does not exist"
- You didn't run the SQL migration
- Go back to step 1 and run `FIX-WEB-PUSH.sql`

### "Invalid token" or 401 errors
- Clear browser cache and local storage
- Log out and log back in
- Check that Supabase auth is working

### "VAPID key unavailable"
- Check that `VITE_VAPID_PUBLIC_KEY` is in frontend `.env`
- Restart the dev server after changing `.env`

---

**If all checks pass, you're done! 🎊**
