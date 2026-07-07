# Notifications Quick Reference

## Setup (One-Time)

1. **Run Migration**
   ```sql
   -- Execute in Supabase Dashboard
   -- File: supabase/migrations/20240135_notifications_system.sql
   ```

2. **Clear Old Cache**
   ```typescript
   localStorage.removeItem('notifications-cache');
   localStorage.removeItem('notifications');
   localStorage.removeItem('iaoms-notifications');
   ```

## Using the Hook

```typescript
import { useSupabaseNotifications } from '@/hooks/useSupabaseNotifications';

function MyComponent() {
  const {
    notifications,      // Array of notifications
    loading,           // Loading state
    unreadCount,       // Count of unread
    urgentCount,       // Count of urgent
    markAsRead,        // Mark single as read
    markAllAsRead,     // Mark all as read
    removeNotification, // Delete single
    clearAll,          // Delete all
    refresh            // Manual refresh
  } = useSupabaseNotifications();

  return (
    <div>
      <Badge>{unreadCount}</Badge>
      {notifications.map(n => (
        <div key={n.id} onClick={() => markAsRead(n.id)}>
          {n.title}
        </div>
      ))}
    </div>
  );
}
```

## Creating Notifications

```typescript
import { SupabaseNotificationService } from '@/services/SupabaseNotificationService';

// Document approved/rejected
await SupabaseNotificationService.notifyDocumentApproval(
  userId, documentId, documentTitle, approved
);

// New document submitted
await SupabaseNotificationService.notifyDocumentSubmission(
  [userId1, userId2], documentId, documentTitle, submitterName, isEmergency
);

// Status change
await SupabaseNotificationService.notifyDocumentStatusChange(
  userId, documentId, documentTitle, newStatus
);

// Meeting
await SupabaseNotificationService.notifyMeeting(
  [userId1, userId2], meetingTitle, meetingTime, meetingUrl
);

// Reminder
await SupabaseNotificationService.createReminder(
  userId, title, message, metadata
);

// Custom
await SupabaseNotificationService.createNotification(userId, {
  title: 'Title',
  message: 'Message',
  type: 'info', // 'info' | 'success' | 'warning' | 'error' | 'emergency' | 'approval' | 'submission' | 'reminder' | 'meeting'
  urgent: false,
  read: false,
  delivered_via: ['in-app'],
  metadata: {}
});
```

## Notification Types

- `info` - General information
- `success` - Success messages
- `warning` - Warnings
- `error` - Errors
- `emergency` - Emergency alerts
- `approval` - Approval notifications
- `submission` - Document submissions
- `reminder` - Reminders
- `meeting` - Meeting notifications

## Real-Time Features

✅ Auto-updates on INSERT
✅ Auto-updates on UPDATE
✅ Auto-updates on DELETE
✅ Per-user filtering
✅ Optimistic UI updates
✅ Cross-device sync

## Cache Behavior

- **Load:** Cache → Supabase → Update cache
- **Write:** Supabase → Real-time → Update cache
- **TTL:** 60 seconds
- **Scope:** Per user
- **Fallback:** Cache used on Supabase error

## Testing

```typescript
// Create test notification
const { createNotification } = useSupabaseNotifications();
await createNotification({
  title: 'Test',
  message: 'Testing real-time',
  type: 'info',
  urgent: false,
  read: false,
  delivered_via: ['in-app']
});
```

## Troubleshooting

**No notifications showing?**
- Check Supabase connection
- Verify user is authenticated
- Check browser console for errors

**Real-time not working?**
- Check subscription status in console
- Verify table in `supabase_realtime` publication
- Check Supabase dashboard logs

**Performance issues?**
- Run cleanup: `cleanupOldNotifications(userId, 30)`
- Check notification count per user
- Verify indexes are created
