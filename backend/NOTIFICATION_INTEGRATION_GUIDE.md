# Web Push Notification Integration Guide

## Overview

The IAOMS notification system now uses **template-based push notifications** with urgency levels and consistent branding. This guide shows how to integrate notifications into your workflows.

---

## 🎯 Quick Start

### Frontend Integration

```typescript
import { supabase } from '@/lib/supabase';

// Get auth token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Call notification endpoint
const response = await fetch('/api/workflow-notifications/review-needed', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    assigneeId: 'user-uuid-here',
    docTitle: 'Budget Proposal 2025'
  })
});
```

---

## 📋 Available Endpoints

### 1. Emergency Notifications

**Endpoint:** `POST /api/workflow-notifications/emergency`

**Use Case:** System-wide critical alerts (fire drill, security breach, etc.)

**Request:**
```json
{
  "title": "Fire Drill",
  "urgency": "Critical",
  "description": "Evacuate building immediately via nearest exit"
}
```

**Response:**
```json
{
  "success": true,
  "sent": 45,
  "failed": 0
}
```

**Notification Behavior:**
- 🔴 **Urgency:** Critical
- 📳 **Vibration:** Heavy pattern [200,100,200,100,400]
- 🔔 **Sound:** Loud alert
- 🚫 **Dismissal:** Requires manual interaction
- 🎯 **Click:** Opens `/emergency`

**Frontend Example:**
```typescript
// src/components/emergency/EmergencyForm.tsx
async function broadcastEmergency(emergency: Emergency) {
  const { data: { session } } = await supabase.auth.getSession();
  
  await fetch('/api/workflow-notifications/emergency', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      title: emergency.title,
      urgency: emergency.urgency,
      description: emergency.description
    })
  });
}
```

---

### 2. Document Approved

**Endpoint:** `POST /api/workflow-notifications/document-approved`

**Use Case:** Notify submitter when document clears all approval stages

**Request:**
```json
{
  "submitterId": "uuid-of-submitter",
  "docTitle": "Budget Proposal 2025"
}
```

**Notification Behavior:**
- 🟢 **Urgency:** Normal
- 📳 **Vibration:** Subtle [50]
- 🔇 **Sound:** Silent
- ✅ **Dismissal:** Auto-dismiss
- 🎯 **Click:** Opens `/approvals`

**Frontend Example:**
```typescript
// When final approver approves
async function onFinalApproval(document: Document) {
  const { data: { session } } = await supabase.auth.getSession();
  
  await fetch('/api/workflow-notifications/document-approved', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      submitterId: document.submitted_by,
      docTitle: document.title
    })
  });
}
```

---

### 3. Review Needed

**Endpoint:** `POST /api/workflow-notifications/review-needed`

**Use Case:** Notify assignee when document requires their review

**Request:**
```json
{
  "assigneeId": "uuid-of-next-assignee",
  "docTitle": "Budget Proposal 2025"
}
```

**Notification Behavior:**
- 🟡 **Urgency:** High
- 📳 **Vibration:** Medium pattern [100,50,100]
- 🔔 **Sound:** Normal alert
- ⏱️ **Dismissal:** Auto-dismiss after 10s
- 🎯 **Click:** Opens `/approvals`

**Frontend Example:**
```typescript
// When document routed to next stage
async function routeToNextStage(document: Document, nextAssignee: User) {
  const { data: { session } } = await supabase.auth.getSession();
  
  await fetch('/api/workflow-notifications/review-needed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      assigneeId: nextAssignee.id,
      docTitle: document.title
    })
  });
}
```

---

### 4. Document Rejected

**Endpoint:** `POST /api/workflow-notifications/document-rejected`

**Use Case:** Notify submitter when document is returned for revision

**Request:**
```json
{
  "submitterId": "uuid-of-submitter",
  "docTitle": "Budget Proposal 2025"
}
```

**Notification Behavior:**
- 🟢 **Urgency:** Normal
- 📳 **Vibration:** Subtle [50]
- 🔇 **Sound:** Silent
- ✅ **Dismissal:** Auto-dismiss
- 🎯 **Click:** Opens `/approvals`

