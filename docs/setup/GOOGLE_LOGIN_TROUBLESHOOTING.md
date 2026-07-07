# Google Login Troubleshooting

## Google Login IS There!

The Google login button exists in your app. Here's where to find it:

### Location on Login Page:
1. **Toggle Buttons**: "Google" and "HITAM ID" (top of form)
2. **Login Button**: "Log in with Google (@hitam.org)" (when Google is selected)

---

## How to Use Google Login

### Step 1: Select Role
- Choose: Principal, Registrar, HOD, Program Head, or Employee

### Step 2: Select Google Method
- Click the **"Google"** button (should be blue/highlighted by default)

### Step 3: Click Login
- Click **"Log in with Google (@hitam.org)"** button
- Should redirect to Google OAuth

---

## If Button Doesn't Work

### Check 1: Browser Console
Press F12 and check for errors:
```javascript
// Look for:
- "signInWithGoogle is not a function" - auth service issue
- Network errors - backend not running
- No errors - good
```

### Check 2: Environment Variables
Verify `backend/.env` file has:
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

### Check 3: Restart Dev Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

---

## Visual Guide

```
+-------------------------------------+
|         IAOMS Login                 |
|  Hyderabad Institute of Technology  |
+-------------------------------------+
|                                     |
|  Select Your Role:                  |
|  [Choose your role... v]            |
|                                     |
|  +---------+  +---------+          |
|  | Google  |  | HITAM ID|  <- Toggle|
|  +---------+  +---------+          |
|                                     |
|  +-----------------------------+   |
|  | Log in with Google          |   | <- Click this
|  | (@hitam.org)                |   |
|  +-----------------------------+   |
|                                     |
|  Only @hitam.org email addresses    |
|  are allowed                        |
+-------------------------------------+
```

---

## Expected Flow

1. **Select Role** -> Button enabled
2. **Click "Log in with Google"** -> Redirects to Google
3. **Select Google Account** -> OAuth consent
4. **Approve** -> Redirects back to app
5. **Logged In** -> Dashboard appears

---

## Common Issues

### Issue: Button is Grayed Out
**Cause**: No role selected
**Fix**: Select a role from dropdown first

### Issue: Button Does Nothing
**Cause**: Backend not running or Google OAuth not configured
**Fix**: Ensure backend is running and `.env` has valid Google OAuth credentials

### Issue: "Invalid OAuth Client"
**Cause**: Wrong credentials in `.env`
**Fix**: Re-enter Client ID and Secret in `backend/.env`

### Issue: Redirects to Error Page
**Cause**: Redirect URI mismatch
**Fix**: Add `http://localhost:3001/api/auth/google/callback` to Google Cloud Console

---

## Still Not Working?

1. Clear browser cache
2. Try incognito/private window
3. Check backend console logs for errors
4. Verify Google OAuth is enabled in Google Cloud Console

---

**The button IS there - it's the "Log in with Google (@hitam.org)" button!**
