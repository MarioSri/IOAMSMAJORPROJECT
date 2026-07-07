# Quick Start: Google Drive + Supabase Integration

## ✅ What's Been Implemented

### 1. Database Schema
- **Location**: `supabase/migrations/20240120_google_drive_integration.sql`
- **Tables Created**:
  - `documents` - Main document records
  - `document_files` - Google Drive file metadata
  - `document_workflows` - Workflow state
  - `workflow_steps` - Individual approval steps
  - `document_approvals` - Approval history
  - `document_comments` - Comments and shared notes

### 2. Services Created
- **GoogleDriveService.ts** - Handles file upload, permissions, deletion
- **DocumentService.ts** - Document CRUD with Google Drive integration
- **WorkflowService.ts** - Workflow management and routing
- **ApprovalService.ts** - Approval/rejection handling

### 3. Updated Components
- **Documents.tsx** - Now supports both Supabase and localStorage
  - Automatically detects if Supabase is configured
  - Falls back to localStorage if not configured
  - No breaking changes to existing functionality

## 🚀 How to Enable

### Step 1: Setup Supabase (5 minutes)

1. Go to https://supabase.com and create account
2. Create new project
3. Copy your project URL and anon key
4. Go to SQL Editor in Supabase dashboard
5. Copy contents of `supabase/migrations/20240120_google_drive_integration.sql`
6. Paste and run in SQL Editor
7. Go to Database → Replication
8. Enable realtime for all 6 tables

### Step 2: Setup Google Drive API (10 minutes)

1. Go to https://console.cloud.google.com
2. Create new project (or select existing)
3. Enable "Google Drive API"
4. Go to Credentials → Create Credentials
5. Create API Key → Copy it
6. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:5173`
   - Copy Client ID
7. Go to OAuth consent screen:
   - Add scope: `https://www.googleapis.com/auth/drive.file`
   - Add test users (your email)

### Step 3: Configure Environment

Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

VITE_GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE
VITE_GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
VITE_GOOGLE_APP_ID=123456789
```

### Step 4: Restart Dev Server

```bash
npm run dev
```

## 🎯 How It Works

### Document Submission Flow

**With Supabase Configured:**
```
User submits document
    ↓
Files uploaded to Google Drive
    ↓
File URLs stored in Supabase
    ↓
Workflow created in Supabase
    ↓
Recipients notified
    ↓
Real-time updates via Supabase
```

**Without Supabase (Fallback):**
```
User submits document
    ↓
Files converted to base64
    ↓
Stored in localStorage
    ↓
CustomEvents for updates
    ↓
(Existing behavior - no changes)
```

### Approval Flow

**With Supabase:**
```
User approves document
    ↓
Approval recorded in Supabase
    ↓
Workflow advances automatically
    ↓
Next recipient notified
    ↓
All users see real-time updates
```

## 🔍 Testing

### Test 1: Check if Supabase is Connected

Open browser console and run:
```javascript
const { data, error } = await supabase.from('documents').select('count')
console.log('Supabase connected:', !error)
```

### Test 2: Test Google Drive Upload

1. Submit a document with files
2. Check browser console for "Google Drive" messages
3. Go to https://drive.google.com
4. Files should appear in "My Drive"

### Test 3: Test Workflow

1. Submit document as User A
2. Open Approvals page as User B (recipient)
3. Document should appear in pending approvals
4. Approve document
5. Check if workflow advances

## 📊 Monitoring

### Check Supabase Data

Go to Supabase Dashboard → Table Editor:
- `documents` - See all submitted documents
- `document_files` - See Google Drive file links
- `document_workflows` - See workflow progress
- `workflow_steps` - See individual steps

### Check Google Drive

Go to https://drive.google.com:
- All uploaded files appear in "My Drive"
- Click file → Share → See recipient permissions

## 🔧 Troubleshooting

### "Supabase not configured" message
- Check `.env` file exists
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
- Restart dev server

### "Google Drive authentication failed"
- Check VITE_GOOGLE_CLIENT_ID is correct
- Verify OAuth consent screen is configured
- Add your email as test user
- Clear browser cache

### Files not uploading
- Check Google Drive API is enabled
- Verify API key is correct
- Check browser console for errors

### Workflow not advancing
- Check Supabase RLS policies
- Verify workflow_steps table has data
- Check browser console for errors

## 🎉 Benefits

### Before (localStorage only)
- ❌ Data lost on browser clear
- ❌ No multi-device support
- ❌ No real-time updates
- ❌ Limited file storage (5-10MB)
- ❌ No audit trail

### After (Supabase + Google Drive)
- ✅ Data persists forever
- ✅ Access from any device
- ✅ Real-time updates for all users
- ✅ Unlimited file storage
- ✅ Complete audit trail
- ✅ Professional file management

## 📝 Next Steps

1. **Enable Supabase Realtime** (Phase 2)
   - Create realtime hooks
   - Remove CustomEvents
   - Auto-update UI on changes

2. **Migrate Existing Data** (Phase 3)
   - Export localStorage data
   - Import to Supabase
   - Clean up localStorage

3. **Add Advanced Features** (Phase 4)
   - File version history
   - Bulk operations
   - Advanced search
   - Analytics dashboard

## 💡 Important Notes

- **Backward Compatible**: System works with or without Supabase
- **No Breaking Changes**: All existing features continue to work
- **Gradual Migration**: Can enable Supabase without disrupting users
- **Card Creation UI**: All document submission forms remain unchanged

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify environment variables
3. Check Supabase dashboard for data
4. Review setup steps above

---

**Status**: ✅ Ready to use
**Fallback**: ✅ localStorage still works
**Breaking Changes**: ❌ None