---

### 5. LiveMeet+ Request

**Endpoint:** `POST /api/workflow-notifications/livemeet-request`

**Use Case:** Notify recipients of new meeting request

**Request:**
```json
{
  "recipientIds": ["uuid1", "uuid2"],
  "requesterName": "Dr. S. Srinivasa Rao",
  "docTitle": "Budget Discussion",
  "format": "In-Person",
  "urgency": "Immediate"
}
```

**Notification Behavior:**
- 🟡 **Urgency:** High (if urgency="Immediate"), Normal otherwise
- 📳 **Vibration:** Medium or subtle
- 🔔 **Sound:** Based on urgency
- 🎯 **Click:** Opens `/calendar`

**Frontend Example:**
```typescript
// src/components/meetings/LiveMeetRequestModal.tsx
async function sendLiveMeetRequest(request: LiveMeetRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  
  await fetch('/api/workflow-notifications/livemeet-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      recipientIds: request.selectedRecipients.map(r => r.id),
      requesterName: session?.user?.user_metadata?.name || 'Unknown',
      docTitle: request.documentTitle,
      format: request.format, // "In-Person" | "Online"
      urgency: request.urgency // "Immediate" | "Normal"
    })
  });
}
```

---

### 6. LiveMeet+ Accepted

**Endpoint:** `POST /api/workflow-notifications/livemeet-accepted`

**Request:**
```json
{
  "requesterId": "uuid-of-requester",
  "responderName": "Mr. A. Ramesh",
  "docTitle": "Budget Discussion"
}
```

**Frontend Example:**
```typescript
// When recipient accepts request
async function acceptLiveMeetRequest(request: LiveMeetRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  
  await fetch('/api/workflow-notifications/livemeet-accepted', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      requesterId: request.requester_id,
      responderName: session?.user?.user_metadata?.name || 'Unknown',
      docTitle: request.document_title
    })
  });
}
```

---

### 7. LiveMeet+ Declined

**Endpoint:** `POST /api/workflow-notifications/livemeet-declined`

**Request:**
```json
{
  "requesterId": "uuid-of-requester",
  "responderName": "Mr. A. Ramesh"
}
```

---

### 8. Direct Message

**Endpoint:** `POST /api/workflow-notifications/direct-message`

**Use Case:** Notify user of new direct message

**Request:**
```json
{
  "recipientId": "uuid-of-recipient",
  "senderName": "Dr. S. Rao",
  "message": "Can we discuss the budget proposal?",
  "threadId": "thread-uuid"
}
```

**Notification Behavior:**
- 🟢 **Urgency:** Normal
- 📳 **Vibration:** Subtle [50]
- 🔇 **Sound:** Silent
- 🏷️ **Tag:** `chat-{threadId}` (collapses duplicates)
- 🎯 **Click:** Opens `/messages?thread={threadId}`

**Frontend Example:**
```typescript
// src/components/chat/MessageInput.tsx
async function sendMessage(message: string, threadId: string, recipientId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  // Insert message to database first
  await supabase.from('chat_messages').insert({
    thread_id: threadId,
    sender_id: session?.user?.id,
    body: message
  });
  
  // Send push notification
  await fetch('/api/workflow-notifications/direct-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      recipientId,
      senderName: session?.user?.user_metadata?.name || 'Unknown',
      message,
      threadId
    })
  });
}
```

---

### 9. Channel Message

**Endpoint:** `POST /api/workflow-notifications/channel-message`

**Use Case:** Notify channel members of new message

**Request:**
```json
{
  "recipientIds": ["uuid1", "uuid2", "uuid3"],
  "senderName": "Mr. A. Ramesh",
  "channelHandle": "iqac-2025",
  "message": "Meeting rescheduled to 3 PM",
  "excludeSenderId": "sender-uuid"
}
```

**Notification Title:** `"Mr. A. Ramesh · #iqac-2025"`

