# Google Authentication Setup

## Quick Setup (5 minutes)

### Step 1: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** -> **Create Credentials** -> **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add Authorized redirect URIs:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
7. Copy **Client ID** and **Client Secret**
8. Add them to your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

### Step 2: Configure Email Domain (Optional)

To restrict to @hitam.org emails only, configure domain validation in the backend authentication logic.

### Step 3: Test

1. Restart your app: `npm run dev`
2. Click "Log in with Google"
3. Select Google account
4. Should redirect to dashboard

---

## How It Works

```
User clicks "Log in with Google"
    |
Redirects to Google OAuth consent screen
    |
User approves
    |
Google redirects back to: /api/auth/google/callback
    |
Backend creates JWT session
    |
User redirected to /dashboard
```

---

## Troubleshooting

### Error: "Invalid redirect URI"
**Fix**: Add redirect URI in Google Cloud Console:
```
http://localhost:3001/api/auth/google/callback
```

### Error: "Email domain not allowed"
**Fix**: Update the domain restriction in your backend authentication logic.

### Login button does nothing
**Fix**: 
1. Check browser console for errors
2. Verify Google OAuth credentials in `.env`
3. Check redirect URI is correct

### Stuck on loading screen
**Fix**:
1. Verify OAuth credentials are correct
2. Clear browser cache and try again

---

## Testing

### Test with Different Accounts
```
Test 1: @hitam.org email (should work)
Test 2: @gmail.com email (should fail if domain restricted)
Test 3: Cancel OAuth (should show error)
```

---

## Security Notes

1. **Never commit** Google OAuth credentials to git
2. Use **environment variables** for production
3. Set **session timeout** appropriately

---

## Status

- Auth service created
- Google OAuth integrated
- Error handling added
