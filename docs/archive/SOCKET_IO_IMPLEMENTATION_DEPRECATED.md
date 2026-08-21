# ⚠️ DEPRECATED - Socket.IO Implementation (No Longer Used)

> **Note:** This document describes an **OLD architecture** that has been **replaced** by Supabase Realtime.
> **See:** `docs/architecture/SOCKET_IO_MIGRATION_COMPLETE.md` and `docs/architecture/SUPABASE_REALTIME_ARCHITECTURE.md` for current implementation.
> **Migration Date:** March 18, 2026

---

# ~~✅ Socket.IO + Supabase Chat Integration Complete~~

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CHAT UI                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              React Hooks (useDepartmentChat)             │
└─────────┬───────────────────────────────────┬───────────┘
          │                                   │
          ▼                                   ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Socket.IO Client    │         │  Supabase Client     │
│  (Real-time)         │         │  (Data + Auth)       │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           ▼                                ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Node.js Server      │────────▶│  Supabase DB         │
│  (Transport Layer)   │  Verify │  (Source of Truth)   │
│  • JWT Auth          │   JWT   │  • chat_channels     │
│  • Room Management   │◀────────│  • chat_messages     │
│  • Event Relay       │  Fetch  │  • Auto-triggers     │
└──────────────────────┘  Data   └──────────────────────┘
```

## 📦 Deliverables

### 1. Socket.IO Server ✅
**File**: `backend/src/chat-server.ts`

**Features:**
- JWT verification using Supabase JWT secret
- Room-based authorization (checks channel membership)
- Real-time message relay
- Auto-disconnect on invalid/expired tokens
- Auto-delete messages after 24 hours
- Auto-delete channels after 1 week (if workflow completed)

**Key Functions:**
- `verifyToken()` - Validates JWT against Supabase
- `canAccessChannel()` - Checks user membership
- Auto-cleanup intervals for messages and channels

### 2. Socket.IO Client ✅
**File**: `src/services/SocketChatService.ts`

**Features:**
- Automatic JWT injection from Supabase session
- Reconnection with exponential backoff
- Fallback to Supabase Realtime on failure
- Event listeners: messages, typing, errors

**Methods:**
- `connect()` - Establishes connection with JWT
- `joinChannel()` - Joins room after auth
- `sendMessage()` - Sends via Socket.IO
- `onNewMessage()` - Listens for incoming messages

### 3. Auto-Channel Creation ✅
**File**: `supabase/migrations/20240127_auto_channel_creation.sql`

**Triggers:**
- `create_document_chat_channel()` - Auto-creates channel on document insert
- `check_workflow_completion()` - Marks channel for deletion when workflow completes

**Logic:**
- Extracts recipients from workflow_steps
- Adds submitter to members
- Creates private channel automatically
- Marks for deletion when status = approved/rejected

### 4. Updated Hooks ✅
**File**: `src/hooks/useDepartmentChat.ts`

**Changes:**
- Integrated Socket.IO connection on mount
- Socket.IO message sending (with Supabase fallback)
- Real-time message listener via Socket.IO
- Auto join/leave rooms on channel change

### 5. Configuration Files ✅
- `backend/chat-server-package.json` - Dependencies
- `backend/.env.chat.example` - Environment template

## 🔐 Authentication Flow

```
1. User logs in → Supabase Auth
2. Frontend gets JWT token
3. Socket.IO connects with JWT in handshake
4. Server verifies JWT with Supabase secret
5. Server extracts user_id from token
6. Server fetches user role from Supabase
7. User joins authorized rooms only
8. Invalid JWT → immediate disconnect
```

## 🚀 Deployment

### Step 1: Run Migrations (3 min)
```bash
# In Supabase Dashboard → SQL Editor
# 1. Run: supabase/migrations/20240126_department_chat.sql
# 2. Run: supabase/migrations/20240127_auto_channel_creation.sql
```

### Step 2: Setup Chat Server (5 min)
```bash
cd backend
npm install express socket.io @supabase/supabase-js jsonwebtoken cors

# Create .env.chat file
cp .env.chat.example .env.chat

# Add your Supabase credentials:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_JWT_SECRET (from Supabase Dashboard → Settings → API)

# Start server
npm run dev
```

### Step 3: Enable Realtime (1 min)
1. Supabase Dashboard → Database → Replication
2. Enable for `chat_channels`
3. Enable for `chat_messages`

### Step 4: Test
1. Create a document with recipients
2. Check chat section - channel auto-created ✅
3. Send message - appears instantly ✅
4. Open in another browser - real-time sync ✅

## 🔄 Auto-Deletion Rules

### Messages (24 hours)
```javascript
// Runs every hour
setInterval(async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await supabase.from('chat_messages').delete().lt('created_at', twentyFourHoursAgo);
}, 60 * 60 * 1000);
```

### Channels (1 week + workflow completed)
```javascript
// Runs daily
setInterval(async () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Only delete if workflow status = approved/rejected
}, 24 * 60 * 60 * 1000);
```

## ✨ Key Features

| Feature | Status |
|---------|--------|
| JWT Authentication | ✅ |
| Room Authorization | ✅ |
| Real-time Messages | ✅ |
| Auto-Channel Creation | ✅ |
| Message Auto-Delete (24h) | ✅ |
| Channel Auto-Delete (1w) | ✅ |
| Fallback to Supabase | ✅ |
| Multi-device Sync | ✅ |
| UI Unchanged | ✅ |

## 📝 Files Created

1. `backend/src/chat-server.ts` - Socket.IO server
2. `src/services/SocketChatService.ts` - Socket.IO client
3. `supabase/migrations/20240127_auto_channel_creation.sql` - Auto-triggers
4. `backend/chat-server-package.json` - Dependencies
5. `backend/.env.chat.example` - Config template
6. Updated `src/hooks/useDepartmentChat.ts` - Socket.IO integration
7. Updated `src/services/index.ts` - Exports

## 🎯 Result

```
✅ Supabase = Data + Auth + Source of Truth
✅ Socket.IO = Real-time Transport Layer
✅ Node.js = JWT Verification + Room Management
✅ Auto-Channels = Created on document submission
✅ Auto-Cleanup = Messages (24h) + Channels (1w)
✅ UI = Unchanged & Fully Functional
```

**Status:** ✅ COMPLETE  
**Architecture:** Production-ready  
**Next:** Deploy chat server and run migrations
