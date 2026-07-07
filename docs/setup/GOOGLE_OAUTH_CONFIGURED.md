# Google OAuth Configuration

## Your Credentials

**Client ID**: `YOUR_CLIENT_ID_HERE.apps.googleusercontent.com`
**Client Secret**: `YOUR_CLIENT_SECRET_HERE`
**Redirect URI**: `http://localhost:3001/api/auth/google/callback`

---

## Setup Steps (1 minute)

### Step 1: Add to Environment

1. Open `backend/.env`
2. Add or update the following:
   ```env
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
   ```

### Step 2: Verify Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, verify it includes:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
4. If not, add it and click **Save**

### Step 3: Test

```bash
npm run dev
```
Click "Log in with Google" - should work now!

---

## What's Configured

- Google OAuth Client ID
- Google OAuth Client Secret
- Redirect URI configured
- Auth service ready
- Login button integrated

---

## Expected Flow

```
User clicks "Log in with Google"
    |
Redirects to Google OAuth
    |
User selects Google account
    |
Google redirects to: /api/auth/google/callback
    |
Backend creates JWT session
    |
User redirected to /dashboard
    |
Logged in!
```

---

## Optional: Restrict to @hitam.org

Configure domain restriction in the backend authentication logic to only allow @hitam.org emails.

---

## Status

- Credentials provided
- Environment configured
- Ready to test login
