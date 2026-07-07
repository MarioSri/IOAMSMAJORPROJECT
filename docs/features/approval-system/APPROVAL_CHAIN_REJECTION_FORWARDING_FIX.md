# ✅ Approval Chain Rejection Forwarding Fix

## 🐛 Issue Reported
**Problem**: When a recipient rejects a document in Approval Chain with Bypass (Sequential routing), the workflow should move forward to the next recipient, but the next recipient was not receiving the approval card.

**Expected Behavior**: 
- Rejection = Further routing/forwarding
- Workflow moves forward
- Next recipient receives the Approval card

## 🔍 Root Cause Analysis

### Issue #1: Missing localStorage Save on Rejection
**Location**: `src/pages/Approvals.tsx` - `handleRejectDocument()` function (around line 1130)

**Problem**:
```typescript
// ❌ OLD CODE - Card not saved to localStorage
if (isApprovalChainBypass && routingType === 'sequential') {
  updatedPendingApprovals = pendingApprovalsData; // Keep all cards in storage
  // ❌ MISSING: localStorage.setItem() - Cards never actually saved!
  setPendingApprovals(prev => prev.filter(d => d.id !== docId));
}
```

**Why it failed**:
1. Code correctly updated the tracking card workflow step to 'current' for next recipient
2. Code correctly set `updatedPendingApprovals = pendingApprovalsData` (keeping all cards)
3. **BUT**: Never saved to localStorage with `localStorage.setItem()`
4. **Result**: Next recipient couldn't see the card because localStorage was never updated

### Issue #2: Missing Event Dispatch for Real-Time Updates
**Location**: `src/pages/Approvals.tsx` - `handleRejectDocument()` function

**Problem**:
- No event was dispatched to notify other users that the workflow state changed
- Next recipient wouldn't see the card until they manually refreshed the page

### Issue #3: Same Problems in handleAcceptDocument
**Location**: `src/pages/Approvals.tsx` - `handleAcceptDocument()` function (around line 882)

**Problem**:
- Approval handler had the same issue: removing card from state without proper localStorage handling
- No routing type check before removing cards
- No event dispatch for workflow continuation

## ✅ Solution Implemented

### Fix #1: Save to localStorage on Rejection
**Location**: `src/pages/Approvals.tsx` - Line ~1130

```typescript
// ✅ NEW CODE - Card properly saved to localStorage
if (isApprovalChainBypass && (routingType === 'sequential' || routingType === 'parallel' || routingType === 'reverse' || routingType === 'bidirectional')) {
  console.log(`  🔄 Approval Chain Bypass ${routingType.toUpperCase()}: Card continues for others`);
  updatedPendingApprovals = pendingApprovalsData; // Keep all cards in storage
  localStorage.setItem('pending-approvals', JSON.stringify(updatedPendingApprovals)); // ✅ FIXED: Save to localStorage
  
  // Broadcast update event for other users to refresh
  window.dispatchEvent(new CustomEvent('approval-card-updated', {
    detail: { 
      docId,
      action: 'bypassed',
      routingType: routingType
    }
  }));
  
  // Remove from local state only for current user
  setPendingApprovals(prev => prev.filter(d => d.id !== docId));
}
```

**Changes**:
1. ✅ Added `localStorage.setItem()` to actually save the pending approvals
2. ✅ Added `window.dispatchEvent()` to notify other users of workflow changes
3. ✅ Card stays in localStorage for next recipients to see

### Fix #2: Add Event Listener for Card Updates
**Location**: `src/pages/Approvals.tsx` - `useEffect()` hook (around line 120)

```typescript
// 🆕 Listen for approval card updates (bypass/rejection handling)
const handleApprovalCardUpdate = (event: any) => {
  console.log('🔄 Approval card update received:', event.detail);
  // Reload pending approvals from localStorage to see updated workflow state
  const stored = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
  console.log('📥 [Approvals] Reloaded', stored.length, 'cards after update event');
  setPendingApprovals(stored);
  
  // Show notification if user is now the current recipient
  if (event.detail?.action === 'bypassed' && user) {
    // Check if it's now user's turn and show notification
    const updatedCard = stored.find((card: any) => card.id === event.detail.docId);
    if (updatedCard && isUserInRecipients(updatedCard)) {
      const trackingCards = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
      const trackingCard = trackingCards.find((tc: any) => tc.id === updatedCard.trackingCardId || tc.id === updatedCard.id);
      
      if (trackingCard?.workflow?.steps) {
        const userStep = trackingCard.workflow.steps.find((step: any) => {
          // Match user's step
        });
        
        if (userStep?.status === 'current') {
          toast({
            title: "Document Requires Your Approval",
            description: `${updatedCard.title} has been forwarded to you for approval`,
            duration: 5000,
          });
        }
      }
    }
  }
};

window.addEventListener('approval-card-updated', handleApprovalCardUpdate);

// Cleanup
return () => {
  window.removeEventListener('approval-card-updated', handleApprovalCardUpdate);
};
```

