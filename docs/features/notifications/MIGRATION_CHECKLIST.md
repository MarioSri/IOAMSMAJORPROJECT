# Notifications Migration Checklist

## Pre-Migration

- [ ] Backup existing localStorage data (optional)
  ```javascript
  const backup = {
    notifications: localStorage.getItem('notifications'),
    notificationsCache: localStorage.getItem('notifications-cache'),
    iaomsNotifications: localStorage.getItem('iaoms-notifications')
  };
  console.log('Backup:', JSON.stringify(backup));
  ```

- [ ] Verify Supabase connection
  ```typescript
  import { supabase } from '@/lib/supabase';
  const { data, error } = await supabase.from('documents').select('count');
  console.log('Supabase connected:', !error);
  ```

- [ ] Confirm user authentication works
  ```typescript
  import { useAuth } from '@/contexts/AuthContext';
  const { user } = useAuth();
  console.log('User ID:', user?.id);
  ```

## Migration Steps

### Step 1: Run Database Migration
- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Copy contents of `supabase/migrations/20240135_notifications_system.sql`
- [ ] Execute the SQL
- [ ] Verify no errors in output

### Step 2: Verify Database Setup
- [ ] Check table exists
  ```sql
  SELECT COUNT(*) FROM notifications;
  ```

- [ ] Check indexes created
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename = 'notifications';
  ```

- [ ] Check RLS enabled
  ```sql
  SELECT relname, relrowsecurity 
  FROM pg_class 
  WHERE relname = 'notifications';
  ```

- [ ] Check real-time publication
  ```sql
  SELECT * FROM pg_publication_tables WHERE tablename = 'notifications';
  ```

### Step 3: Deploy Code Changes
- [ ] All new files created:
  - `src/hooks/useSupabaseNotifications.ts`
  - `src/services/SupabaseNotificationService.ts`
  - `supabase/migrations/20240135_notifications_system.sql`

- [ ] All files updated:
  - `src/components/dashboard/widgets/NotificationsWidget.tsx`
  - `src/components/notifications/NotificationCenter.tsx`
  - `src/contexts/NotificationContext.tsx`

- [ ] Build succeeds without errors
  ```bash
  npm run build
  ```

### Step 4: Clear Old Cache
- [ ] Clear localStorage
  ```javascript
  localStorage.removeItem('notifications-cache');
  localStorage.removeItem('notifications');
  localStorage.removeItem('iaoms-notifications');
  ```

- [ ] Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

## Post-Migration Testing

### Functional Tests

- [ ] **Load Test**
  - Refresh page
  - Notifications load correctly
  - Loading state shows briefly
  - No console errors

- [ ] **Create Test**
  ```typescript
  import { SupabaseNotificationService } from '@/services/SupabaseNotificationService';
  
  await SupabaseNotificationService.createNotification(userId, {
    title: 'Test Notification',
    message: 'Testing system',
    type: 'info',
    urgent: false,
    read: false,
    delivered_via: ['in-app']
  });
  ```
  - Notification appears immediately
  - Shows in widget
  - Shows in center

- [ ] **Mark as Read Test**
  - Click notification
  - Status updates to read
  - Unread count decreases
  - UI updates immediately

- [ ] **Mark All as Read Test**
  - Click "Mark all read"
  - All notifications marked read
  - Unread count becomes 0
  - UI updates immediately

- [ ] **Delete Test**
  - Click delete on notification
  - Notification removed
  - Count updates
  - UI updates immediately

- [ ] **Clear All Test**
  - Click "Clear all"
  - All notifications removed
  - Counts reset to 0
  - UI shows empty state

### Real-Time Tests

- [ ] **Multi-Tab Test**
  - Open app in two browser tabs
  - Create notification in tab 1
  - Verify appears in tab 2 automatically
  - Mark as read in tab 2
  - Verify updates in tab 1

- [ ] **Multi-Device Test** (if possible)
  - Open app on two devices
  - Create notification on device 1
  - Verify appears on device 2
  - Mark as read on device 2
  - Verify updates on device 1

- [ ] **Real-Time Subscription Test**
  - Open browser console
  - Look for: `📡 Notification subscription status: SUBSCRIBED`
  - Create notification
  - Look for: `📬 New notification:` log

### Performance Tests

- [ ] **Load Time**
  - Page loads in < 2 seconds
  - Notifications appear instantly (from cache)
  - Fresh data loads in background

- [ ] **Cache Test**
  - Load page (data fetched from Supabase)
  - Reload page within 60 seconds
  - Data loads instantly from cache
  - Fresh data still fetched in background

- [ ] **Large Dataset Test**
  - Create 50+ notifications
  - Widget still loads quickly
  - Scrolling is smooth
  - No performance issues

### Security Tests

- [ ] **RLS Test**
  - User A creates notification
  - User B cannot see User A's notification
  - Each user only sees their own

- [ ] **Authentication Test**
  - Log out
  - Notifications cleared
  - Log back in
  - Notifications load correctly

### Error Handling Tests

- [ ] **Network Error Test**
  - Disconnect internet
  - App shows cached data
  - Reconnect internet
  - Data syncs automatically

- [ ] **Supabase Error Test**
  - Simulate Supabase error (invalid query)
  - App falls back to cache
  - Error logged to console
  - UI remains functional

## Rollback Plan (If Needed)

### Quick Rollback
1. Revert code changes via git
   ```bash
   git revert <commit-hash>
   ```

2. Keep database table (no harm)
   - Old code will ignore new table
   - Can migrate again later

### Full Rollback
1. Revert code changes
2. Drop database table (optional)
   ```sql
   DROP TABLE IF EXISTS notifications CASCADE;
   DROP VIEW IF EXISTS notification_counts;
   ```

## Success Criteria

✅ All functional tests pass
✅ Real-time updates work
✅ Performance is acceptable
✅ Security tests pass
✅ No console errors
✅ UI remains fully functional
✅ Cross-device sync works

## Monitoring

### Check Notification Counts
```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE read = false) as unread,
  COUNT(*) FILTER (WHERE urgent = true) as urgent
FROM notifications;
```

### Check User Distribution
```sql
SELECT 
  user_id,
  COUNT(*) as notification_count
FROM notifications
GROUP BY user_id
ORDER BY notification_count DESC
LIMIT 10;
```

### Check Recent Activity
```sql
SELECT 
  title,
  type,
  created_at,
  read
FROM notifications
ORDER BY created_at DESC
LIMIT 20;
```

### Monitor Real-Time
- Check Supabase Dashboard → Database → Realtime
- Verify `notifications` table is listed
- Check connection count

## Maintenance

### Weekly
- [ ] Check notification counts per user
- [ ] Monitor database size
- [ ] Review error logs

### Monthly
- [ ] Run cleanup for old notifications
  ```typescript
  await SupabaseNotificationService.cleanupOldNotifications(userId, 30);
  ```
- [ ] Review performance metrics
- [ ] Check index usage

## Support

If issues arise:
1. Check browser console for errors
2. Check Supabase dashboard logs
3. Verify real-time subscription status
4. Check RLS policies
5. Review documentation

## Sign-Off

- [ ] Migration completed successfully
- [ ] All tests passed
- [ ] Documentation reviewed
- [ ] Team notified
- [ ] Monitoring in place

**Completed by:** _______________
**Date:** _______________
**Notes:** _______________
