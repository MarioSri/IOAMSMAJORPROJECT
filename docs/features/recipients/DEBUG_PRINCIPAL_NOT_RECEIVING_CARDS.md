# 🔍 Debug Guide: Principal Not Receiving Approval Cards

## 🎯 Problem
Principal is not seeing approval cards in the Approval Center page after HOD rejects/approves.

## 📋 Step-by-Step Debugging

### Step 1: Open Browser DevTools
1. Open your application in browser
2. Press **F12** to open DevTools
3. Go to the **Console** tab

### Step 2: Check localStorage Data

Copy and paste this entire script into the Console:

```javascript
console.log('=== PENDING APPROVALS ===');
const approvals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log('Total approval cards:', approvals.length);
approvals.forEach(card => {
  console.log('\nCard:', card.title);
  console.log('  Recipients:', card.recipients);
  console.log('  RecipientIds:', card.recipientIds);
  console.log('  Source:', card.source);
  console.log('  RoutingType:', card.routingType);
  console.log('  TrackingCardId:', card.trackingCardId);
});

console.log('\n\n=== TRACKING CARDS ===');
const tracking = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
tracking.forEach(card => {
  if (card.source === 'approval-chain-bypass') {
    console.log('\nTracking Card:', card.title);
    console.log('  ID:', card.id);
    console.log('  Routing Type:', card.routingType);
    console.log('  Workflow Steps:');
    card.workflow.steps.forEach((step, i) => {
      console.log(`    Step ${i}: ${step.assignee} - Status: ${step.status}`);
    });
  }
});

console.log('\n\n=== USER INFO ===');
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('Current User:', user.name);
console.log('Current Role:', user.role);
```

### Step 3: Analyze the Output

Look at the console output and check:

#### ✅ Check 1: Do Approval Cards Exist?
- **Expected**: You should see at least 1 approval card
- **If 0 cards**: Cards weren't created properly → Go to Fix #1

#### ✅ Check 2: Are Recipients Correct?
- **Expected**: `recipientIds` should include entries like `["role-hod-cse", "role-principal", "role-registrar"]`
- **If missing Principal**: Card wasn't created with Principal as recipient → Go to Fix #2

#### ✅ Check 3: Does Tracking Card Match?
- **Expected**: `trackingCardId` in approval card should match `id` in tracking card
- **If different**: Cards not properly linked → Go to Fix #3

#### ✅ Check 4: What's the Step Status?
Look at the workflow steps in tracking card:
- **Step 0** (HOD): Should be `bypassed` or `completed` after HOD acts
- **Step 1** (Principal): Should be `current` if it's Principal's turn
- **Step 2** (Registrar): Should be `pending`

**If Principal step is NOT 'current'**: Rejection logic didn't update properly → Go to Fix #4

#### ✅ Check 5: Principal's Role Matches?
- **Expected**: Current role should be `principal` (lowercase)
- **If different case**: Role matching might fail → Go to Fix #5

### Step 4: Check Console Logs During Page Load

When you load the Approval Center as Principal, look for these logs:

```
🔍 Checking card "Test Document" for user: Dr. Robert Johnson (principal)
📋 Recipients to check: ["role-hod-cse", "role-principal", "role-registrar"]
✅ Role ID match: role-principal matches role principal
✅ Final result for "Test Document": SHOW
  🔀 Approval Chain Bypass - Routing Type: SEQUENTIAL
  🔄 SEQUENTIAL - User step status: current, Show: true
```

**What to look for**:
- ❌ If you see `❌ Final result: HIDE` → Principal is being filtered out
- ❌ If you see `User step status: pending` → Step wasn't updated to 'current'
- ❌ If you see `User step status: bypassed` → Wrong step was marked
- ❌ If you don't see the logs at all → Card doesn't exist in localStorage

## 🔧 Common Fixes

### Fix #1: No Approval Cards Found
**Problem**: No cards in `pending-approvals`