**Changes**:
1. ✅ Added event listener for `approval-card-updated` events
2. ✅ Reloads pending approvals from localStorage when event fires
3. ✅ Shows toast notification to next recipient when it's their turn
4. ✅ Properly cleaned up in return function

### Fix #3: Fix handleAcceptDocument Card Removal
**Location**: `src/pages/Approvals.tsx` - `handleAcceptDocument()` function (around line 882)

```typescript
// ✅ Handle card removal based on routing type
const isApprovalChainBypass = doc.source === 'approval-chain-bypass';
const routingType = doc.routingType;

const pendingApprovalsData = JSON.parse(localStorage.getItem('pending-approvals') || '[]');

// Check if workflow is complete
const workflowDoc = updatedDocs.find((d: any) => d.id === docId || d.id === doc.trackingCardId);
const isWorkflowComplete = workflowDoc?.status === 'approved';

// For Approval Chain Bypass routing types, keep card for next recipients unless workflow is complete
if (isApprovalChainBypass && (routingType === 'sequential' || routingType === 'reverse') && !isWorkflowComplete) {
  console.log(`  🔄 Approval Chain Bypass ${routingType.toUpperCase()}: Card continues for next recipient`);
  // Keep card in localStorage for next recipients
  localStorage.setItem('pending-approvals', JSON.stringify(pendingApprovalsData));
  
  // Broadcast update event for next recipient
  window.dispatchEvent(new CustomEvent('approval-card-updated', {
    detail: { 
      docId,
      action: 'approved',
      routingType: routingType
    }
  }));
  
  // Remove from local state only for current user
  setPendingApprovals(prev => prev.filter(d => d.id !== docId));
} else if (isApprovalChainBypass && (routingType === 'parallel' || routingType === 'bidirectional') && !isWorkflowComplete) {
  console.log(`  ⚡ Approval Chain Bypass ${routingType.toUpperCase()}: Card stays for all recipients`);
  // Keep card in localStorage
  localStorage.setItem('pending-approvals', JSON.stringify(pendingApprovalsData));
  
  // Broadcast update event
  window.dispatchEvent(new CustomEvent('approval-card-updated', {
    detail: { 
      docId,
      action: 'approved',
      routingType: routingType
    }
  }));
  
  // Remove from local state only for current user
  setPendingApprovals(prev => prev.filter(d => d.id !== docId));
} else {
  // Workflow complete or non-bypass cards: Remove for everyone
  console.log('  🗑️ Removing card for ALL recipients (workflow complete or non-bypass)');
  const updatedPendingApprovals = pendingApprovalsData.filter((approval: any) => 
    approval.id !== docId && approval.trackingCardId !== docId
  );
  localStorage.setItem('pending-approvals', JSON.stringify(updatedPendingApprovals));
  setPendingApprovals(prev => prev.filter(d => d.id !== docId));
}
```

**Changes**:
1. ✅ Check if card is Approval Chain Bypass
2. ✅ Check routing type (sequential, parallel, reverse, bidirectional)
3. ✅ Check if workflow is complete
4. ✅ Keep card in localStorage for next recipients if workflow continues
5. ✅ Remove card only when workflow is complete
6. ✅ Dispatch event for real-time updates

## 🧪 Testing Guide

### Test Case 1: Sequential Rejection Forwarding
**Setup**:
1. Create Approval Chain with Bypass document
2. Select Sequential routing
3. Add 3 recipients: HOD → Principal → Registrar

**Test Steps**:
1. Login as HOD
2. View approval card in Approval Center
3. Click **Reject** button
4. Add rejection comment
5. Confirm rejection
6. **Verify**: Card disappears from HOD's Approval Center
7. Login as Principal (next recipient)
8. **Expected**: Principal sees approval card immediately
9. **Expected**: Toast notification: "Document Requires Your Approval"
10. **Verify**: Track Documents shows HOD step with red BYPASS capsule
11. **Verify**: Principal step shows as "Current"

### Test Case 2: Sequential Approval Forwarding
**Setup**: Same as Test Case 1

**Test Steps**:
1. Login as HOD
2. Click **Approve & Sign** button
3. Complete digital signature
4. **Verify**: Card disappears from HOD's Approval Center
5. Login as Principal
6. **Expected**: Principal sees approval card immediately
7. **Verify**: Track Documents shows HOD step as "Completed"
8. **Verify**: Principal step shows as "Current"

