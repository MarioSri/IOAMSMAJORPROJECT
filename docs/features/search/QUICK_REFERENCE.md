# Universal Search - Quick Reference

## 🚀 Quick Start

### Import Hook
```typescript
import { useSupabaseUniversalSearch } from '@/hooks/useSupabaseUniversalSearch';
```

### Basic Usage
```typescript
const { search, isLoading, error } = useSupabaseUniversalSearch();

const results = await search('meeting');
// Returns: SearchResult[]
```

## 📝 Search Across Modules

### Modules Included
- ✅ Track Documents
- ✅ Pending Approvals
- ✅ Approval History
- ✅ LiveMeet+ Meetings
- ✅ Sticky Notes
- ✅ Upcoming Reminders
- ✅ Calendar Events

### Search Fields
```typescript
// Documents: title, description
// Approvals: step name, assignee
// History: comment, approver name
// Meetings: title, description, location
// Notes: title, content
// Reminders: title, description
```

## 🔄 Real-Time Updates

### Automatic
Real-time subscriptions automatically invalidate cache when data changes.

```typescript
// No code needed - automatic!
const { search } = useSupabaseUniversalSearch();
```

## 💾 Cache Strategy

### Recent Searches (UI Only)
```typescript
// Stored in localStorage
localStorage.getItem('recent-searches');
// Max 5 items
```

### Search Results Cache
```typescript
// Auto-cached after search
// TTL: 5 minutes
// Auto-invalidated on data changes
```

## 🔐 Security

### Role-Based Filtering
```typescript
// Automatic filtering by user
// Documents: submitter_id = user.id
// Approvals: assignee_id = user.id
// Notes: user_id = user.id
```

## ⚡ Performance

### Debouncing
```typescript
// 300ms debounce built-in
// No additional code needed
```

### Result Limits
- 10 results per module
- 50 total cached results
- Parallel queries for speed

## 🎯 Navigation

### Click Result
```typescript
// Automatically navigates to:
// /track-documents#doc-id
// /approvals#approval-id
// /messages?tab=notes#note-id
// /calendar#meeting-id
```

### Scroll to Card
```typescript
// Automatic scroll-to-card with highlight
// 2-second ring animation
```

## 🐛 Debugging

### Check Connection
```typescript
const { error } = useSupabaseUniversalSearch();
console.log('Error:', error);
```

### Clear Cache
```typescript
localStorage.removeItem('search-cache');
localStorage.removeItem('recent-searches');
```

## 📊 Result Structure

```typescript
interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'approval' | 'meeting' | 'reminder' | 'note' | 'calendar';
  section: string;
  path: string;
  metadata?: any;
}
```

## 🔗 Quick Links

- [Full Documentation](./UNIVERSAL_SEARCH_SUPABASE.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

---

**Version**: 1.0.0  
**Status**: Production Ready
