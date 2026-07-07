# Troubleshooting: Cards Not Showing After Document Submission

## 🔍 Issue
Tracking document cards and approval cards are not appearing for selected recipients when a user submits a document from the Document Management page.

---

## ✅ **FIXES APPLIED**

### Fix #1: Added `trackingCardId` to Approval Cards

**Problem**: The sequential flow visibility check requires `trackingCardId` to link approval cards to their tracking cards, but this field was missing.

**Solution**: Added `trackingCardId: trackingCard.id` to both approval card creation paths:
- Custom assignments section (line 241)
- Default all-recipients section (line 273)

**Files Modified**:
- `src/pages/Documents.tsx` (Lines 230-275)

**Code Changes**:
```typescript
// Both approval card objects now include:
trackingCardId: trackingCard.id, // Link to tracking card for sequential flow
```

---

## 🧪 **DEBUGGING STEPS**

### Step 1: Check Browser Console

Open Developer Tools (F12) and check the Console tab when submitting a document. You should see:

```
📄 Creating Document Management Approval Card(s)
  📋 Selected recipient IDs: [...array of recipient IDs...]
  📎 Document assignments: {...}
📋 No custom assignments - creating single approval card for all recipients
  🔄 Converting: principal-dr.-robert-principal → Dr. Robert Principal
✅ Approval card created: { id: "DOC-...", title: "...", recipients: [...], recipientIds: [...], recipientCount: X }
✅ X Approval card(s) saved to localStorage. Total cards: X
📢 Dispatching document-approval-created event for tracking
📢 Dispatching approval-card-created event for: DOC-...
✅ Document Management submission complete: { trackingCardId: "DOC-...", approvalCardsCreated: X, ... }
```

**If you DON'T see these logs**:
- The `handleDocumentSubmit` function is not being called
- Check if DocumentUploader is properly wired with `onSubmit={handleDocumentSubmit}`

---

### Step 2: Check LocalStorage

In Browser Console, run:

```javascript
// Check tracking cards
JSON.parse(localStorage.getItem('submitted-documents'))

// Check approval cards  
JSON.parse(localStorage.getItem('pending-approvals'))
```

**Expected Results**:
- `submitted-documents`: Should contain your tracking card with workflow steps
- `pending-approvals`: Should contain approval card(s) with `trackingCardId` field

**If cards are missing from localStorage**:
- Check Step 1 console logs for errors during save
- Check browser localStorage quota (usually 5-10MB)
- Try: `localStorage.clear()` and resubmit

---

### Step 3: Check Approval Center Event Listeners

In Approval Center page, you should see console logs when the event fires:

```
📢 [Approvals] Approval card created event received
📋 [Approvals] New approval: { approval: {...} }
👤 [Approvals] Current user: XYZ | Role: ABC
🔍 [Approvals] Should show card "..." to current user: true/false
✅ [Approvals] Adding approval card to state
```

**If you DON'T see these logs**:
- Event listener not attached (check useEffect in Approvals.tsx)
- Event is dispatched before listener is ready (timing issue)
- Navigate away and back to Approval Center to trigger mount

---

### Step 4: Check Track Documents Component

The DocumentTracker should load tracking cards on mount:

```
📄 [Track Documents] Loading submitted documents: X documents
📋 [Track Documents] Documents: [{ id: "DOC-...", title: "...", submittedBy: "..." }]
```

**If you DON'T see your document**:
- Check Step 2 (localStorage) first
- Refresh the Track Documents page
- Check if filtering is hiding your document

---

### Step 5: Check Sequential Flow Visibility

When viewing Approval Center, for each card you should see:

```
📄 Document Management card "XYZ" - Is in recipients: true
  🔄 Sequential workflow check: {
    userRole: "hod",
    userStepIndex: 1,
    userStepStatus: "current",
    shouldShow: true
  }
```

**If `shouldShow: false`**:
- Check `userStepStatus` - should be "current" to show card
- If status is "pending", you're not first in workflow chain
- If status is "completed", you already approved it
- If userStepIndex is -1, role matching failed

---

## 🔧 **COMMON ISSUES & SOLUTIONS**

### Issue 1: Cards Show in LocalStorage but Not in UI

**Symptoms**: 
- `localStorage.getItem('pending-approvals')` shows cards
- Approval Center shows "No pending approvals"

**Causes**:
1. **Sequential flow blocking**: You're not the current workflow step
2. **Role mismatch**: Your user role doesn't match any workflow step
3. **Recipient filtering**: `isUserInRecipients()` returns false

**Solutions**:
```javascript
// Check if you're in recipients
const card = JSON.parse(localStorage.getItem('pending-approvals'))[0];
console.log('Card recipients:', card.recipientIds);
console.log('Your role:', user?.role);

// Check workflow step
const tracking = JSON.parse(localStorage.getItem('submitted-documents'))[0];
console.log('Workflow steps:', tracking.workflow.steps);
// Find which step has status: 'current'
```

**Quick Fix**: Login as the first recipient in the workflow chain

---

### Issue 2: Tracking Card Not Appearing

**Symptoms**:
- Approval cards show but Track Documents is empty
- Or vice versa

**Cause**: Different localStorage keys or component not loading

**Solution**:
```javascript
// Manually reload tracking cards
const stored = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
console.log('Tracking cards:', stored);

// If empty, resubmit document
// If has cards but UI doesn't show, refresh page
```

---

### Issue 3: Multiple Duplicate Cards

**Symptoms**:
- Same card appears multiple times
- Each submission creates duplicates

**Cause**: Event listeners not properly cleaned up or `unshift()` called multiple times