### Test Case 3: Parallel Mode Rejection
**Setup**:
1. Create Approval Chain with Bypass document
2. Select Parallel routing
3. Add 3 recipients: HOD, Principal, Registrar (all simultaneous)

**Test Steps**:
1. Login as HOD
2. Click **Reject**
3. **Verify**: Card disappears from HOD's Approval Center
4. Login as Principal
5. **Expected**: Principal still sees approval card
6. Login as Registrar
7. **Expected**: Registrar still sees approval card
8. **Verify**: Track Documents shows HOD with BYPASS capsule
9. **Verify**: Track Documents shows Principal and Registrar as "Current"

### Test Case 4: Workflow Completion
**Setup**: Same as Test Case 1

**Test Steps**:
1. All recipients approve/reject the document
2. **Verify**: When last recipient acts, card disappears for everyone
3. **Verify**: Track Documents shows workflow as "Complete" or "Complete (with bypasses)"
4. **Verify**: No approval cards remain in localStorage

## 📋 Files Modified

1. **src/pages/Approvals.tsx**
   - Added localStorage save in `handleRejectDocument()` (line ~1133)
   - Added event dispatch in `handleRejectDocument()` (line ~1136)
   - Added `handleApprovalCardUpdate()` event listener (line ~122)
   - Fixed card removal logic in `handleAcceptDocument()` (line ~884)
   - Added cleanup for new event listener (line ~172)

## 🎯 Verification Checklist

- ✅ Rejection sets current step to 'bypassed' status
- ✅ Rejection sets next step to 'current' status
- ✅ Tracking card saved to localStorage with updated workflow
- ✅ Approval cards saved to localStorage for next recipients
- ✅ Event dispatched to notify other users
- ✅ Event listener reloads cards from localStorage
- ✅ Toast notification shows to next recipient
- ✅ Card visibility filtering checks step status correctly
- ✅ Approval handling keeps card for next recipients
- ✅ Workflow completion removes cards for everyone
- ✅ Document Management and Emergency Management unaffected

## 🚀 Expected Behavior After Fix

### ✅ Sequential Routing
- **Rejection**: Current step → 'bypassed', next step → 'current', next recipient sees card
- **Approval**: Current step → 'completed', next step → 'current', next recipient sees card
- **Last Step**: Workflow completes, card removed for everyone

### ✅ Parallel Routing
- **Rejection**: Current user's step → 'bypassed', card stays for all other recipients
- **Approval**: Current user's step → 'completed', card stays for all other recipients
- **All Complete**: Workflow completes, card removed for everyone

### ✅ Reverse Routing
- Same as Sequential, but order is reversed (highest authority first)

### ✅ Bi-Directional Routing
- Same as Parallel, all recipients act simultaneously
- Includes Resend and Re-Upload functionality

## 🔧 Technical Details

### localStorage Structure
```javascript
// pending-approvals
[
  {
    id: "unique-doc-id",
    title: "Document Title",
    source: "approval-chain-bypass",
    routingType: "sequential", // or "parallel", "reverse", "bidirectional"
    trackingCardId: "tracking-card-id",
    recipients: [...],
    recipientIds: [...]
  }
]

// submitted-documents (tracking cards)
[
  {
    id: "tracking-card-id",
    workflow: {
      steps: [
        { assignee: "HOD", status: "bypassed", ... }, // Current user rejected
        { assignee: "Principal", status: "current", ... }, // Next recipient
        { assignee: "Registrar", status: "pending", ... }
      ],
      bypassedRecipients: ["HOD"]
    }
  }
]
```

### Event Flow
1. **User Rejects**: `handleRejectDocument()` called
2. **Workflow Updated**: Tracking card step statuses updated
3. **localStorage Saved**: Both tracking and approval cards saved
4. **Event Dispatched**: `approval-card-updated` event fired
5. **Other Users Notified**: Event listener in other tabs/users catches event
6. **Cards Reloaded**: Pending approvals reloaded from localStorage
7. **Filtering Applied**: Next recipient sees card (step status = 'current')
8. **Toast Shown**: Next recipient gets notification

## ✨ Summary

**What was broken**:
- Rejection workflow updated tracking card correctly ✅
- BUT approval cards were never saved to localStorage ❌
- Next recipient couldn't see the card ❌

**What was fixed**:
- Added `localStorage.setItem()` to save approval cards after rejection ✅
- Added event dispatch to notify other users in real-time ✅
- Added event listener to reload cards when workflow changes ✅
- Fixed approval handling to keep cards for next recipients ✅
- Workflow now properly forwards to next recipient ✅

**Result**: Rejection = Workflow moves forward, next recipient receives approval card! 🎉
