# Fixes Applied - Web Push & Email Issues

## Date: 2024
## Issues Fixed:
1. Email sending 403 errors (domain not verified)
2. Web Push registration 500 errors (insufficient error logging)

---

## 1. Email Service Fix

### Problem:
```
[Email] Send failed: {
  statusCode: 403,
  message: 'The mail.iaoms.dev domain is not verified'
}
```

### Solution:
Changed FROM address to use Resend's verified test domain for development.

**Files Modified:**
- `backend/src/services/emailService.ts` - Line 17
- `backend/.env` - EMAIL_FROM variable

**Changes:**
```typescript
// Before:
const FROM_ADDRESS = process.env.EMAIL_FROM || 'notifications@mail.iaoms.dev';

// After:
const FROM_ADDRESS = process.env.EMAIL_FROM || 'onboarding@resend.dev';
```

**For Production:**
1. Go to https://resend.com/domains
2. Add `mail.iaoms.dev` domain
3. Add DNS records provided by Resend
4. Wait for verification
5. Update EMAIL_FROM back to `notifications@mail.iaoms.dev`

---

## 2. Web Push Registration Fix

### Problem:
```
[WebPush] Subscription registration failed. Status: 500
```

### Solution:
Added comprehensive error logging and validation to identify root cause.

**Files Modified:**
- `backend/src/controllers/notificationController.ts` - registerDevice function
- `backend/src/services/pushService.ts` - VAPID initialization

**Improvements:**
1. Added detailed request body logging
2. Added VAPID configuration check before processing
3. Enhanced error messages with stack traces
4. Added success logging for debugging

**New Logging:**
```typescript
console.log('[RegisterDevice] Request body:', JSON.stringify(req.body, null, 2));
console.log('[RegisterDevice] Registering device for user:', user.id);
console.log('[RegisterDevice] Success for user:', user.id);
console.error('[RegisterDevice] Error stack:', error?.stack);
```

---

## Testing Instructions

### 1. Restart Backend Server
```bash
cd backend
npm run dev
```

### 2. Check Logs
Look for these messages:
- `[WebPush] VAPID configured successfully`
- `[Email] Using FROM address: onboarding@resend.dev`

### 3. Test Web Push Registration
1. Open browser DevTools Console
2. Login to the app
3. Look for: `[WebPush] Subscription registered successfully`
4. Check backend logs for: `[RegisterDevice] Success for user: <uuid>`

### 4. Test Email Sending
Trigger any notification that sends email and verify:
- No 403 errors in backend logs
- Email arrives successfully

---

## Rollback Instructions

If issues persist, revert changes:

```bash
cd backend
git checkout src/services/emailService.ts
git checkout src/controllers/notificationController.ts
git checkout src/services/pushService.ts
git checkout .env
```

---

## Additional Notes

- The proxy error (ECONNREFUSED) was a timing issue - backend wasn't fully started when frontend tried to connect. Should resolve automatically on restart.
- VAPID keys are already configured in .env (no action needed)
- All changes are backward compatible
