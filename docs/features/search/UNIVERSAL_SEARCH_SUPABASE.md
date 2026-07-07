# Universal Search - Supabase Real-Time Integration

## Overview
Universal Search now queries data directly from Supabase across all modules with real-time updates. localStorage has been downgraded to cache-only for recent searches.

## Architecture

### Data Flow
```
User Input → Debounce (300ms) → Supabase Query → Results Display
                                       ↓
                              Real-time Subscriptions
                                       ↓
                              Auto-invalidate Cache
```

### Modules Searched

1. **Track Documents** (`documents` table)
2. **Pending Approvals** (`workflow_steps` + joins)
3. **Approval History** (`document_approvals` + joins)
4. **LiveMeet+** (`meetings` table)
5. **Sticky Notes** (`notes` table)
6. **Upcoming Reminders** (`reminders` table)
7. **Calendar Events** (`meetings` table)

## Implementation

### Hook: useSupabaseUniversalSearch

**Location**: `src/hooks/useSupabaseUniversalSearch.ts`

**API**:
```typescript
const { search, isLoading, error } = useSupabaseUniversalSearch();
const results = await search('meeting');
```

**SearchResult Interface**:
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

## Real-Time Features

### Automatic Cache Invalidation
Real-time subscriptions monitor all tables and invalidate cache on any change.

### Cache Strategy
- **Write**: After successful search (max 50 results)
- **Read**: On error fallback only
- **TTL**: 5 minutes
- **Invalidation**: On any table change

## localStorage Usage (Cache Only)

### Keys
- `search-cache`: Last search results with timestamp
- `recent-searches`: Last 5 search queries (UI only)

### Cache Policy
- ✅ Used only as fallback on network error
- ✅ Auto-invalidated on real-time updates
- ❌ Never used as source of truth

## Role-Based Access

### Automatic Filtering
- **Documents**: `submitter_id = user.id`
- **Approvals**: `assignee_id = user.id`
- **History**: `approver_id = user.id`
- **Notes**: `user_id = user.id`
- **Reminders**: `user_id = user.id`
- **Meetings**: All visible

## Performance

- Parallel queries across all tables
- Debounced input (300ms)
- Limited results (10 per table)
- Indexed search columns

## Migration

### Removed
- ❌ `apiService.search()` calls
- ❌ localStorage as source of truth

### Added
- ✅ `useSupabaseUniversalSearch` hook
- ✅ Direct Supabase queries
- ✅ Real-time cache invalidation

### Preserved
- ✅ All UI components unchanged
- ✅ Search bar animation
- ✅ Recent searches feature

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0
