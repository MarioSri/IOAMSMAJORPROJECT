# Supabase Realtime Architecture

## Overview

The IAOMS application uses **Supabase Realtime** as its single, unified real-time communication system. All real-time features—document updates, notifications, chat messages, presence tracking, and workflow events—flow through Supabase's built-in PostgreSQL change subscriptions and broadcast channels.

**Key Benefits:**
- ✅ **Single Source of Truth** - Database is the real-time event source
- ✅ **Built-in Security** - Row-Level Security (RLS) at database level
- ✅ **Auto-reconnection** - Supabase handles connection recovery
- ✅ **Scalability** - Managed infrastructure, no server to maintain
- ✅ **Consistency** - Changes immediately visible to all subscribers

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   useSocket  │  │  useDeptChat │  │ useSupabase  │          │
│  │              │  │              │  │ Notifications│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                     │
│                   ┌────────▼────────┐                            │
│                   │ Supabase Client │                            │
│                   │  (JS Library)   │                            │
│                   └────────┬────────┘                            │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             │ WebSocket (wss://)
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│                    Supabase Realtime Server                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ postgres_changes │  │ Broadcast Channels│  │  Presence API   │ │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             │ PostgreSQL Protocol
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│                    PostgreSQL Database                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  documents   │  │ notifications│  │ chat_messages│           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  approvals   │  │  workflows   │  │ meeting_req  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└───────────────────────────────────────────────────────────────────┘
```

---

## Document Subscriptions

### How It Works

1. **Frontend subscribes** to document changes:
   ```typescript
   supabase
     .channel('documents-realtime')
     .on('postgres_changes', {
       event: '*',
       schema: 'public',
       table: 'documents'
     }, (payload) => {
       console.log('Document changed:', payload);
     })
     .subscribe();
   ```

2. **Backend updates** document:
   ```typescript
   await supabase
     .from('documents')
     .update({ status: 'approved' })
     .eq('id', documentId);
   ```

3. **Realtime event** fires automatically
4. **All subscribers** receive update instantly

### Document Events

| Event Type | Trigger | Frontend Handler |
|-----------|---------|------------------|
| INSERT | New document created | Add to document list |
| UPDATE | Document status changed | Update document in list |
| DELETE | Document deleted | Remove from list |

### Filtered Subscriptions

Subscribe to specific user's documents:
```typescript
supabase
  .channel('my-documents')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'documents',
    filter: `user_id=eq.${userId}`
  }, handler)
  .subscribe();
```

---

## User Presence Tracking

### Implementation

Supabase Presence API tracks online users in real-time.

**Frontend:**
```typescript
const channel = supabase.channel('presence_chat', {
  config: { presence: { key: userId } }
});

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const onlineUsers = Object.keys(state);
    console.log('Online users:', onlineUsers);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        userId,
        online_at: new Date().toISOString()
      });
    }
  });
```

### Presence Features

- **Automatic tracking** - Users tracked when they subscribe
- **Presence sync** - State synchronized across all clients
- **Auto-cleanup** - Inactive users removed automatically
- **Custom metadata** - Attach user data (status, avatar, etc.)

### Use Cases

1. **Chat** - Show online users in department chat
2. **Collaboration** - Display who's viewing a document
3. **Admin Dashboard** - Monitor active users
4. **Meetings** - Track participants in LiveMeet+

---

## Real-Time Notifications

### System Architecture

**Notification Flow:**
```
Backend Action → Insert notification → Supabase Realtime → Frontend receives → Show toast/browser notification
```

### Frontend Implementation

**Hook:** `useSupabaseNotifications.ts`

```typescript
const channel = supabase
  .channel(`notifications:${user.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${user.id}`
  }, (payload) => {
    const notification = payload.new;
    setNotifications(prev => [notification, ...prev]);

    // Show toast for urgent notifications
    if (notification.urgent) {
      showToast(notification.message);
    }

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message
      });
    }
  })
  .subscribe();
```

### Backend Triggering Notifications

**Using SupabaseRealtimeService:**

```typescript
import { realtimeService } from './services/SupabaseRealtimeService';

// Notify single user
await realtimeService.notifyUser(userId, {
  title: 'Document Approved',
  message: 'Your document has been approved',
  type: 'success',
  urgent: false
});

