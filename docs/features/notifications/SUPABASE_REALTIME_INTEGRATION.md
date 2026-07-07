# Notifications Supabase Real-Time Integration

## Overview
Complete integration of Notifications Widget and Notification Center with Supabase as the primary database, featuring real-time updates and localStorage as cache-only layer.

## Architecture

### Data Flow
```
Supabase (Source of Truth)
    ↓ Real-time subscriptions
useSupabaseNotifications Hook
    ↓ React state
NotificationsWidget & NotificationCenter
    ↓ Optional cache
localStorage (Cache Only)
```

## Files Created/Modified

### 1. Database Migration
**File:** `supabase/migrations/20240135_notifications_system.sql`

Creates:
- `notifications` table with full schema
- Indexes for performance (user_id, created_at, read, urgent, type, document_id)
- Row Level Security (RLS) policies
- Triggers for auto-updating timestamps
- Function to create notifications on document events
- View for notification counts
- Real-time publication

### 2. Custom Hook
**File:** `src/hooks/useSupabaseNotifications.ts`

Features:
- Real-time subscriptions for INSERT, UPDATE, DELETE
- Optimistic updates for instant UI feedback
- localStorage as cache-only (1-minute TTL)
- Automatic count calculations
- Error handling with cache fallback

Exports:
```typescript
{
  notifications: SupabaseNotification[]
  loading: boolean
  error: string | null
  unreadCount: number
  urgentCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  removeNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  createNotification: (notification) => Promise<void>
  refresh: () => Promise<void>
}
```

### 3. Service Layer
**File:** `src/services/SupabaseNotificationService.ts`

Business logic methods:
- `createNotification()` - Single notification
- `createBulkNotifications()` - Multiple users
- `notifyDocumentApproval()` - Document approval/rejection
- `notifyDocumentSubmission()` - New document submitted
- `notifyDocumentStatusChange()` - Status updates
- `createReminder()` - Reminder notifications
- `notifyMeeting()` - Meeting notifications
- `markAsRead()` - Mark as read
- `deleteNotification()` - Delete notification
- `getUnreadCount()` - Get unread count
- `cleanupOldNotifications()` - Maintenance

### 4. Updated Components

#### NotificationsWidget
**File:** `src/components/dashboard/widgets/NotificationsWidget.tsx`

Changes:
- ✅ Removed localStorage direct writes
- ✅ Removed API service calls
- ✅ Uses `useSupabaseNotifications` hook
- ✅ Real-time updates via Supabase
- ✅ Optimistic UI updates
- ✅ Loading states
- ✅ Cache fallback on errors

#### NotificationCenter
**File:** `src/components/notifications/NotificationCenter.tsx`

Changes:
- ✅ Removed localStorage direct writes
- ✅ Removed notification service calls
- ✅ Uses `useSupabaseNotifications` hook
- ✅ Real-time updates
- ✅ Proper time formatting

#### NotificationContext
**File:** `src/contexts/NotificationContext.tsx`

Changes:
- ✅ Removed localStorage persistence
- ✅ Uses `useSupabaseNotifications` hook
- ✅ Converts Supabase format to context format
- ✅ Maintains backward compatibility

## Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'emergency', 'approval', 'submission', 'reminder', 'meeting')),
  read BOOLEAN DEFAULT FALSE,
  urgent BOOLEAN DEFAULT FALSE,
  delivered_via TEXT[] DEFAULT '{}',
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  document_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Row Level Security (RLS)

### Policies
1. **Users can view own notifications** - SELECT policy
2. **Users can insert own notifications** - INSERT policy
3. **Users can update own notifications** - UPDATE policy
4. **Users can delete own notifications** - DELETE policy
5. **System can insert notifications** - Admin/system INSERT policy

## Real-Time Subscriptions

### Channel Setup
```typescript
supabase
  .channel(`notifications:${user.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id}`
  }, handleInsert)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id}`
  }, handleUpdate)
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id}`
  }, handleDelete)
  .subscribe()
```

## Usage Examples

### Creating Notifications

```typescript
import { SupabaseNotificationService } from '@/services/SupabaseNotificationService';

// Document approval
await SupabaseNotificationService.notifyDocumentApproval(
  userId,
  documentId,
  'Budget Report 2024',
  true
);

// Document submission
await SupabaseNotificationService.notifyDocumentSubmission(
  [recipientId1, recipientId2],
  documentId,
  'Emergency Request',
  'John Doe',
  true // isEmergency
);

// Meeting notification
await SupabaseNotificationService.notifyMeeting(
  [userId1, userId2],
  'Budget Review Meeting',
  '2024-02-15 10:00 AM',
  '/meetings/123'
);
```

## Cache Strategy

### localStorage as Cache Only
- **Purpose:** Instant UI on page load
- **TTL:** 60 seconds
- **Scope:** Per user (user_id in cache key)
- **Fallback:** Used only when Supabase fetch fails
- **No Direct Writes:** All writes go through Supabase

## Migration Steps

### 1. Run Migration
```bash
# In Supabase Dashboard SQL Editor
# Run: supabase/migrations/20240135_notifications_system.sql
```

### 2. Verify Tables
```sql
SELECT * FROM notifications LIMIT 1;
SELECT * FROM notification_counts;
```

### 3. Clear Old Cache
```typescript
localStorage.removeItem('notifications-cache');
localStorage.removeItem('notifications');
localStorage.removeItem('iaoms-notifications');
```

## Testing Checklist

- [ ] Notifications load on page refresh
- [ ] Real-time updates work (insert/update/delete)
- [ ] Mark as read updates immediately
- [ ] Mark all as read works
- [ ] Delete notification works
- [ ] Clear all works
- [ ] Unread count updates correctly
- [ ] Urgent count updates correctly
- [ ] Cache loads instantly on page load
- [ ] Cache falls back on Supabase error
- [ ] RLS prevents viewing other users' notifications
- [ ] Document triggers create notifications

## Benefits Achieved

✅ **Supabase as Source of Truth** - All data persists in database
✅ **Real-Time Updates** - Instant UI sync across devices
✅ **localStorage as Cache Only** - Fast initial load, no data loss
✅ **Cross-Device Sync** - Notifications sync across all devices
✅ **Role-Based Access** - RLS ensures proper permissions
✅ **Scalable Architecture** - Handles multiple users efficiently
✅ **Optimistic Updates** - Instant UI feedback
✅ **Error Recovery** - Cache fallback on failures
✅ **Type Safety** - TypeScript interfaces throughout
