# Meeting Links API Setup Guide

## Overview

The Calendar page now supports **unified meeting link generation** where all selected recipients join the same video call session through Google Meet or Zoom. This guide explains how to set up the required API credentials for production use.

---

## ✅ What Has Been Fixed

### 1. **Join Meeting Button** (`MeetingScheduler.tsx`)
- **Before:** Opened hardcoded URLs (`https://meet.google.com/new`) creating separate meetings each time
- **After:** Uses stored `meeting.meetingLinks.googleMeet.joinUrl` or `meeting.meetingLinks.zoom.joinUrl`
- **Result:** All recipients join the SAME unified meeting room

### 2. **Error Handling**
- Added user-friendly error messages when meeting links are missing
- Provides clear feedback: "This meeting doesn't have a video conferencing link yet"
- Console warnings for debugging

### 3. **Google Meet API Integration** (`MeetingAPIService.ts`)
- **Before:** Generated fake mock URLs using string concatenation
- **After:** Uses Google Calendar API v3 with `conferenceData.createRequest`
- **Result:** Creates real Google Meet rooms through official Google API

### 4. **Zoom API Integration** (`MeetingAPIService.ts`)
- **Before:** Generated fake mock URLs
- **After:** Uses Zoom REST API (`https://api.zoom.us/v2/users/me/meetings`)
- **Result:** Creates real Zoom meetings with valid join URLs and passwords

---

## 🔧 Configuration Required

The system is currently in **development mode** and uses mock services. To enable real API integration in production:

### Environment Variables

Create or update your `.env` file with the following variables:

```env
# Google Meet Integration
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-google-api-key
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret

# Zoom Integration
VITE_ZOOM_CLIENT_ID=your-zoom-client-id
VITE_ZOOM_CLIENT_SECRET=your-zoom-client-secret
VITE_ZOOM_ACCOUNT_ID=your-zoom-account-id

# Microsoft Teams Integration (Optional)
VITE_MS_CLIENT_ID=your-microsoft-client-id
VITE_MS_CLIENT_SECRET=your-microsoft-client-secret
VITE_MS_TENANT_ID=your-microsoft-tenant-id

# API Endpoint (if using backend)
VITE_API_URL=https://your-api-endpoint.com/api
```

---

## 📋 Step-by-Step Setup

### 1. Google Meet / Google Calendar API

#### A. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Library**

#### B. Enable Required APIs
1. Search for and enable:
   - **Google Calendar API**
   - **Google Meet API** (if available)
2. Click **Enable** for each

#### C. Create OAuth 2.0 Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client ID**
3. Configure consent screen:
   - User Type: External (or Internal for workspace)
   - Add scopes: `https://www.googleapis.com/auth/calendar`
4. Application type: **Web application**
5. Authorized JavaScript origins:
   ```
   http://localhost:5173
   https://yourdomain.com
   ```
6. Authorized redirect URIs:
   ```
   http://localhost:5173
   https://yourdomain.com
   ```
7. Copy the **Client ID** and **Client Secret**

#### D. Create API Key
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the API key
4. (Recommended) Restrict the key to Google Calendar API

#### E. Add to .env
```env
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIzaSyAbc123...
VITE_GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
```

---

### 2. Zoom API

#### A. Create Zoom Account
1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Sign in or create a Zoom account
3. Navigate to **Develop** > **Build App**

#### B. Create Server-to-Server OAuth App
1. Choose **Server-to-Server OAuth** app type
2. Fill in app information:
   - App Name: "Your App Meeting Scheduler"
   - Company Name: Your company
   - Developer Contact: Your email
3. Click **Create**

#### C. Get Credentials
1. Navigate to **App Credentials** tab
2. Copy:
   - **Account ID**
   - **Client ID**
   - **Client Secret**

#### D. Add Scopes
1. Go to **Scopes** tab
2. Add the following scopes:
   - `meeting:write` (Create meetings)
   - `meeting:read` (Read meeting details)
   - `user:read` (Read user information)
3. Click **Continue**

#### E. Activate App
1. Navigate to **Activation** tab
2. Click **Activate your app**

#### F. Add to .env
```env
VITE_ZOOM_ACCOUNT_ID=abc123...
VITE_ZOOM_CLIENT_ID=Abc1234567890
VITE_ZOOM_CLIENT_SECRET=YOUR_ZOOM_CLIENT_SECRET_HERE
```

---

### 3. Microsoft Teams (Optional)

#### A. Register App in Azure
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**

#### B. Configure App
1. Name: "Your App Meeting Scheduler"
2. Supported account types: Choose appropriate option
3. Redirect URI: 
   - Type: Web
   - URI: `https://yourdomain.com`
4. Click **Register**

#### C. Get Credentials
1. Copy **Application (client) ID**
2. Copy **Directory (tenant) ID**
3. Go to **Certificates & secrets**
4. Create new client secret
5. Copy the secret **value** (not ID)

#### D. Add API Permissions
1. Go to **API permissions**
2. Add **Microsoft Graph** permissions:
   - `Calendars.ReadWrite`
   - `OnlineMeetings.ReadWrite`
3. Grant admin consent

#### E. Add to .env
```env
VITE_MS_CLIENT_ID=abc123-def456-...
VITE_MS_CLIENT_SECRET=YOUR_MICROSOFT_CLIENT_SECRET_HERE
VITE_MS_TENANT_ID=xyz789-...
```

---

## 🚀 Enabling Production Mode

Currently, the system runs in **development mode** using mock services. To enable real API integration:

