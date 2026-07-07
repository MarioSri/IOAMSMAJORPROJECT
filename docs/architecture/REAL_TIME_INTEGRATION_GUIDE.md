# 🚀 Real-Time Document System Integration Guide

## ✅ **What's Implemented**

Your document management system now has **unified real-time integration** across all components:

- ✅ **Track Documents** - Real-time document tracking with live updates
- ✅ **Approval Center** - Real-time approval cards with recipient filtering  
- ✅ **Document Management** - Real-time document submission and workflow
- ✅ **Emergency Management** - Real-time emergency document handling
- ✅ **Approval Chain with Bypass** - Real-time bypass routing and notifications

---

## 🏗️ **Architecture Overview**

### **Core Services**
```
RealTimeDocumentService.ts     # Unified document management service
useRealTimeDocuments.ts        # React hook for real-time operations
RealTimeRecipientManager.tsx   # Dynamic recipient management
UnifiedDocumentSystem.tsx      # System integration wrapper
```

### **Integration Points**
```
Track Documents ←→ Real-time Service ←→ Approval Center
       ↕                    ↕                    ↕
Document Management ←→ Socket.IO + localStorage ←→ Emergency Management
       ↕                    ↕                    ↕
Approval Chain ←→ Real-time Events ←→ Recipient Management
```

---

## 🔧 **How to Use**

### **1. Wrap Your App**
```tsx
import { UnifiedDocumentSystem } from '@/components/UnifiedDocumentSystem';

function App() {
  return (
    <UnifiedDocumentSystem>
      <YourAppContent />
    </UnifiedDocumentSystem>
  );
}
```

### **2. Use Real-Time Hook**
```tsx
import { useRealTimeDocuments } from '@/hooks/useRealTimeDocuments';

function MyComponent() {
  const {
    trackDocuments,      // Real-time track documents
    approvalCards,       // Real-time approval cards
    submitDocument,      // Submit new document
    approveDocument,     // Approve document
    rejectDocument,      // Reject document
    updateRecipients,    // Update recipients in real-time
    loading,
    error
  } = useRealTimeDocuments();
  
  return (
    <div>
      <h3>Track Documents: {trackDocuments.length}</h3>
      <h3>Approval Cards: {approvalCards.length}</h3>
    </div>
  );
}
```

### **3. Submit Documents**
```tsx
// Document Management
const document = await submitDocument({
  title: 'New Document',
  type: 'Letter',
  description: 'Document description',
  recipients: ['Dr. Principal', 'Prof. Registrar'],
  recipientIds: ['principal-dr.-principal', 'registrar-prof.-registrar'],
  routingType: 'sequential', // or 'parallel', 'reverse', 'bidirectional'
  files: uploadedFiles
});

// Emergency Management
const emergencyDoc = await createEmergencyDocument({
  title: 'Emergency Document',
  description: 'Urgent matter',
  recipients: ['Dr. Principal'],
  recipientIds: ['principal-dr.-principal']
});

// Approval Chain with Bypass
const approvalChainDoc = await createApprovalChainDocument({
  title: 'Approval Chain Document',
  description: 'Document with bypass capability',
  recipients: ['Dr. Principal', 'Prof. Registrar'],
  recipientIds: ['principal-dr.-principal', 'registrar-prof.-registrar'],
  routingType: 'sequential' // Supports bypass on rejection
});
```

### **4. Handle Approvals**
```tsx
// Approve document
await approveDocument(documentId, 'Approved with comments');

// Reject document  
await rejectDocument(documentId, 'Needs revision');

// Update recipients in real-time
await updateRecipients(documentId, 
  ['Dr. Principal', 'Prof. New Recipient'],
  ['principal-dr.-principal', 'new-recipient-id']
);
```

---

## 📡 **Real-Time Features**

### **Live Updates**
- ✅ Document submissions appear instantly in Track Documents
- ✅ Approval cards appear instantly for selected recipients
- ✅ Workflow progress updates in real-time
- ✅ Recipient changes propagate immediately
- ✅ Approval/rejection updates across all components

### **Smart Filtering**
- ✅ Users only see documents they're involved in
- ✅ Approval cards filtered by recipient matching
- ✅ Sequential workflow shows cards only when it's user's turn
- ✅ Parallel workflow shows cards to all recipients simultaneously