**Frontend Example:**
```typescript
// src/components/chat/ChannelView.tsx
async function sendChannelMessage(message: string, channel: Channel) {
  const { data: { session } } = await supabase.auth.getSession();
  
  // Insert message
  await supabase.from('chat_messages').insert({
    channel_id: channel.id,
    sender_id: session?.user?.id,
    body: message
  });
  
  // Notify all members except sender
  await fetch('/api/workflow-notifications/channel-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      recipientIds: channel.members,
      senderName: session?.user?.user_metadata?.name || 'Unknown',
      channelHandle: channel.handle,
      message,
      excludeSenderId: session?.user?.id
    })
  });
}
```

---

### 10. Attachment Notification

**Endpoint:** `POST /api/workflow-notifications/attachment`

**Request:**
```json
{
  "recipientId": "uuid-of-recipient",
  "senderName": "Dr. S. Rao",
  "fileName": "Budget_Report_2025.pdf",
  "threadId": "thread-uuid"
}
```

**Notification Title:** `"📎 New File from Dr. S. Rao"`

---

## 🔧 Backend Direct Usage

If you're working in backend services, you can call the dispatcher directly:

```typescript
import * as NotificationDispatcher from '../services/notificationDispatcher';

// Emergency
await NotificationDispatcher.notifyEmergency({
  title: 'Fire Drill',
  urgency: 'Critical',
  description: 'Evacuate immediately'
});

// Approval
await NotificationDispatcher.notifyReviewNeeded({
  assigneeId: 'user-uuid',
  docTitle: 'Budget Proposal 2025'
});

// LiveMeet+
await NotificationDispatcher.notifyLiveMeetRequest({
  recipientIds: ['uuid1', 'uuid2'],
  requesterName: 'Dr. Rao',
  docTitle: 'Budget Discussion',
  format: 'In-Person',
  urgency: 'Immediate'
});

// Chat (auto-selects template)
await NotificationDispatcher.notifyChatMessage({
  senderId: 'sender-uuid',
  senderName: 'Dr. Rao',
  recipientIds: ['uuid1', 'uuid2'],
  body: 'Hello team',
  threadId: 'thread-uuid',
  channelHandle: 'iqac-2025', // Optional
  linkedDocTitle: 'Budget 2025' // Optional
});
```

---

## 🎨 Notification Appearance

All notifications follow IAOMS branding:

- **Icon:** `/favicon.ico` (IAOMS logo)
- **Badge:** `/security-logo-transparent.png` (Security badge)
- **Title Prefix:** "IAOMS — " or emoji indicators
- **Consistent Formatting:** Truncated text, clear actions

---

## 🧪 Testing

### Test Emergency Alert
```bash
curl -X POST http://localhost:3001/api/workflow-notifications/emergency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Alert",
    "urgency": "Critical",
    "description": "This is a test"
  }'
```

### Test Review Notification
```bash
curl -X POST http://localhost:3001/api/workflow-notifications/review-needed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "assigneeId": "USER_UUID",
    "docTitle": "Test Document"
  }'
```

---

## ✅ Migration Checklist

- [ ] Replace generic `dispatchNotification` calls with template endpoints
- [ ] Update emergency broadcast to use `/emergency` endpoint
- [ ] Update approval workflows to use `/review-needed`, `/document-approved`, `/document-rejected`
- [ ] Update LiveMeet+ to use `/livemeet-request`, `/livemeet-accepted`, `/livemeet-declined`
- [ ] Update chat to use `/direct-message`, `/channel-message`, `/attachment`
- [ ] Test each notification type in browser
- [ ] Verify urgency levels (critical/high/normal) work correctly
- [ ] Confirm IAOMS branding appears on all notifications

---

## 🚀 Next Steps

1. **Identify trigger points** in your components where notifications should be sent
2. **Replace old notification code** with template endpoint calls
3. **Test thoroughly** across different browsers and devices
4. **Monitor logs** for any errors during notification delivery

**Questions?** Check the template implementations in `backend/src/services/pushService.ts`