**Solution**:
```javascript
// Clear duplicates manually
const approvals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
const unique = approvals.filter((card, index, self) => 
  self.findIndex(c => c.id === card.id) === index
);
localStorage.setItem('pending-approvals', JSON.stringify(unique));

// Then refresh page
```

---

### Issue 4: "trackingCardId" Missing or Undefined

**Symptoms**:
- Console shows: `trackingCard` is undefined in Approvals.tsx
- Sequential flow check fails

**Cause**: Old cards created before the fix was applied

**Solution**:
```javascript
// Option 1: Clear old data and resubmit
localStorage.removeItem('pending-approvals');
localStorage.removeItem('submitted-documents');
// Then submit a new document

// Option 2: Add trackingCardId to existing cards
const approvals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
const tracking = JSON.parse(localStorage.getItem('submitted-documents') || '[]');

approvals.forEach(approval => {
  if (!approval.trackingCardId) {
    // Try to find matching tracking card
    const match = tracking.find(t => t.id === approval.id || t.id === approval.parentDocId);
    if (match) {
      approval.trackingCardId = match.id;
    }
  }
});

localStorage.setItem('pending-approvals', JSON.stringify(approvals));
```

---

## 🚀 **QUICK TEST PROCEDURE**

### Test 1: Submit New Document

1. **Clear old data** (in Console):
   ```javascript
   localStorage.removeItem('pending-approvals');
   localStorage.removeItem('submitted-documents');
   ```

2. **Login as a Faculty/Staff member**

3. **Go to Document Management**

4. **Submit a document** with:
   - Title: "Test Document"
   - Select 2-3 recipients (e.g., HOD → Principal → Registrar)
   - Upload at least 1 file
   - Click Submit

5. **Check Console** - Should see submission logs

6. **Go to Track Documents** - Should see your tracking card

7. **Login as first recipient** (e.g., HOD if HOD is first)

8. **Go to Approval Center** - Should see approval card

9. **Login as second recipient** (e.g., Principal)

10. **Go to Approval Center** - Should NOT see card yet (sequential flow)

11. **Login back as first recipient → Approve**

12. **Login as second recipient again** - Should NOW see card

---

### Test 2: Verify Sequential Flow

1. Submit document with recipients: [A, B, C]

2. Login as **User A**:
   - ✅ Should see card in Approval Center
   
3. Login as **User B**:
   - ❌ Should NOT see card (status = 'pending')
   
4. Login as **User C**:
   - ❌ Should NOT see card (status = 'pending')

5. Login as **User A** → Approve document

6. Login as **User B**:
   - ✅ Should NOW see card (status changed to 'current')
   
7. Login as **User C**:
   - ❌ Should NOT see card yet (status still 'pending')

---

## 📊 **VERIFICATION CHECKLIST**

After submitting a document, verify:

- [ ] Console shows "Document Management submission complete"
- [ ] `localStorage.getItem('submitted-documents')` contains tracking card
- [ ] `localStorage.getItem('pending-approvals')` contains approval card(s)
- [ ] Approval card has `trackingCardId` field
- [ ] Tracking card has `workflow.steps` array
- [ ] First workflow step has `status: 'current'`
- [ ] Remaining workflow steps have `status: 'pending'`
- [ ] Track Documents page shows the tracking card
- [ ] First recipient sees approval card in Approval Center
- [ ] Other recipients do NOT see card yet (sequential flow)
- [ ] After first approval, second recipient sees card

---

## 🐛 **KNOWN ISSUES**

### Issue: Static Demo Cards

The Approval Center also has 4 hardcoded static demo cards:
- Annual Budget Report
- Research Methodology Guidelines  
- PhD Application - Alice Johnson
- Equipment Purchase Request

These are always visible for demo purposes. Your Document Management cards appear BELOW these static cards.

**To identify your cards**:
- Look for cards with your document title
- Check "Submitted by" - should be your name
- Check "Submitted date" - should be today

---

## 💡 **HELPFUL CONSOLE COMMANDS**

### View All Cards
```javascript
console.table(JSON.parse(localStorage.getItem('pending-approvals')));
console.table(JSON.parse(localStorage.getItem('submitted-documents')));
```

### Find Your Card
```javascript
const approvals = JSON.parse(localStorage.getItem('pending-approvals'));
const yourCard = approvals.find(card => card.submitter === 'YOUR_NAME');
console.log('Your card:', yourCard);
```

### Check Workflow Status
```javascript
const tracking = JSON.parse(localStorage.getItem('submitted-documents'));
const yourDoc = tracking.find(doc => doc.title === 'YOUR_TITLE');
console.log('Workflow:', yourDoc?.workflow);
console.log('Current step:', yourDoc?.workflow.steps.find(s => s.status === 'current'));
```

### Force Reload Approvals
```javascript
// In Approval Center page console:
const stored = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log('Force loading', stored.length, 'approval cards');
// Then refresh page
```

---

## 📝 **SUMMARY OF FIX**

**What Was Wrong**:
- Approval cards were missing `trackingCardId` field
- Sequential flow visibility check couldn't find tracking card
- Cards were saved to localStorage but not visible due to undefined trackingCardId

**What Was Fixed**:
- Added `trackingCardId: trackingCard.id` to both approval card creation paths
- Now sequential flow can link approval cards → tracking cards → workflow steps
- Visibility filtering works correctly

**Status**: ✅ **FIXED** - Build successful, changes deployed

**Next Steps**:
1. Clear localStorage old data
2. Submit new test document
3. Verify cards appear using checklist above

---

**Last Updated**: November 4, 2025
**Fix Applied**: Added trackingCardId to approval cards in Documents.tsx