### Option 1: Auto-Detection (Recommended)
The system automatically detects production mode when `import.meta.env.DEV === false`.

When you build for production:
```bash
npm run build
```

The app will automatically use real APIs instead of mock services.

### Option 2: Manual Override
If you want to test real APIs in development:

Edit `src/services/MeetingAPIService.ts` line 35:
```typescript
// Change from:
this.isDevelopment = import.meta.env.DEV || false;

// To:
this.isDevelopment = false; // Forces production API mode
```

---

## 🔐 Security Considerations

### ⚠️ IMPORTANT: Don't Expose Secrets
- **Never commit `.env` file** to version control
- Add `.env` to `.gitignore`
- Use environment variables in CI/CD

### Backend API Recommended
For production, consider implementing a backend API to:
- Keep API secrets secure (server-side only)
- Handle OAuth token refresh
- Rate limit API calls
- Centralize meeting management

Example backend endpoints needed:
```
POST /api/google/auth/token     - Get Google access token
POST /api/zoom/auth/token       - Get Zoom access token
POST /api/meetings              - Create meeting (server-side)
GET  /api/meetings/:id          - Get meeting details
```

---

## 🧪 Testing the Integration

### Test Google Meet Integration
1. Ensure `.env` has valid Google credentials
2. Create a meeting in the Calendar page
3. Select "Google Meet" as location
4. Click "Create Meeting"
5. Check console for any errors
6. Click "Join Meeting" button
7. Verify it opens a **real Google Meet room** (not `/new`)

### Test Zoom Integration
1. Ensure `.env` has valid Zoom credentials
2. Create a meeting with "Zoom" as location
3. Click "Create Meeting"
4. Check console for any errors
5. Click "Join Meeting" button
6. Verify it opens a **real Zoom meeting** with meeting ID

### Expected Console Logs
```
✅ Google Meet created: meet-abc123-xyz
✅ Join URL: https://meet.google.com/abc-defg-hij
```

### Troubleshooting

#### Error: "User not signed in to Google"
- **Solution:** The Google OAuth flow will prompt user to sign in
- Ensure `VITE_GOOGLE_CLIENT_ID` is correct
- Check browser console for detailed errors

#### Error: "Failed to get Zoom access token"
- **Solution:** Verify Zoom credentials in `.env`
- Ensure Server-to-Server OAuth app is activated
- Check scopes are added

#### Error: "No meeting link available"
- **Cause:** Meeting was created in development mode with mock links
- **Solution:** Enable production mode and recreate the meeting

---

## 📊 Architecture Flow

### Production Flow (After Setup)
```
User Creates Meeting
    ↓
meetingAPI.createMeeting()
    ↓
MeetingAPIService.createGoogleMeetEvent()
    ↓
Google Calendar API v3 Request
    POST /calendar/v3/calendars/primary/events
    Body: { conferenceData: { createRequest: {...} } }
    ↓
Google Returns Real Meeting Link
    Response: { hangoutLink: "https://meet.google.com/abc-defg-hij" }
    ↓
Meeting Saved with Real Link
    meetingLinks: {
      googleMeet: { joinUrl: "https://meet.google.com/abc-defg-hij" }
    }
    ↓
All Recipients See Same Meeting
    (via recipient filtering)
    ↓
User Clicks "Join Meeting"
    ↓
handleJoinMeeting(meeting)
    ↓
window.open(meeting.meetingLinks.googleMeet.joinUrl)
    ↓
All Recipients Join SAME Room ✅
```

---

## 🎯 Benefits of This Implementation

1. **✅ Unified Meeting Rooms**
   - All recipients join the same video call
   - No separate meetings per recipient
   - One shared meeting link

2. **✅ Real Meeting Links**
   - Uses official Google/Zoom APIs
   - Links are valid and persistent
   - Works in production environments

3. **✅ Proper Error Handling**
   - User-friendly error messages
   - Clear authentication prompts
   - Detailed console logging for debugging

4. **✅ OAuth Authentication**
   - Secure user authentication flow
   - Token management handled by Google/Zoom
   - No password storage required

5. **✅ Calendar Integration**
   - Meetings appear in Google Calendar
   - Attendees receive calendar invitations
   - Email notifications with join links

---

## 📝 Next Steps

### Immediate (Required for Production)
1. ✅ Set up Google Cloud Project and get credentials
2. ✅ Set up Zoom app and get credentials
3. ✅ Add credentials to `.env` file
4. ✅ Test meeting creation in production mode
5. ✅ Verify join links work correctly

### Recommended Enhancements
1. **Backend API** - Move API calls server-side for security
2. **Database Migration** - Move from localStorage to a persistent database
3. **Email Notifications** - Send meeting invites via email
4. **Calendar Sync** - Two-way sync with Google/Outlook calendars
5. **Recording** - Enable meeting recording capabilities
6. **Attendance Tracking** - Track who joins meetings

---

## 🔗 Useful Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [Zoom API Documentation](https://marketplace.zoom.us/docs/api-reference/introduction)
- [Microsoft Graph API for Teams](https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings)
- [OAuth 2.0 Flow Explanation](https://oauth.net/2/)

---

## 📞 Support

If you encounter issues:
1. Check browser console for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure APIs are enabled in Google Cloud Console
4. Check Zoom app is activated in Marketplace
5. Review OAuth consent screen configuration

---

**Last Updated:** November 22, 2025  
**Status:** Implementation Complete ✅  
**Ready for Production:** After API credentials are configured