### **Multi-Channel Notifications**
- ✅ Socket.IO for real-time updates
- ✅ LocalStorage events for cross-tab sync
- ✅ Custom events for component communication

---

## 🎯 **Routing Types**

### **Sequential** 📋
```
User A → User B → User C
```
- Cards appear one at a time
- Next recipient gets card after previous approval

### **Parallel** ⚡
```
User A ← Document → User B
       ↘         ↗
         User C
```
- All recipients get cards simultaneously
- Independent approval process

### **Reverse** 🔙
```
Principal → Dean → HOD → Faculty
```
- Top-down hierarchy approval
- Sequential from highest authority

### **Bidirectional** ↔️
```
User A ⇄ User B ⇄ User C
```
- Can resend to rejected recipients
- Supports document re-upload

---

## 🔍 **Recipient Matching**

### **Recipient ID Format**
```
role-name-designation
principal-dr.-robert-principal
registrar-prof.-sarah-registrar
hod-dr.-cse-hod
```

### **Matching Logic**
```typescript
// Role matching
user.role === 'principal' → 'principal-dr.-robert-principal'

// Name matching  
user.name === 'Dr. Robert' → 'principal-dr.-robert-principal'

// Department matching
user.department === 'CSE' → 'hod-dr.-cse-hod'
```

---

## 🚨 **Emergency Features**

### **Emergency Documents**
- ✅ Auto-escalation after timeout
- ✅ Multi-channel notifications (Email, SMS, Push, WhatsApp)
- ✅ Parallel routing for immediate attention
- ✅ Visual indicators (red border, pulse animation)

### **Approval Chain with Bypass**
- ✅ Rejection doesn't stop workflow
- ✅ Bypassed recipients marked clearly
- ✅ Workflow continues to next recipient
- ✅ Final status shows partial approval

---

## 🛠️ **Configuration**

### **Environment Variables**
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

### **Backend Integration**
```typescript
// Socket.IO Events
socket.emit('document-created', documentData);
socket.emit('document-approved', { documentId, approvedBy });
socket.emit('document-rejected', { documentId, rejectedBy });
socket.emit('recipients-updated', { documentId, recipients });
```

---

## 🧪 **Testing**

### **Real-Time Testing**
```javascript
// Open browser console and run:

// Create test document
window.realTimeDocumentService.submitDocument({
  title: 'Test Document',
  recipients: ['Dr. Principal'],
  recipientIds: ['principal-dr.-principal']
}, currentUser);

// Test recipient updates
window.realTimeDocumentService.updateRecipients(
  'doc-id', 
  ['Dr. Principal', 'Prof. Registrar'],
  ['principal-dr.-principal', 'registrar-prof.-registrar']
);
```

### **Debug Tools**
- ✅ System status indicator (development mode)
- ✅ Console logging for all events
- ✅ LocalStorage inspection tools
- ✅ Real-time connection status

---

## 📊 **Performance**

### **Optimizations**
- ✅ Debounced recipient updates
- ✅ Efficient event batching
- ✅ Smart re-rendering with React hooks
- ✅ LocalStorage caching with fallbacks

### **Scalability**
- ✅ Socket.IO room-based updates
- ✅ Pagination for large document lists
- ✅ Connection pooling and retry logic

---

## 🎉 **Summary**

Your document management system now has **complete real-time integration**:

1. **📄 Track Documents** - Shows all documents user is involved in with real-time updates
2. **✅ Approval Center** - Shows approval cards filtered by recipient with live workflow updates  
3. **📋 Document Management** - Submits documents with real-time routing and notifications
4. **🚨 Emergency Management** - Handles urgent documents with parallel routing and escalation
5. **🔗 Approval Chain with Bypass** - Supports bypass routing where rejections don't stop workflow

**All systems work together in real-time with:**
- ✅ Live recipient filtering
- ✅ Instant workflow updates  
- ✅ Cross-component synchronization
- ✅ Multi-channel notifications
- ✅ Smart routing based on document type

**To start using:** Import and use the `useRealTimeDocuments` hook in any component!
