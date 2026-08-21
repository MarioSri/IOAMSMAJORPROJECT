# Metrics Performance Optimization

## Overview
This document describes the optimizations implemented to ensure fast loading and real-time updates of user-specific metrics on the Document Management, Emergency Management, and Approval Chain with Bypass pages.

## Key Optimizations

### 1. Database Level Optimizations

#### Composite Indexes
Added composite indexes to optimize user-specific queries:

```sql
-- Documents table
CREATE INDEX idx_documents_submitter_status ON documents(submitter_id, status);
CREATE INDEX idx_documents_submitter_created ON documents(submitter_id, created_at DESC);
CREATE INDEX idx_documents_status_updated ON documents(status, updated_at) WHERE status = 'approved';

-- Emergency documents
CREATE INDEX idx_emergency_submitter_status ON emergency_documents(submitter_id, status);
CREATE INDEX idx_emergency_submitter_created ON emergency_documents(submitter_id, created_at DESC);
CREATE INDEX idx_emergency_status_updated ON emergency_documents(status, updated_at) WHERE status = 'resolved';

-- Bypass documents
CREATE INDEX idx_bypass_submitter_status ON bypass_documents(submitter_id, status);
CREATE INDEX idx_bypass_submitter_created ON bypass_documents(submitter_id, created_at DESC);
CREATE INDEX idx_bypass_status_updated ON bypass_documents(status, updated_at) WHERE status IN ('approved', 'bypassed');
```

**Benefits:**
- Faster filtering by user ID and status
- Optimized sorting by creation date
- Partial indexes for approved/resolved documents reduce index size

### 2. Real-Time Subscriptions

#### Server-Side Filtering
All real-time subscriptions now use server-side filtering to ensure only user-specific data is transmitted:

```typescript
// Example from useSupabaseDocuments
const channel = supabase
  .channel('documents-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'documents',
    filter: `submitter_id=eq.${user.id}`  // Server-side filter
  }, handlePayload)
  .subscribe();
```

**Benefits:**
- Reduces network bandwidth
- Prevents unnecessary client-side filtering
- Ensures data security at the database level

### 3. Client-Side Optimizations

#### Optimized Statistics Calculation
Replaced multiple array filter operations with single-pass loops:

**Before:**
```typescript
const pending = documents.filter(d => d.status === 'pending').length;
const approved = documents.filter(d => d.status === 'approved').length;
const rejected = documents.filter(d => d.status === 'rejected').length;
```

**After:**
```typescript
let pending = 0, approved = 0, rejected = 0;
for (const d of documents) {
  if (d.status === 'pending') pending++;
  else if (d.status === 'approved') approved++;
  else if (d.status === 'rejected') rejected++;
}
```

**Benefits:**
- Reduces time complexity from O(3n) to O(n)
- Eliminates redundant array iterations
- Faster metrics calculation

#### React Memoization
Added `useMemo` hooks to prevent unnecessary recalculations:

```typescript
// Documents.tsx
const stats = useMemo(() => documentHook.getStatistics(), [documentHook.documents]);

// ApprovalRouting.tsx
const stats = useMemo(() => bypassService?.getStatistics() || defaultStats, [bypassService?.documents]);

// EmergencyWorkflowInterface.tsx
const statistics = useMemo(() => emergencyService?.getStatistics() || defaultStats, [emergencyService?.documents]);
```

**Benefits:**
- Statistics only recalculate when documents change
- Prevents unnecessary re-renders
- Improves UI responsiveness

### 4. Caching Strategy

#### LocalStorage Cache
All hooks implement localStorage caching for instant initial load:

```typescript
const [documents, setDocuments] = useState<any[]>(() => {
  try {
    const cached = localStorage.getItem('documents-cache');
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
});
```

**Benefits:**
- Instant metrics display on page load
- Reduces perceived loading time
- Graceful fallback if cache fails

#### Silent Background Refetch
Data is refreshed silently in the background without showing loading states:

```typescript
const loadDocuments = useCallback(async (filters?: { silent?: boolean }) => {
  const shouldShowLoading = !filters?.silent && documents.length === 0;
  if (shouldShowLoading) setIsLoading(true);
  // ... fetch logic
}, []);
```

**Benefits:**
- No UI flickering during updates
- Smooth user experience
- Loading states only shown on initial cold load

### 5. Security Implementation

#### User-Specific Data Filtering
All queries are scoped to the authenticated user:

```typescript
// Server-side filter in query
const scopedFilters = { 
  ...filters, 
  submitter_id: user.id 
};

// Real-time subscription filter
filter: `submitter_id=eq.${user.id}`

// Client-side validation (defense in depth)
if (payload.new && payload.new.submitter_id !== user.id) return;
```

**Security Layers:**
1. Database RLS policies
2. Server-side query filters
3. Real-time subscription filters
4. Client-side validation

## Performance Metrics

### Expected Performance
- **Initial Load:** < 200ms (with cache)
- **Real-Time Updates:** < 50ms (from event to UI update)
- **Statistics Calculation:** < 10ms (for 1000 documents)
- **Network Bandwidth:** Reduced by ~70% (server-side filtering)

### Monitoring
Monitor performance using browser DevTools:

```javascript
// Add to console to measure statistics calculation time
console.time('stats');
const stats = documentHook.getStatistics();
console.timeEnd('stats');
```

## Migration Instructions

### Apply Database Optimizations
Run the migration file in Supabase SQL Editor:

```bash
# File: supabase/migrations/20260310_optimize_metrics_queries.sql
```

### Verify Indexes
Check that indexes were created successfully:

```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('documents', 'emergency_documents', 'bypass_documents')
ORDER BY tablename, indexname;
```

## Testing Checklist

- [ ] Metrics load instantly on page refresh (cache working)
- [ ] Metrics update in real-time when documents change
- [ ] Only user's own documents are visible
- [ ] No loading spinners after initial page load
- [ ] Statistics are accurate across all three pages
- [ ] Performance is smooth with 100+ documents
- [ ] Real-time updates work across multiple tabs
- [ ] Cache persists across browser sessions

## Troubleshooting

### Metrics Not Updating
1. Check browser console for real-time subscription errors
2. Verify user is authenticated (`user.id` exists)
3. Check Supabase dashboard for RLS policy issues

### Slow Performance
1. Verify indexes are created (see "Verify Indexes" above)
2. Check network tab for large payloads
3. Clear localStorage cache and test fresh load

### Incorrect Data
1. Verify `submitter_id` matches `user.id`
2. Check RLS policies in Supabase
3. Inspect real-time subscription filters

## Future Enhancements

1. **Pagination:** Implement virtual scrolling for large datasets
2. **Aggregation:** Move statistics calculation to database views
3. **WebSocket Pooling:** Share real-time connections across hooks
4. **Service Worker:** Implement offline-first caching strategy
5. **Query Batching:** Combine multiple queries into single request

## Related Files

- `src/hooks/useSupabaseDocuments.ts`
- `src/hooks/useSupabaseEmergency.ts`
- `src/hooks/useSupabaseBypass.ts`
- `src/pages/Documents.tsx`
- `src/pages/Emergency.tsx`
- `src/pages/ApprovalRouting.tsx`
- `src/components/emergency/EmergencyWorkflowInterface.tsx`
- `supabase/migrations/20260310_optimize_metrics_queries.sql`
