# 🚀 Notification API Quick Reference

## Base URL
```
POST /api/workflow-notifications/{endpoint}
Authorization: Bearer {token}
Content-Type: application/json
```

---

## 🚨 Emergency
```typescript
POST /emergency
{ title, urgency, description }
→ Broadcasts to all users
→ Critical urgency, persistent
```

---

## 📋 Approval Workflow

### Document Approved
```typescript
POST /document-approved
{ submitterId, docTitle }
→ Normal urgency, silent
```

### Review Needed
```typescript
POST /review-needed
{ assigneeId, docTitle }
→ High urgency, medium vibration
```

### Document Rejected
```typescript
POST /document-rejected
{ submitterId, docTitle }
→ Normal urgency, silent
```

---

## 🟢 LiveMeet+

### Request
```typescript
POST /livemeet-request
{ recipientIds[], requesterName, docTitle, format, urgency }
→ High if urgency="Immediate", else normal
```

### Accepted
```typescript
POST /livemeet-accepted
{ requesterId, responderName, docTitle }
→ Normal urgency
```

### Declined
```typescript
POST /livemeet-declined
{ requesterId, responderName }
→ Normal urgency
```

---

## 💬 Chat

### Direct Message
```typescript
POST /direct-message
{ recipientId, senderName, message, threadId }
→ Normal urgency, collapses by thread
```

### Channel Message
```typescript
POST /channel-message
{ recipientIds[], senderName, channelHandle, message, excludeSenderId? }
→ Normal urgency
```

### Attachment
```typescript
POST /attachment
{ recipientId, senderName, fileName, threadId }
→ Normal urgency
```

---

## 🎨 Urgency Levels

| Level | Vibration | Sound | Interaction | Use Case |
|-------|-----------|-------|-------------|----------|
| **Critical** | Heavy [200,100,200,100,400] | Loud | Required | Emergency |
| **High** | Medium [100,50,100] | Normal | Auto | Review needed |
| **Normal** | Subtle [50] | Silent | Auto | Chat, approved |

---

## 📱 Frontend Template

```typescript
const { data: { session } } = await supabase.auth.getSession();

await fetch('/api/workflow-notifications/{endpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`
  },
  body: JSON.stringify({ /* params */ })
});
```

---

## 🧪 Test Command

```bash
curl -X POST http://localhost:3001/api/workflow-notifications/{endpoint} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ /* params */ }'
```

---

## ✅ All Notifications Include

- 🎨 IAOMS branding (favicon + security badge)
- 🎯 Deep linking to relevant page
- 📳 Urgency-based vibration
- 🔔 Smart sound control
- 🏷️ Proper notification grouping

---

**Full Documentation:** `NOTIFICATION_INTEGRATION_GUIDE.md`
