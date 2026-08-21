# Google Drive + Supabase Integration Setup Guide

## Overview
This system integrates Google Drive API for file storage and Supabase for metadata and workflow management.

## Architecture
```
User uploads file
    ↓
Google Drive API (file storage)
    ↓
Supabase (metadata + workflow)
    ↓
Supabase Realtime (live updates)
    ↓
UI updates automatically
```

## Setup Steps

### 1. Supabase Setup

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Click "New Project"
   - Note your project URL and anon key

2. **Run Database Migration**
   ```bash
   # Copy the SQL from supabase/migrations/20240120_google_drive_integration.sql
   # Run it in Supabase SQL Editor
   ```

3. **Enable Realtime**
   - Go to Database → Replication
   - Enable realtime for all tables:
     - documents
     - document_files
     - document_workflows
     - workflow_steps
     - document_approvals
     - document_comments

### 2. Google Drive API Setup

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project
   - Enable Google Drive API

2. **Create API Credentials**
   - Go to APIs & Services → Credentials
   - Create API Key (for Drive API)
   - Create OAuth 2.0 Client ID (for authentication)
   - Add authorized JavaScript origins:
     - http://localhost:5173 (development)
     - https://yourdomain.com (production)

3. **Configure OAuth Consent Screen**
   - Add scopes: `https://www.googleapis.com/auth/drive.file`
   - Add test users (for development)

### 3. Environment Configuration

Create `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

VITE_GOOGLE_API_KEY=your_api_key
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
VITE_GOOGLE_APP_ID=your_app_id
```

### 4. Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Usage

### Document Submission Flow

1. User selects files and fills form
2. System checks if Supabase is configured
3. If configured:
   - Uploads files to Google Drive
   - Sets file permissions for recipients
   - Stores metadata in Supabase
   - Creates workflow in Supabase
4. If not configured:
   - Falls back to localStorage (existing behavior)

### Approval Flow

1. User approves/rejects document
2. System records action in Supabase
3. Workflow advances automatically
4. Supabase Realtime notifies all users
5. UI updates in real-time

## File Permissions

Files uploaded to Google Drive have:
- **Anyone with link**: Can view
- **Specific recipients**: Can edit

This allows:
- Recipients to view and download files
- Recipients to add comments/annotations
- Audit trail of file access

## Fallback Behavior

If Supabase or Google Drive is not configured:
- System automatically falls back to localStorage
- All existing functionality continues to work
- No breaking changes for users

## Testing

1. **Test Google Drive Upload**
   ```javascript
   // In browser console
   await googleDriveService.authenticate()
   const file = new File(['test'], 'test.txt')
   await googleDriveService.uploadFile(file)
   ```

2. **Test Supabase Connection**
   ```javascript
   // In browser console
   const { data, error } = await supabase.from('documents').select('*')
   console.log(data, error)
   ```

## Migration from localStorage

To migrate existing localStorage data to Supabase:

1. Export localStorage data:
   ```javascript
   const docs = JSON.parse(localStorage.getItem('submitted-documents'))
   console.log(JSON.stringify(docs, null, 2))
   ```

2. Import to Supabase using migration script (to be created)

## Troubleshooting

### Google Drive Authentication Fails
- Check OAuth client ID is correct
- Verify authorized origins include your domain
- Clear browser cache and try again

### Supabase Connection Fails
- Verify project URL and anon key
- Check RLS policies allow operations
- Verify network connectivity

### Files Not Uploading
- Check Google Drive API is enabled
- Verify API key has correct permissions
- Check browser console for errors

## Security Considerations

1. **API Keys**: Never commit `.env` file to git
2. **File Permissions**: Review Google Drive permissions regularly
3. **RLS Policies**: Refine Supabase RLS policies for production
4. **OAuth Scopes**: Use minimal required scopes

## Next Steps

1. Implement Supabase Realtime hooks
2. Add file download functionality
3. Implement file version history
4. Add bulk operations support
5. Create admin dashboard for monitoring