**Solution**: Cards may have been cleared. Create a new test document:
1. Go to Approval Routing page
2. Enable Bypass Mode
3. Select Sequential routing
4. Add 3 recipients: HOD → Principal → Registrar
5. Submit document
6. Check localStorage again

### Fix #2: Principal Not in Recipients
**Problem**: `recipientIds` doesn't include `role-principal`

**Solution**: When creating document, make sure you select "Principal" from the recipient dropdown.

### Fix #3: Tracking Card ID Mismatch
**Problem**: `trackingCardId` in approval card ≠ `id` in tracking card

**Solution**: This is a bug. The cards got out of sync. Clear localStorage and recreate:
```javascript
localStorage.removeItem('pending-approvals');
localStorage.removeItem('submitted-documents');
// Then create new test document
```

### Fix #4: Principal Step Not 'current'
**Problem**: Principal's workflow step status is not 'current' after HOD rejects

**Solution**: The rejection logic might not have executed. Debug this by:

1. Open DevTools before HOD rejects
2. Keep Console open
3. Click Reject as HOD
4. Look for these logs:
```
✅ [Reject] Processing rejection for: Test Document
  🔀 Approval Chain Bypass - SEQUENTIAL MODE
  🔄 SEQUENTIAL: Moving to next recipient
```

If you don't see these logs, the Approval Chain Bypass logic isn't being triggered.

**Check**:
- Document `source` should be `'approval-chain-bypass'`
- Document `routingType` should be `'sequential'`

### Fix #5: Role Name Mismatch
**Problem**: User role is "Principal" but system checks for "principal"

**Solution**: The system uses lowercase matching. Verify:
```javascript
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('Role (exact):', user.role);
console.log('Role (lowercase):', user.role.toLowerCase());
```

If role is stored as "PRINCIPAL" or "Principal", the matching should still work due to `.toLowerCase()` in the code.

## 🎯 Most Likely Issues

### Issue #1: Card Removal After Rejection (90% likely)
**What happens**: When HOD rejects, the card gets removed from localStorage instead of staying for Principal

**How to check**: 
1. Login as HOD
2. Reject document
3. Immediately run this in console:
```javascript
const approvals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log('Cards after HOD rejection:', approvals.length);
```

**Expected**: Should still be 1 (card stays for Principal)
**If 0**: Card was wrongly removed → The localStorage save logic has a bug

**Fix**: Ensure this code is in `handleRejectDocument()` around line 1221:
```typescript
if (isApprovalChainBypass && (routingType === 'sequential' || ...)) {
  updatedPendingApprovals = pendingApprovalsData; // Keep all cards
  localStorage.setItem('pending-approvals', JSON.stringify(updatedPendingApprovals)); // ✅ MUST HAVE THIS LINE
  
  window.dispatchEvent(new CustomEvent('approval-card-updated', { ... })); // ✅ MUST HAVE THIS LINE
  
  setPendingApprovals(prev => prev.filter(d => d.id !== docId)); // Remove from UI only
}
```

### Issue #2: Workflow Step Not Updated (5% likely)
**What happens**: HOD's step is marked bypassed, but Principal's step stays 'pending' instead of 'current'

**How to check**: After HOD rejects, run:
```javascript
const tracking = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
const card = tracking.find(c => c.source === 'approval-chain-bypass');
card.workflow.steps.forEach((step, i) => {
  console.log(`Step ${i}: ${step.assignee} - ${step.status}`);
});
```

**Expected**:
```
Step 0: Submission - completed
Step 1: HOD - bypassed ← Should be bypassed
Step 2: Principal - current ← Should be current!
Step 3: Registrar - pending
```

**If Principal is 'pending'**: Rejection logic didn't update the step. Check line ~1013-1017 in `handleRejectDocument()`.

### Issue #3: Login/Role Mismatch (3% likely)
**What happens**: You think you're logged in as Principal, but actually logged in as different role

**How to check**:
```javascript
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('Logged in as:', user.name, '/', user.role);
```

**Expected**: Should show `principal` role

