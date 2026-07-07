# Document Management - Supabase Real-Time Integration

## Overview
Document Management page is now fully connected to Supabase as the primary database with real-time synchronization. localStorage is downgraded to cache-only.

## Architecture

### Data Flow
```
User Action → Supabase (Primary DB) → Real-time Subscription → UI Update
                    ↓
              localStorage (Cache Only - Last 50 docs)
```

## Setup

### 1. Run Migration
```bash
supabase/migrations/20240134_document_management.sql
```

### 2. Verify Tables
- documents (extended from approval_center migration)
- document_workflows
- workflow_steps

### 3. Configure Environment
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Features

### ✅ Implemented

1. **Real-time Document Creation**
   - Documents created in Supabase
   - All users see updates instantly
   - localStorage caches last 50 documents

2. **Document Types**
   - Letters
   - Circulars
   - Reports
   - Custom types

3. **Workflow Integration**
   - Sequential routing
   - Parallel routing
   - Workflow steps tracking
   - Approval chain management

4. **File Management**
   - Google Drive integration (optional)
   - Supabase storage
   - File metadata tracking
   - Large file handling

5. **Cache Layer**
   - localStorage stores last 50 documents
   - Automatic cache sync on Supabase updates
   - Fallback to cache if Supabase unavailable

## API Reference

### useSupabaseDocuments Hook

```typescript
const {
  documents,        // Array of documents
  isLoading,       // Loading state
  error,           // Error message
  createDocument,  // Create new document
  updateDocument,  // Update existing document
  deleteDocument,  // Delete document
  loadDocuments,   // Refresh documents
  getStatistics    // Get dashboard stats
} = useSupabaseDocuments();
```

### Creating Document

```typescript
const result = await createDocument({
  title: 'Document Title',
  description: 'Description',
  type: 'letter',
  priority: 'high',
  submitter_id: user.id,
  submitter_name: user.name,
  submitter_department: user.department,
  submitter_designation: user.role,
  is_emergency: false,
  files: [],
  recipients: ['recipient-1', 'recipient-2']
});

if (result.success) {
  console.log('Created:', result.data);
}
```

### Updating Document

```typescript
const result = await updateDocument(documentId, {
  status: 'approved',
  priority: 'urgent'
});
```

## Real-time Subscriptions

The hook automatically subscribes to document changes:

```typescript
// Automatic subscription in useSupabaseDocuments
supabase
  .channel('documents-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'documents',
  }, (payload) => {
    // Handle INSERT, UPDATE, DELETE
  })
  .subscribe();
```

## UI Components

### Document Uploader
- Creates documents in Supabase
- Real-time validation
- File upload support
- Recipient selection
- Priority levels

### Document Statistics
- Real-time dashboard metrics
- Auto-updates from Supabase
- No manual refresh needed

## Workflow Integration

### Sequential Workflow
```typescript
{
  documentId: doc.id,
  recipients: [
    { id: 'hod-1', name: 'HOD CSE' },
    { id: 'principal', name: 'Principal' }
  ],
  isParallel: false,
  routingType: 'sequential'
}
```

### Parallel Workflow
```typescript
{
  documentId: doc.id,
  recipients: [...],
  isParallel: true,
  routingType: 'parallel'
}
```

## Testing

### Test Real-time Sync
1. Open Document Management in two tabs
2. Submit document in tab 1
3. Verify it appears in tab 2 instantly

### Test Statistics
1. Create documents
2. Verify statistics update in real-time
3. Change document status
4. Verify statistics recalculate

### Test Offline Mode
1. Disconnect network
2. Check if cached data loads
3. Reconnect and verify sync

## Migration from localStorage

### Before (localStorage Only)
```typescript
const docs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
docs.unshift(newDoc);
localStorage.setItem('submitted-documents', JSON.stringify(docs));
```

### After (Supabase Primary)
```typescript
const result = await documentHook.createDocument(newDoc);
// Real-time subscription handles UI update
// Cache synced automatically
```

## Error Handling

### Supabase Unavailable
```typescript
try {
  const result = await createDocument(doc);
  if (!result.success) {
    // Fallback to localStorage
    handleLocalStorageSubmission(doc);
  }
} catch (error) {
  // Fallback to localStorage
  handleLocalStorageSubmission(doc);
}
```

### Cache Fallback
```typescript
// Automatic fallback in useSupabaseDocuments
catch (err) {
  const cached = JSON.parse(localStorage.getItem('documents-cache') || '[]');
  setDocuments(cached);
}
```

## Best Practices

1. **Always use documentHook for data operations**
   - Don't write directly to localStorage
   - Use Supabase as source of truth

2. **Handle errors gracefully**
   - Show user-friendly messages
   - Fallback to cache when needed
   - Retry failed operations

3. **Optimize file uploads**
   - Use Google Drive for large files
   - Compress images before upload
   - Limit file sizes (1MB per file for localStorage)

4. **Monitor performance**
   - Check real-time subscription health
   - Monitor database query performance
   - Track cache hit rates

## Notifications

### Recipient Notifications
```typescript
for (const recipientId of data.recipients) {
  await ExternalNotificationDispatcher.notifyRecipient(
    recipientId,
    recipientName,
    {
      type: 'approval',
      documentTitle: data.title,
      submitter: currentUserName,
      priority: data.priority,
      approvalCenterLink: `${window.location.origin}/approvals`,
      recipientName: recipientName
    }
  );
}
```

## Channel Auto-Creation

Documents automatically create collaboration channels:

```typescript
channelAutoCreationService.createDocumentChannel({
  documentId: document.id,
  documentTitle: data.title,
  submittedBy: user.id,
  submittedByName: currentUserName,
  recipients: data.recipients,
  recipientNames: recipientNames,
  source: 'Document Management',
  submittedAt: new Date()
});
```

## Troubleshooting

### Documents Not Appearing
1. Check Supabase connection
2. Verify RLS policies
3. Check browser console for errors
4. Verify real-time subscription status

### Real-time Not Working
1. Ensure Realtime is enabled in Supabase
2. Check subscription setup
3. Verify network connectivity
4. Check browser console for WebSocket errors

### Cache Issues
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Check cache size limits

## Changelog

### v1.0.0 (Current)
- ✅ Supabase integration complete
- ✅ Real-time subscriptions active
- ✅ localStorage downgraded to cache
- ✅ Document CRUD operations
- ✅ Workflow integration
- ✅ Google Drive integration (optional)
- ✅ Notification system
- ✅ Channel auto-creation