// Broadcast to all users
await realtimeService.broadcastAnnouncement(
  'System maintenance at 10 PM',
  'warning'
);
```

### Notification Types

| Type | Color | Use Case |
|------|-------|----------|
| `info` | Blue | General information |
| `success` | Green | Successful operations |
| `warning` | Yellow | Warnings, reminders |
| `error` | Red | Errors, failures |
| `emergency` | Red + Urgent | Critical alerts |
| `approval` | Blue | Approval requests |
| `submission` | Green | Document submissions |
| `reminder` | Yellow | Deadline reminders |
| `meeting` | Blue | Meeting invitations |

---

## Chat System

### Architecture

**Chat uses both postgres_changes and broadcast channels:**

1. **postgres_changes** - Persistent messages in database
2. **broadcast** - Ephemeral typing indicators

### Message Persistence

```typescript
// Subscribe to messages
supabase
  .channel(`chat_messages:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();
```

### Typing Indicators (Broadcast)

```typescript
// Send typing event
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { userId, channelId }
});

// Listen for typing
channel.on('broadcast', { event: 'typing' }, (payload) => {
  setTypingUsers(prev => [...prev, payload.userId]);
});
```

### Chat Auto-Cleanup

**Database Side (pg_cron):**

Migration: `20260305_chat_realtime_overhaul.sql`

- **Messages** - Deleted after 24 hours
- **Channels** - Deleted 7-14 days after workflow completion

**Schedule:**
```sql
-- Delete old messages (runs hourly)
SELECT cron.schedule(
  'delete_old_messages',
  '0 * * * *',
  $$DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '24 hours'$$
);

-- Delete completed channels (runs daily)
SELECT cron.schedule(
  'delete_old_channels',
  '0 0 * * *',
  $$DELETE FROM chat_channels WHERE ...$$
);
```

---

## Backend-Triggered Events

### SupabaseRealtimeService

**Location:** `backend/src/services/SupabaseRealtimeService.ts`

**Purpose:** Centralized service for backend to trigger Supabase real-time events.

### Available Methods

| Method | Purpose | Real-time Impact |
|--------|---------|------------------|
| `notifyUser()` | Send notification to user | Instant notification delivery |
| `notifyDocumentUpdate()` | Update document status | Document list updates |
| `notifyApprovalUpdate()` | Update approval status | Approval card updates |
| `broadcastAnnouncement()` | System-wide message | All users notified |
| `createChatMessage()` | Send chat message | Message appears in chat |
| `createLiveMeetRequest()` | Send meeting request | Recipient sees request |
| `updateWorkflowStep()` | Update workflow progress | Workflow UI updates |

### Usage Example

```typescript
import { realtimeService } from './services/SupabaseRealtimeService';

// In route handler
router.post('/documents/:id/approve', async (req, res) => {
  const { id } = req.params;

  // Update document
  await realtimeService.notifyDocumentUpdate(id, {
    status: 'approved'
  });

  // Notify document owner
  await realtimeService.notifyUser(document.user_id, {
    title: 'Document Approved',
    message: `Your document "${document.title}" has been approved`,
    type: 'success'
  });

  res.json({ success: true });
});
```

---

## Security

### Row-Level Security (RLS)

All real-time tables have RLS policies:

**Example: Notifications**
```sql
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
```

### JWT Authentication

**Middleware:** `backend/src/middleware/supabaseAuth.ts`

Verifies Supabase JWT tokens on API routes:

```typescript
import { supabaseAuth, requireRole } from './middleware/supabaseAuth';

// Protected route
router.post('/admin-action', supabaseAuth, requireRole('admin'), handler);

// Lightweight auth (no DB lookup)
router.get('/user-data', verifySupabaseToken, handler);
```

### Client-Side Security

**Supabase client uses:**
- **Anon Key** - Safe to expose, limited permissions
- **RLS Policies** - Server-side data filtering
- **JWT Tokens** - User authentication

---

## Performance & Optimization

### Rate Limiting

**Realtime Configuration:**
```typescript
createClient(url, key, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
```

### Caching Strategy

1. **localStorage** - Cache data locally
2. **Optimistic Updates** - Update UI immediately
3. **Refetch on Focus** - Catch missed events

**Example:**
```typescript
// Cache messages
localStorage.setItem(
  `chat_messages_cache_${channelId}`,
  JSON.stringify(messages)
);

// Load from cache first
const cached = localStorage.getItem(`chat_messages_cache_${channelId}`);
if (cached) {
  setMessages(JSON.parse(cached));
}

// Then fetch latest
const { data } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('channel_id', channelId);
```

### Connection Management

**Auto-reconnection:**
```typescript
channel.subscribe((status, err) => {
  if (status === 'SUBSCRIBED') {
    console.log('Connected to channel');
  } else if (status === 'CLOSED') {
    console.log('Connection closed, will auto-reconnect');
  } else if (status === 'CHANNEL_ERROR') {
    console.error('Channel error:', err);
  }
});
```

### Performance Monitoring

**Frontend:**
- Monitor subscription count (max ~20 per client)
- Unsubscribe from unused channels
- Use single channel for multiple table subscriptions

**Backend:**
- Monitor pg_cron execution
- Check Supabase Realtime logs
- Set up alerts for failed subscriptions

---

## Real-Time Features Summary

### ✅ Implemented Features

| Feature | Tables | Frontend Hook | Backend Service |
|---------|--------|---------------|-----------------|
| **Notifications** | `notifications` | `useSupabaseNotifications` | `realtimeService.notifyUser()` |
| **Chat Messages** | `chat_messages`, `chat_channels` | `useDepartmentChat` | `DepartmentChatService` |
| **Document Updates** | `documents` | `useSupabaseDocuments` | `realtimeService.notifyDocumentUpdate()` |
| **Approvals** | `document_approvals`, `approval_comments` | `useSupabaseApprovals` | `realtimeService.notifyApprovalUpdate()` |
| **LiveMeet+** | `live_meeting_requests` | `LiveMeetingService` | `realtimeService.createLiveMeetRequest()` |
| **Emergency Alerts** | `emergency_documents`, `emergency_notifications` | `SupabaseEmergencyService` | Emergency triggers |
| **Workflow Steps** | `workflow_steps`, `document_workflows` | `DocumentWorkflowContext` | `realtimeService.updateWorkflowStep()` |
| **Presence Tracking** | - | `useDepartmentChat` (presence API) | No backend needed |

---

## Troubleshooting

### Frontend not receiving events

**Check:**
1. Channel subscription status: `console.log(channel.state)`
2. RLS policies allow read access
3. Filter matches the user (e.g., `user_id=eq.${userId}`)
4. Supabase project has Realtime enabled

### Backend events not triggering

**Check:**
1. Supabase client configured with service role key
2. INSERT/UPDATE actually succeeded (check error)
3. Table is added to `supabase_realtime` publication:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE tablename;
   ```

### Connection issues

**Check:**
1. Network connectivity to Supabase
2. JWT token not expired
3. Subscription limit not exceeded (max ~20)
4. Browser console for WebSocket errors

---

## Migration from Socket.IO

### What Changed

**Before (Socket.IO):**
- Dual architecture (Socket.IO + Supabase Realtime)
- Custom WebSocket server on backend
- Manual event emission (`socket.emit()`)
- Server-side connection management

**After (Supabase Realtime):**
- Single unified system
- No custom WebSocket server needed
- Automatic event propagation via database changes
- Managed infrastructure

### Benefits

✅ **Simpler Architecture** - One less server to manage
✅ **Better Security** - RLS policies at database level
✅ **Auto-scaling** - Supabase handles infrastructure
✅ **Consistency** - Database is single source of truth
✅ **Built-in Features** - Presence, broadcasts, postgres_changes

### No Breaking Changes

Frontend already used Supabase Realtime exclusively. This migration only removed unused Socket.IO backend infrastructure.

---

## References

**Official Docs:**
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Presence](https://supabase.com/docs/guides/realtime/presence)
- [Broadcast](https://supabase.com/docs/guides/realtime/broadcast)

**Project Files:**
- Frontend: `src/hooks/useSocket.ts`, `src/hooks/useSupabaseNotifications.ts`
- Backend: `backend/src/services/SupabaseRealtimeService.ts`
- Middleware: `backend/src/middleware/supabaseAuth.ts`
- Migrations: `supabase/migrations/20260305_chat_realtime_overhaul.sql`

**Related Docs:**
- `docs/architecture/REAL_TIME_IMPLEMENTATION.md`
- `docs/features/documents/TRACK_DOCUMENTS_SUPABASE_REALTIME.md`
- `docs/SUPABASE_INTEGRATION_SUMMARY.md`