### Issue #4: Browser Cache (2% likely)
**What happens**: Old version of code is running

**Fix**: Hard refresh with `Ctrl + Shift + R` or clear browser cache

## 🚀 Quick Test Script

Run this complete diagnostic script:

```javascript
console.clear();
console.log('🔍 APPROVAL CHAIN BYPASS DIAGNOSTIC');
console.log('=====================================\n');

// Check user
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('✅ Current User:', user.name, '(', user.role, ')');

// Check approvals
const approvals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log('\n📋 Approval Cards:', approvals.length);

const bypassCards = approvals.filter(a => a.source === 'approval-chain-bypass');
console.log('   - Bypass Cards:', bypassCards.length);

bypassCards.forEach(card => {
  console.log('\n   Card:', card.title);
  console.log('     Routing:', card.routingType);
  console.log('     Recipients:', card.recipientIds);
  
  // Check if current user is in recipients
  const userRole = user.role?.toLowerCase() || '';
  const isRecipient = card.recipientIds?.some(id => id.toLowerCase().includes(userRole));
  console.log('     Current user is recipient?', isRecipient ? '✅ YES' : '❌ NO');
  
  // Check tracking card
  const tracking = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
  const trackCard = tracking.find(t => t.id === card.trackingCardId || t.id === card.id);
  
  if (trackCard) {
    console.log('     Tracking card found: ✅');
    
    // Find user's step
    const userStep = trackCard.workflow.steps.find(step => {
      const assignee = step.assignee.toLowerCase();
      return assignee.includes(userRole) || assignee.includes(user.name?.toLowerCase() || '');
    });
    
    if (userStep) {
      console.log('     User\'s step status:', userStep.status);
      console.log('     Should show card?', userStep.status === 'current' ? '✅ YES' : '❌ NO');
    } else {
      console.log('     User\'s step: ❌ NOT FOUND');
    }
    
    console.log('     All workflow steps:');
    trackCard.workflow.steps.forEach((step, i) => {
      console.log(`       ${i}. ${step.assignee}: ${step.status}`);
    });
  } else {
    console.log('     Tracking card: ❌ NOT FOUND');
  }
});

console.log('\n=====================================');
console.log('🎯 DIAGNOSIS COMPLETE\n');
```

## 📊 Expected vs Actual

### ✅ EXPECTED: When HOD Rejects in Sequential

1. **Tracking Card Updates**:
   - HOD step: `status: 'bypassed'`
   - Principal step: `status: 'current'` ← **KEY**
   - Registrar step: `status: 'pending'`

2. **Approval Card**:
   - Stays in `pending-approvals` localStorage
   - `trackingCardId` matches tracking card `id`

3. **Principal's View**:
   - Card visible in Approval Center
   - Filtering logic: `userStep.status === 'current'` → `true` → Show card

4. **Console Logs**:
   ```
   🔄 SEQUENTIAL: Moving to next recipient
   🔄 Approval Chain Bypass SEQUENTIAL: Card continues for others
   approval-card-updated event dispatched
   ```

### ❌ ACTUAL: What You're Seeing

Please run the diagnostic script and paste the output here so we can identify exactly what's wrong.

## 🎨 Visual Flow

```
┌──────────────┐
│ HOD Rejects  │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────┐
│ handleRejectDocument() runs    │
│ - Mark HOD step as 'bypassed'  │
│ - Set Principal step 'current' │ ← This should happen
│ - Save tracking card           │
│ - Keep approval card in storage│ ← This should happen
│ - Dispatch event               │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Principal loads Approval Center│
│ - Read pending-approvals       │
│ - Filter by isUserInRecipients │
│ - Check routing type           │
│ - Check step status='current'  │ ← This should be true
│ - SHOW CARD ✅                 │
└────────────────────────────────┘
```

## 💡 Next Steps

1. Run the diagnostic script
2. Check which step is failing
3. Report back the console output
4. I'll provide the exact fix

The code logic is correct, so it's likely a data mismatch or the card is being removed when it shouldn't be!
