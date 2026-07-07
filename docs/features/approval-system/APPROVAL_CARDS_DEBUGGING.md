# Approval Cards Not Showing - Debugging Guide

## Problem
Selected recipients are not receiving approval cards in Approval Center.

## Root Cause
Recipient ID mismatch between:
1. What's stored in approval cards (`recipientIds`)
2. What user has after login (`user.id`)

## Complete Data Flow

### **Step 1: Document Submission**
```typescript
// RecipientSelector loads from local storage
recipients = [
  { user_id: 'uuid-123', name: 'Dr. Smith', role: 'Principal' },
  { user_id: 'uuid-456', name: 'Mr. Doe', role: 'EMPLOYEE' }
]

// User selects recipients
selectedRecipients = ['uuid-123', 'uuid-456']

// Approval card created
approvalCard = {
  id: 'DOC-123',
  title: 'Budget Request',
  recipientIds: ['uuid-123', 'uuid-456']  // ✅ UUIDs stored
}

// Saved to localStorage
localStorage.setItem('pending-approvals', JSON.stringify([approvalCard]))
```

### **Step 2: User Login**
```typescript
// User logs in as Principal
login('principal')

// AuthContext queries local storage
recipients = await workflowService.getRecipients()

// Finds matching recipient
recipient = recipients.find(r => r.role === 'Principal')
// Returns: { user_id: 'uuid-123', name: 'Dr. Smith', ... }

// Creates authenticated user
user = {
  id: 'uuid-123',  // ✅ Same UUID
  name: 'Dr. Smith',
  role: 'principal'
}

// Stored in sessionStorage
sessionStorage.setItem('iaoms-user', JSON.stringify(user))
```

### **Step 3: Approval Center Check**
```typescript
// Approvals.tsx loads cards
const cards = JSON.parse(localStorage.getItem('pending-approvals'))

// For each card, check if user should see it
cards.filter(doc => {
  const currentUserId = user?.id  // 'uuid-123'
  
  return doc.recipientIds.some(recipientId => {
    // Check UUID match
    if (recipientId === currentUserId) {
      console.log('✅ UUID MATCH')
      return true  // ✅ User sees card
    }
    return false
  })
})
```

## Debugging Checklist

### ✅ **1. Verify RecipientSelector Returns UUIDs**
```typescript
// In RecipientSelector.tsx
console.log('Recipients loaded:', allRecipients)
// Should show: [{ id: 'uuid-123', name: 'Dr. Smith', ... }]
```

### ✅ **2. Verify Approval Card Has UUIDs**
```typescript
// In Documents.tsx after submission
console.log('Approval card created:', approvalCard)
// Should show: { recipientIds: ['uuid-123', 'uuid-456'] }
```

### ✅ **3. Verify User Has Correct UUID**
```typescript
// In AuthContext.tsx after login
console.log('User authenticated:', user)
// Should show: { id: 'uuid-123', name: 'Dr. Smith', ... }
```

### ✅ **4. Verify Matching Logic**
```typescript
// In Approvals.tsx
console.log('Checking card for user:', user.id)
console.log('Card recipientIds:', doc.recipientIds)
console.log('Match found:', doc.recipientIds.includes(user.id))
```

## Common Issues

### **Issue 1: Different ID Formats**
```typescript
// ❌ WRONG
recipientIds: ['principal-dr.-smith-principal']  // Role-based ID
user.id: 'uuid-123'  // UUID

// ✅ CORRECT
recipientIds: ['uuid-123']  // UUID
user.id: 'uuid-123'  // UUID
```

### **Issue 2: User Logs In Before Card Created**
```typescript
// User logs in → user.id = 'uuid-123'
// Document submitted → recipientIds = ['uuid-456']
// ❌ No match because different users
```

### **Issue 3: Database Has No Matching User**
```typescript
// RecipientSelector shows: 'uuid-123'
// Database has: 'uuid-456' (different user)
// Login finds: 'uuid-456'
// ❌ No match because IDs don't align
```

## Testing Steps

### **Test 1: Single User Flow**
1. Login as Principal → Note `user.id` in console
2. Submit document → Select Principal as recipient
3. Check console: `recipientIds` should contain same UUID
4. Go to Approval Center → Card should appear

### **Test 2: Multiple Recipients**
1. Login as Employee → Note `user.id`
2. Submit document → Select Employee + Principal
3. Logout → Login as Principal
4. Both users should see card in Approval Center

### **Test 3: Data Verification**
```
// Check recipients data in localStorage
// Open browser dev tools > Application > Local Storage
// Check for recipients data and verify UUIDs match approval cards
// Check localStorage: pending-approvals
```

## Expected Console Output

### **On Document Submission:**
```
✅ [Document Submission] User Info: { name: 'Dr. Smith', role: 'principal' }
📋 Selected recipient IDs: ['uuid-123', 'uuid-456']
✅ Approval card created for recipients: Dr. Smith, Mr. Doe
💾 SAVED TO LOCALSTORAGE: New cards created: 1
```

### **On Login:**
```
✅ [AuthContext] User authenticated: { id: 'uuid-123', name: 'Dr. Smith', role: 'principal' }
```

### **On Approval Center Load:**
```
🔍 Checking card "Budget Request" for user: Dr. Smith (principal) [uuid-123]
📋 Checking recipientIds: ['uuid-123', 'uuid-456']
  "uuid-123" -> UUID MATCH
✅ Matches recipientIds
```

## Solution Summary

The fix requires:
1. ✅ RecipientSelector uses `user_id` from database
2. ✅ Approval cards store these UUIDs in `recipientIds`
3. ✅ AuthContext sets `user.id` to `recipient.user_id`
4. ✅ Approvals.tsx checks `recipientId === user.id`

All these are **already implemented** in the previous fixes!

## If Still Not Working

Check these files have the fixes:
- `Approvals.tsx` - UUID matching added
- `recipientMatching.ts` - UUID check added
- `AuthContext.tsx` - Uses `recipient.user_id`
- `RecipientSelector.tsx` - Returns `r.user_id` as `id`
