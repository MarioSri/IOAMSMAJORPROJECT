# 🚀 Quick Start - Deploy in 5 Minutes

## Step 1: Run Database Migration (2 minutes)

1. Open **Supabase Dashboard** (https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of:
   ```
   supabase/migrations/20240135_notifications_system.sql
   ```
6. Paste into SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for "Success" message

## Step 2: Verify Setup (1 minute)

Run this query in SQL Editor:
```sql
-- Should return 0 (empty table)
SELECT COUNT(*) FROM notifications;

-- Should return 6 indexes
SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'notifications';

-- Should return true (RLS enabled)
SELECT relrowsecurity FROM pg_class WHERE relname = 'notifications';
```

## Step 3: Clear Old Cache (30 seconds)

Open browser console (F12) and run:
```javascript
localStorage.removeItem('notifications-cache');
localStorage.removeItem('notifications');
localStorage.removeItem('iaoms-notifications');
location.reload();
```

## Step 4: Test (1 minute)

### Test 1: Create Notification
```typescript
// In browser console or component
import { SupabaseNotificationService } from '@/services/SupabaseNotificationService';

await SupabaseNotificationService.createNotification(
  'YOUR_USER_ID', // Get from useAuth()
  {
    title: 'Test Notification',
    message: 'Real-time test successful!',
    type: 'info',
    urgent: false,
    read: false,
    delivered_via: ['in-app']
  }
);
```

### Test 2: Verify Real-Time
1. Open app in two browser tabs
2. Create notification in tab 1
3. Should appear instantly in tab 2 ✅

## Step 5: Done! 🎉

Your notifications are now:
- ✅ Stored in Supabase
- ✅ Syncing in real-time
- ✅ Cached for performance
- ✅ Secured with RLS

## Troubleshooting

**Notifications not showing?**
```javascript
// Check Supabase connection
import { supabase } from '@/lib/supabase';
const { data, error } = await supabase.from('notifications').select('count');
console.log('Connected:', !error);
```

**Real-time not working?**
```javascript
// Check subscription status (should see in console)
// Look for: "📡 Notification subscription status: SUBSCRIBED"
```

**Still having issues?**
1. Check browser console for errors
2. Verify user is authenticated
3. Check Supabase dashboard logs
4. Review full docs: `docs/features/notifications/SUPABASE_REALTIME_INTEGRATION.md`

## What's Next?

- Read full documentation: `docs/features/notifications/README.md`
- Review API reference: `docs/features/notifications/QUICK_REFERENCE.md`
- Follow migration checklist: `docs/features/notifications/MIGRATION_CHECKLIST.md`

---

**Total Time:** ~5 minutes
**Difficulty:** Easy
**Risk:** Low (backward compatible)
