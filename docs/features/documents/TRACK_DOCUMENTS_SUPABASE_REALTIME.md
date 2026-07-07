# Track Documents Page - Supabase Real-Time Integration

## Overview
Track Documents Page is now fully integrated with Supabase as the primary database with real-time synchronization. localStorage has been downgraded to a cache-only layer.

## Architecture

### Data Flow
```
User Action → Supabase (Primary DB) → Real-time Subscription → UI Update
                    ↓
              localStorage (Cache Only)
```

### Key Components

#### 1. **useSupabaseTrackDocuments Hook**
- **Location**: `src/hooks/useSupabaseTrackDocuments.ts`
- **Purpose**: Primary hook for Track Documents data management
- **Features**:
  - Fetches documents from Supabase filtered by `submitter_id`
  - Real-time subscriptions for INSERT, UPDATE, DELETE events
  - Automatic cache synchronization to localStorage
  - Fallback to cache on network errors

#### 2. **useSupabaseDocuments Hook**
- **Location**: `src/hooks/useSupabaseDocuments.ts`
- **Purpose**: General document management hook
- **Features**:
  - CRUD operations on documents table
  - Real-time subscriptions for all document changes
  - Statistics calculation (pending, approved, rejected)
  - Cache-only localStorage usage

#### 3. **DocumentService**
- **Location**: `src/services/DocumentService.ts`
- **Purpose**: Business logic for document operations
- **Features**:
  - Creates documents in Supabase
  - Uploads files to Google Drive (optional)
  - Stores file metadata in `document_files` table
  - No direct localStorage writes

#### 4. **DocumentTracker Component**
- **Location**: `src/components/documents/DocumentTracker.tsx`
- **Purpose**: UI component for tracking documents
- **Features**:
  - Displays documents from Supabase
  - Real-time UI updates via subscriptions
  - Merges Supabase data with local cache for backward compatibility
  - Handles document removal through Supabase

## Database Schema

### documents table
```sql
- id (uuid, primary key)
- title (text)
- description (text)
- type (text)
- priority (text)
- status (text)
- submitter_id (uuid, foreign key to auth.users)
- submitter_name (text)
- submitter_department (text)
- submitter_designation (text)
- is_emergency (boolean)
- routing_type (text)
- is_parallel (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### document_files table
```sql
- id (uuid, primary key)
- document_id (uuid, foreign key to documents)
- file_name (text)
- file_type (text)
- file_size (integer)
- google_drive_id (text)
- google_drive_url (text)
- created_at (timestamp)
```

## Real-Time Features

### Subscription Setup
```typescript
const channel = supabase
  .channel('track-documents-realtime')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'documents',
      filter: `submitter_id=eq.${user.id}`
    },
    (payload) => {
      // Handle INSERT, UPDATE, DELETE
    }
  )
  .subscribe();
```

### Event Handling
- **INSERT**: New document added to top of list
- **UPDATE**: Document updated in place
- **DELETE**: Document removed from list

## localStorage Usage (Cache Only)

### Cache Keys
- `track-documents-cache`: Stores last 50 documents for offline fallback
- `documents-cache`: General document cache

### Cache Strategy
1. **Write**: After successful Supabase fetch
2. **Read**: Only on Supabase error (fallback)
3. **Limit**: Maximum 50 documents to prevent storage overflow
4. **No Direct Writes**: All business data goes through Supabase first

## Role-Based Access

### Submitter View
- Users only see documents where `submitter_id` matches their user ID
- Real-time filter: `filter: 'submitter_id=eq.${user.id}'`

### Recipient View
- Handled by separate approval system
- Uses `pending-approvals` localStorage for backward compatibility

## API Methods

### useSupabaseTrackDocuments
```typescript
const {
  trackDocuments,      // Array of documents
  loading,             // Loading state
  error,               // Error message
  createDocument,      // Create new document
  updateDocument,      // Update existing document
  deleteDocument,      // Delete document
  refetch              // Manual refresh
} = useSupabaseTrackDocuments();
```

### useSupabaseDocuments
```typescript
const {
  documents,           // All documents
  isLoading,           // Loading state
  error,               // Error message
  createDocument,      // Create document
  updateDocument,      // Update document
  deleteDocument,      // Delete document
  loadDocuments,       // Load with filters
  getStatistics        // Get stats
} = useSupabaseDocuments();
```

## Migration Notes

### Removed
- ❌ Direct localStorage writes for document data
- ❌ localStorage as source of truth
- ❌ Manual event dispatching for document changes
- ❌ `useRealTimeDocuments` hook (replaced by Supabase hooks)

### Added
- ✅ Supabase as primary database
- ✅ Real-time subscriptions
- ✅ Automatic cache synchronization
- ✅ Proper error handling with fallback
- ✅ Role-based filtering at database level

### Preserved
- ✅ All UI components remain unchanged
- ✅ Card creation UI fully functional
- ✅ File upload and viewing
- ✅ Document workflow tracking
- ✅ Signature management

## Testing Checklist

### Real-Time Sync
- [ ] Create document in one browser tab, verify it appears in another
- [ ] Update document status, verify real-time update
- [ ] Delete document, verify it disappears across all tabs

### Offline Behavior
- [ ] Disconnect network, verify cache fallback works
- [ ] Reconnect network, verify data syncs from Supabase

### Role-Based Access
- [ ] User A creates document, verify User B doesn't see it
- [ ] User A sees only their submitted documents

### Performance
- [ ] Page loads within 2 seconds
- [ ] Real-time updates appear within 1 second
- [ ] No duplicate documents in UI

## Troubleshooting

### Documents not appearing
1. Check Supabase connection: `supabase.auth.getSession()`
2. Verify RLS policies allow read access
3. Check browser console for errors
4. Verify `submitter_id` matches current user

### Real-time not working
1. Check Realtime is enabled in Supabase dashboard
2. Verify `supabase_realtime` publication includes `documents` table
3. Check subscription status in browser console
4. Verify network connection

### Cache issues
1. Clear localStorage: `localStorage.clear()`
2. Hard refresh: Ctrl+Shift+R
3. Check cache size limits

## Future Enhancements

### Planned
- [ ] Pagination for large document lists
- [ ] Advanced filtering and search
- [ ] Bulk operations
- [ ] Document versioning
- [ ] Audit trail

### Considerations
- [ ] Implement optimistic updates for better UX
- [ ] Add retry logic for failed operations
- [ ] Implement conflict resolution for concurrent edits
- [ ] Add offline queue for actions

## Security

### RLS Policies
```sql
-- Users can only read their own documents
CREATE POLICY "Users can view own documents"
ON documents FOR SELECT
USING (auth.uid() = submitter_id);

-- Users can create documents
CREATE POLICY "Users can create documents"
ON documents FOR INSERT
WITH CHECK (auth.uid() = submitter_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
ON documents FOR UPDATE
USING (auth.uid() = submitter_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON documents FOR DELETE
USING (auth.uid() = submitter_id);
```

## Performance Optimization

### Implemented
- Real-time subscriptions with user-specific filters
- Cache limiting to 50 documents
- Indexed queries on `submitter_id`, `status`, `type`
- Lazy loading of file metadata

### Recommended
- Implement virtual scrolling for large lists
- Add debouncing for search/filter operations
- Use connection pooling for high traffic
- Monitor Supabase usage metrics

---

**Status**: ✅ Production Ready  
**Last Updated**: 2024-01-24  
**Version**: 1.0.0
