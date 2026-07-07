# Track Documents - Quick Reference Card

## 🚀 Quick Start

### Import Hook
```typescript
import { useSupabaseTrackDocuments } from '@/hooks/useSupabaseTrackDocuments';
```

### Basic Usage
```typescript
const {
  trackDocuments,    // Array of documents
  loading,           // Loading state
  error,             // Error message
  createDocument,    // Create function
  updateDocument,    // Update function
  deleteDocument,    // Delete function
  refetch            // Manual refresh
} = useSupabaseTrackDocuments();
```

## 📝 CRUD Operations

### Create Document
```typescript
const result = await createDocument({
  title: 'New Document',
  description: 'Description',
  type: 'Letter',
  priority: 'high',
  submitter_id: user.id,
  submitter_name: user.name,
  files: [file1, file2],
  recipients: ['recipient1', 'recipient2']
});

if (result.success) {
  // Document created, UI auto-updates
}
```

### Update Document
```typescript
const result = await updateDocument(documentId, {
  status: 'approved',
  priority: 'urgent'
});
```

### Delete Document
```typescript
const result = await deleteDocument(documentId);
```

### Refresh Data
```typescript
await refetch();
```

## 🔄 Real-Time Updates

### Automatic
Real-time updates happen automatically. No code needed!

```typescript
// ✅ This is all you need
const { trackDocuments } = useSupabaseTrackDocuments();

// UI automatically updates when:
// - New document created (any user)
// - Document updated (any user)
// - Document deleted (any user)
```

### Manual Subscription (Advanced)
```typescript
useEffect(() => {
  const channel = supabase
    .channel('custom-channel')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'documents' },
      (payload) => console.log(payload)
    )
    .subscribe();

  return () => channel.unsubscribe();
}, []);
```

## 🎯 Filtering

### By User (Automatic)
```typescript
// Hook automatically filters by submitter_id
const { trackDocuments } = useSupabaseTrackDocuments();
// Only shows current user's documents
```

### By Status
```typescript
const { loadDocuments } = useSupabaseDocuments();
await loadDocuments({ status: 'pending' });
```

### By Submitter
```typescript
await loadDocuments({ submitter_id: userId });
```

## 💾 Cache Strategy

### Automatic Caching
```typescript
// Cache automatically updated after Supabase fetch
// No code needed
```

### Manual Cache Access
```typescript
// Fallback to cache on error (automatic)
const { trackDocuments, error } = useSupabaseTrackDocuments();
// If error, trackDocuments loads from cache
```

### Clear Cache
```typescript
localStorage.removeItem('track-documents-cache');
```

## 🔐 Security

### Row Level Security (RLS)
```sql
-- Automatic: Users only see their own documents
-- Filter: submitter_id = auth.uid()
```

### Check User Access
```typescript
const { user } = useAuth();
if (document.submitter_id === user.id) {
  // User owns this document
}
```

## ⚡ Performance Tips

### Pagination
```typescript
const { data } = await supabase
  .from('documents')
  .select('*')
  .range(0, 9)  // First 10 items
  .order('created_at', { ascending: false });
```

### Debounce Search
```typescript
const debouncedSearch = useMemo(
  () => debounce((term) => {
    // Search logic
  }, 300),
  []
);
```

### Limit Cache Size
```typescript
// Automatic: Only 50 most recent documents cached
```

## 🐛 Error Handling

### Basic
```typescript
const { error } = useSupabaseTrackDocuments();
if (error) {
  toast({ title: "Error", description: error });
}
```

### Advanced
```typescript
const result = await createDocument(data);
if (!result.success) {
  console.error(result.error);
  toast({ 
    title: "Failed to create", 
    description: result.error,
    variant: "destructive" 
  });
}
```

## 📊 Statistics

```typescript
const { getStatistics } = useSupabaseDocuments();
const stats = getStatistics();

console.log(stats);
// {
//   pending: 5,
//   approved: 10,
//   rejected: 2,
//   total: 17,
//   approvalRate: 59
// }
```

## 🔍 Debugging

### Check Connection
```typescript
const { data: session } = await supabase.auth.getSession();
console.log('Connected:', !!session);
```

### Monitor Real-time
```typescript
supabase
  .channel('debug')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'documents' },
    (payload) => console.log('Real-time:', payload)
  )
  .subscribe((status) => console.log('Status:', status));
```

### Check Cache
```typescript
const cache = localStorage.getItem('track-documents-cache');
console.log('Cache:', JSON.parse(cache || '[]'));
```

## 🚨 Common Issues

### Documents not appearing
```typescript
// 1. Check user is authenticated
const { user } = useAuth();
console.log('User:', user);

// 2. Check Supabase connection
const { error } = useSupabaseTrackDocuments();
console.log('Error:', error);

// 3. Check RLS policies in Supabase dashboard
```

### Real-time not working
```typescript
// 1. Verify Realtime enabled in Supabase
// 2. Check publication includes documents table
// 3. Monitor subscription status
```

### Cache issues
```typescript
// Clear all caches
localStorage.clear();
// Hard refresh
location.reload();
```

## 📚 Related Hooks

### useSupabaseDocuments
```typescript
// For general document management (all users)
import { useSupabaseDocuments } from '@/hooks/useSupabaseDocuments';
```

### useAuth
```typescript
// For user authentication
import { useAuth } from '@/contexts/AuthContext';
const { user } = useAuth();
```

## 🔗 Quick Links

- [Full Documentation](./TRACK_DOCUMENTS_SUPABASE_REALTIME.md)
- [Migration Guide](./MIGRATION_GUIDE_SUPABASE.md)
- [Supabase Docs](https://supabase.com/docs)
- [Real-time Guide](https://supabase.com/docs/guides/realtime)

## 💡 Best Practices

### ✅ DO
- Use hooks for all data operations
- Handle errors gracefully
- Let real-time subscriptions update UI
- Use cache as fallback only

### ❌ DON'T
- Write directly to localStorage
- Manually dispatch events
- Assume synchronous updates
- Ignore error states

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-24  
**Status**: Production Ready
