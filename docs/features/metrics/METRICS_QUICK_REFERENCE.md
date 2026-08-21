# Metrics System - Quick Reference Guide

## Overview
This guide provides quick reference for working with the optimized metrics system across Document Management, Emergency Management, and Approval Chain with Bypass pages.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  Documents.tsx | Emergency.tsx | ApprovalRouting.tsx        │
│  EmergencyWorkflowInterface.tsx                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ useMemo(getStatistics)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      Hook Layer                              │
│  useSupabaseDocuments | useSupabaseEmergency |              │
│  useSupabaseBypass                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Real-time subscriptions + Queries
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Supabase Layer                             │
│  documents | emergency_documents | bypass_documents          │
│  + Composite Indexes + RLS Policies                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. User-Specific Filtering
All data is automatically filtered by `submitter_id`:

```typescript
// Automatic in hooks
const { documents } = useSupabaseDocuments(); // Only user's documents

// Manual filtering (if needed)
const userDocs = documents.filter(d => d.submitter_id === user.id);
```

### 2. Real-Time Updates
Changes are automatically reflected in the UI:

```typescript
// No action needed - hooks handle this automatically
// When a document is created/updated/deleted:
// 1. Database triggers real-time event
// 2. Hook receives event (filtered by user)
// 3. State updates automatically
// 4. UI re-renders with new data
```

### 3. Statistics Calculation
Use memoized statistics for performance:

```typescript
// ✅ Correct - Memoized
const stats = useMemo(() => 
  documentHook.getStatistics(), 
  [documentHook.documents]
);

// ❌ Incorrect - Recalculates on every render
const stats = documentHook.getStatistics();
```

## Common Patterns

### Displaying Metrics

```typescript
import { useMemo } from 'react';
import { useSupabaseDocuments } from '@/hooks/useSupabaseDocuments';

function MyComponent() {
  const documentHook = useSupabaseDocuments();
  
  // Memoize statistics
  const stats = useMemo(() => 
    documentHook.getStatistics(), 
    [documentHook.documents]
  );
  
  return (
    <div>
      <p>Pending: {stats.pending}</p>
      <p>Approved: {stats.approved}</p>
      <p>Total: {stats.total}</p>
      <p>Approval Rate: {stats.approvalRate}%</p>
      <p>Average Time: {stats.averageTime}</p>
    </div>
  );
}
```

### Loading States

```typescript
function MyComponent() {
  const { documents, isLoading, error } = useSupabaseDocuments();
  
  if (isLoading && documents.length === 0) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return <ErrorMessage error={error} />;
  }
  
  // Render metrics
  return <MetricsDisplay documents={documents} />;
}
```

### Custom Filtering

```typescript
function MyComponent() {
  const { documents } = useSupabaseDocuments();
  
  // Filter by status
  const pendingDocs = useMemo(() => 
    documents.filter(d => d.status === 'pending'),
    [documents]
  );
  
  // Filter by date range
  const recentDocs = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return documents.filter(d => 
      new Date(d.created_at) > weekAgo
    );
  }, [documents]);
  
  return (
    <div>
      <p>Pending: {pendingDocs.length}</p>
      <p>Recent: {recentDocs.length}</p>
    </div>
  );
}
```

## Available Hooks

### useSupabaseDocuments
```typescript
const {
  documents,        // Array of user's documents
  isLoading,        // Loading state
  error,            // Error message
  createDocument,   // Create new document
  updateDocument,   // Update existing document
  deleteDocument,   // Delete document
  loadDocuments,    // Manually reload
  getStatistics     // Get calculated metrics
} = useSupabaseDocuments();
```

**Statistics Object:**
```typescript
{
  pending: number,
  approved: number,
  rejected: number,
  total: number,
  averageTime: string,  // e.g., "2.5 hours" or "45 mins"
  approvalRate: number  // Percentage (0-100)
}
```

### useSupabaseEmergency
```typescript
const {
  documents,          // Array of user's emergency documents
  notifications,      // Array of notifications
  isLoading,
  error,
  createDocument,
  updateDocument,
  deleteDocument,
  createNotification,
  loadDocuments,
  loadNotifications,
  getStatistics
} = useSupabaseEmergency();
```

**Statistics Object:**
```typescript
{
  active: number,           // Submitted emergencies
  resolved: number,         // Total resolved
  resolvedMonth: number,    // Resolved this month
  avgResponseTime: number,  // Minutes
  total: number,
  responseRate: number      // Percentage (0-100)
}
```

### useSupabaseBypass
```typescript
const {
  documents,
  isLoading,
  error,
  createDocument,
  updateDocument,
  deleteDocument,
  loadDocuments,
  getStatistics
} = useSupabaseBypass();
```

