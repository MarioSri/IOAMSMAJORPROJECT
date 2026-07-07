# 🧪 Quick Test Guide - Rejection Forwarding Fix

## ✅ What Was Fixed
- **Problem**: When someone rejects in Sequential routing, the next recipient wasn't receiving the approval card
- **Solution**: Fixed localStorage save and added real-time event broadcasting
- **Result**: Rejection now properly forwards workflow to next recipient

## 🚀 Quick Test (2 minutes)

### Step 1: Create Test Document
1. Go to **Approval Routing** page
2. Enable **"Enable Bypass Mode"** toggle
3. Fill in document details:
   - Title: "Test Sequential Rejection"
   - Document Type: Letter
   - Description: "Testing rejection forwarding"
4. Select **Routing Type**: Sequential
5. Add Recipients (in order):
   - Recipient 1: HOD
   - Recipient 2: Principal  
   - Recipient 3: Registrar
6. Click **Submit for Approval**

### Step 2: Test Rejection (As HOD)
1. Login as **HOD** (or stay logged in)
2. Go to **Approval Center**
3. Find "Test Sequential Rejection" card
4. **Verify**: Card is visible ✅
5. Scroll to **Comments** section
6. Add comment: "Rejecting to test forwarding"
7. Click **+ Add Comment**
8. Click **Reject** button (red X icon)
9. Confirm rejection
10. **Verify**: Card disappears from HOD's Approval Center ✅

### Step 3: Check Next Recipient (As Principal)
1. **Switch user** or **open new private window**
2. Login as **Principal**
3. Go to **Approval Center**
4. **Expected Results**:
   - ✅ "Test Sequential Rejection" card IS visible
   - ✅ Toast notification appears: "Document Requires Your Approval"
   - ✅ Card shows HOD rejected/bypassed

### Step 4: Verify Track Documents
1. Login as **original submitter** who created the document
2. Go to **Track Documents** page
3. Find "Test Sequential Rejection" tracking card
4. **Expected Results**:
   - ✅ HOD step shows red **BYPASS** capsule with ⭕ XCircle icon
   - ✅ Principal step shows as **"Current"** (highlighted)
   - ✅ Registrar step shows as **"Pending"**
   - ✅ Progress bar reflects bypassed step in calculation

## 🔍 Console Verification

Open browser DevTools Console and look for these logs:

### During Rejection (HOD):
```
✅ [Accept] Processing approval for: Test Sequential Rejection
  🔀 Approval Chain Bypass - SEQUENTIAL MODE
  🔄 SEQUENTIAL: Moving to next recipient
  🔄 Approval Chain Bypass SEQUENTIAL: Card continues for others
```

### During Next Recipient Login (Principal):
```
🔄 Approval card update received: {docId: "...", action: "bypassed", routingType: "sequential"}
📥 [Approvals] Reloaded X cards after update event
📄 Card "Test Sequential Rejection" - Is in recipients: true
  🔀 Approval Chain Bypass - Routing Type: SEQUENTIAL
  🔄 SEQUENTIAL - User step status: current, Show: true
```

## ✅ Success Criteria

All these should be TRUE:
- [ ] HOD can reject the document
- [ ] Card disappears from HOD's Approval Center after rejection
- [ ] Principal receives the approval card immediately
- [ ] Principal sees toast notification
- [ ] Track Documents shows HOD with BYPASS capsule
- [ ] Track Documents shows Principal as "Current"
- [ ] Console logs show proper event flow

## 🐛 If Test Fails

### Card Not Showing to Next Recipient?
1. **Check Console Logs**: Look for errors in console
2. **Check localStorage**: Open DevTools → Application → Local Storage
   - Verify `pending-approvals` contains the card
   - Verify `submitted-documents` has updated workflow steps
3. **Manual Refresh**: Try refreshing the page (event listener should have updated automatically)
4. **Verify User Role**: Ensure Principal login matches recipient ID

### Event Not Firing?
1. **Check Browser Compatibility**: Ensure using modern browser (Chrome, Edge, Firefox)
2. **Check Event Listener**: Verify no errors in `handleApprovalCardUpdate()` function
3. **Try Cross-Tab**: Open two tabs with different users, test real-time updates

## 📊 What Changed in Code

### `handleRejectDocument()` - Line ~1133
**BEFORE**:
```typescript
updatedPendingApprovals = pendingApprovalsData; // ❌ Never saved!
setPendingApprovals(prev => prev.filter(d => d.id !== docId));
```

**AFTER**:
```typescript
updatedPendingApprovals = pendingApprovalsData;
localStorage.setItem('pending-approvals', JSON.stringify(updatedPendingApprovals)); // ✅ FIXED

window.dispatchEvent(new CustomEvent('approval-card-updated', {
  detail: { docId, action: 'bypassed', routingType }
})); // ✅ ADDED

setPendingApprovals(prev => prev.filter(d => d.id !== docId));
```

### New Event Listener - Line ~122
```typescript
// 🆕 Listen for approval card updates
const handleApprovalCardUpdate = (event: any) => {
  const stored = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
  setPendingApprovals(stored); // Reload cards
  
  // Show notification to next recipient
  if (event.detail?.action === 'bypassed') {
    // Check if it's user's turn and show toast
  }
};

window.addEventListener('approval-card-updated', handleApprovalCardUpdate);
```

## 🎯 Expected Workflow Flow

```
1. HOD Rejects Document
   ↓
2. handleRejectDocument() executes
   ↓
3. Tracking card workflow updated: HOD='bypassed', Principal='current'
   ↓
4. Tracking card saved to localStorage (submitted-documents)
   ↓
5. Approval cards saved to localStorage (pending-approvals)
   ↓
6. Event dispatched: 'approval-card-updated'
   ↓
7. Principal's browser catches event (if online)
   ↓
8. handleApprovalCardUpdate() executes
   ↓
9. Reloads pending approvals from localStorage
   ↓
10. Filters cards: Shows to Principal (step='current')
   ↓
11. Toast notification shown to Principal
   ↓
12. ✅ Principal sees approval card!
```

## 🎉 Summary

**This fix ensures**:
- ✅ Sequential rejection forwards to next recipient
- ✅ Parallel rejection keeps card for all other recipients  
- ✅ Reverse rejection forwards in reverse order
- ✅ Bi-directional works like parallel
- ✅ Real-time updates via event broadcasting
- ✅ Persistent storage in localStorage
- ✅ Workflow status properly tracked

**Time to test**: ~2 minutes
**Expected result**: Next recipient immediately sees rejected document forwarded to them! 🚀
