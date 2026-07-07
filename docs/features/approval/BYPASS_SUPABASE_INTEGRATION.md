# Approval Chain with Bypass - Supabase Integration

## Overview
Approval Chain with Bypass page is now connected to Supabase as the primary database with real-time synchronization. localStorage is downgraded to cache-only.

## Architecture

### Data Flow
```
User Action → Supabase (Primary DB) → Real-time Subscription → UI Update
                    ↓
              localStorage (Cache Only)
```

## Setup

### 1. Run Migration
```bash
supabase/migrations/20240133_approval_chain_bypass.sql
```

### 2. Verify Tables
- bypass_documents
- bypass_workflow_steps

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
   - localStorage caches for offline fallback

2. **Routing Types**
   - Sequential: One-by-one approval
   - Parallel: All recipients simultaneously
   - Reverse: Highest authority first
   - Bi-Directional: Parallel with resend capability

3. **Statistics Dashboard**
   - Pending approvals count
   - Completed documents count
   - Bypass count
   - Response rate percentage

4. **Cache Layer**
   - localStorage stores last 50 documents
   - Automatic cache sync on Supabase updates
   - Fallback to cache if Supabase unavailable

## API Reference

### useSupabaseBypass Hook

```typescript
const {
  documents,        // Array of bypass documents
  isLoading,       // Loading state
  error,           // Error message
  createDocument,  // Create new bypass document
  updateDocument,  // Update existing document
  deleteDocument,  // Delete document
  loadDocuments,   // Refresh documents
  getStatistics    // Get dashboard stats
} = useSupabaseBypass();
```

### Creating Bypass Document

```typescript
const result = await createDocument({
  title: 'Document Title',
  description: 'Description',
  routing_type: 'parallel',
  priority: 'high',
  submitter_id: user.id,
  submitter_name: user.name,
  recipients: ['recipient-1', 'recipient-2'],
  files: serializedFiles
});

if (result.success) {
  console.log('Created:', result.data);
}
```

## Real-time Subscriptions

```typescript
supabaseBypassService.subscribeToBypassDocuments((payload) => {
  if (payload.eventType === 'INSERT') {
    // New document created
  } else if (payload.eventType === 'UPDATE') {
    // Document updated
  } else if (payload.eventType === 'DELETE') {
    // Document deleted
  }
});
```

## Testing

### Test Real-time Sync
1. Open Approval Chain page in two tabs
2. Create bypass document in tab 1
3. Verify it appears in tab 2 instantly

### Test Statistics
1. Create bypass documents
2. Verify statistics update in real-time
3. Change document status
4. Verify statistics recalculate

## Migration from localStorage

### Before (localStorage Only)
```typescript
const docs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
docs.unshift(newDoc);
localStorage.setItem('submitted-documents', JSON.stringify(docs));
```

### After (Supabase Primary)
```typescript
const result = await bypassService.createDocument(newDoc);
// Real-time subscription handles UI update
// Cache synced automatically
```

## Best Practices

1. **Always use bypassService for data operations**
   - Don't write directly to localStorage
   - Use Supabase as source of truth

2. **Handle errors gracefully**
   - Show user-friendly messages
   - Fallback to cache when needed

3. **Optimize file uploads**
   - Compress large files
   - Use appropriate file formats
   - Limit file sizes

## Changelog

### v1.0.0 (Current)
- ✅ Supabase integration complete
- ✅ Real-time subscriptions active
- ✅ localStorage downgraded to cache
- ✅ Statistics dashboard connected
- ✅ Document CRUD operations
- ✅ All routing types supported