**Statistics Object:**
```typescript
{
  pending: number,
  completed: number,
  bypassed: number,
  bypassCount: number,      // Alias for bypassed
  total: number,
  averageTime: string,      // e.g., "1.2 hours"
  responseRate: number      // Percentage (0-100)
}
```

## Performance Tips

### 1. Use Memoization
Always memoize expensive calculations:

```typescript
// ✅ Good
const stats = useMemo(() => hook.getStatistics(), [hook.documents]);
const filtered = useMemo(() => docs.filter(...), [docs]);

// ❌ Bad
const stats = hook.getStatistics(); // Recalculates every render
const filtered = docs.filter(...);  // Recreates array every render
```

### 2. Avoid Unnecessary Re-renders
Use React.memo for components that display metrics:

```typescript
const MetricsCard = React.memo(({ stats }) => (
  <Card>
    <p>Total: {stats.total}</p>
    <p>Pending: {stats.pending}</p>
  </Card>
));
```

### 3. Batch State Updates
When updating multiple documents, batch the updates:

```typescript
// ✅ Good - Single state update
const updatedDocs = documents.map(d => 
  d.id === targetId ? { ...d, status: 'approved' } : d
);
setDocuments(updatedDocs);

// ❌ Bad - Multiple state updates
documents.forEach(d => {
  if (d.id === targetId) {
    setDocuments(prev => prev.map(doc => 
      doc.id === d.id ? { ...doc, status: 'approved' } : doc
    ));
  }
});
```

### 4. Leverage Cache
The hooks automatically cache data in localStorage:

```typescript
// Cache is automatically used on page load
// No action needed from developers

// To manually clear cache (if needed):
localStorage.removeItem('documents-cache');
localStorage.removeItem('emergency-cache');
localStorage.removeItem('bypass-cache');
```

## Debugging

### Check Real-Time Connection
```typescript
// Add to useEffect in your component
useEffect(() => {
  const channel = supabase.channel('debug');
  channel.subscribe((status) => {
    console.log('Realtime status:', status);
  });
  return () => channel.unsubscribe();
}, []);
```

### Measure Statistics Performance
```typescript
const stats = useMemo(() => {
  console.time('stats-calculation');
  const result = hook.getStatistics();
  console.timeEnd('stats-calculation');
  return result;
}, [hook.documents]);
```

### Verify User Filtering
```typescript
useEffect(() => {
  console.log('User ID:', user?.id);
  console.log('Documents:', documents.map(d => ({
    id: d.id,
    submitter: d.submitter_id,
    isOwn: d.submitter_id === user?.id
  })));
}, [documents, user?.id]);
```

## Common Issues

### Issue: Metrics not updating
**Solution:** Check real-time subscription status
```typescript
// Verify subscription is active
const { documents } = useSupabaseDocuments();
console.log('Documents count:', documents.length);
```

### Issue: Seeing other users' data
**Solution:** Verify user authentication
```typescript
const { user } = useAuth();
console.log('Current user:', user?.id);
// Check if documents have correct submitter_id
```

### Issue: Slow performance
**Solution:** Check if memoization is used
```typescript
// ✅ Should be memoized
const stats = useMemo(() => hook.getStatistics(), [hook.documents]);
```

### Issue: Stale data after refresh
**Solution:** Clear cache and reload
```typescript
localStorage.clear();
window.location.reload();
```

## Best Practices

1. ✅ Always use `useMemo` for statistics
2. ✅ Use `React.memo` for metric display components
3. ✅ Rely on real-time updates (don't poll)
4. ✅ Trust the cache for initial load
5. ✅ Let hooks handle user filtering
6. ❌ Don't manually filter by user (hooks do this)
7. ❌ Don't call `getStatistics()` in render
8. ❌ Don't disable real-time subscriptions
9. ❌ Don't clear cache unnecessarily

## Testing Checklist

- [ ] Metrics load instantly on page load
- [ ] Real-time updates work (test with multiple tabs)
- [ ] Only user's own data is visible
- [ ] Statistics are accurate
- [ ] No console errors
- [ ] Performance is smooth (< 200ms initial load)
- [ ] Cache persists across refreshes

## Support

For issues or questions:
1. Check `docs/METRICS_OPTIMIZATION.md` for detailed documentation
2. Review `docs/METRICS_OPTIMIZATION_SUMMARY.md` for implementation details
3. Run `supabase/operations/VERIFY_OPTIMIZATION.sql` to verify database setup
4. Check browser console for errors
5. Verify Supabase dashboard for RLS policy issues
