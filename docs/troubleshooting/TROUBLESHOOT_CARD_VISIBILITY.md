# Troubleshooting: Tracking Document Card Not Appearing & Recipients Not Receiving Cards

## Problem Summary
- Tracking document cards are not appearing in Track Documents page
- Selected recipients are not receiving approval cards in Approval Center

## Root Causes Identified

### 1. **Track Documents Visibility**
Tracking cards are designed to be visible ONLY to the document submitter.

**Behavior**: `DocumentTracker.tsx`
- Shows cards only to the user who submitted the document
- Recipients see approval cards in Approval Center instead
- This is intentional design for separation of concerns

### 2. **Incomplete Recipient Matching in Approval Center**
The recipient matching logic wasn't handling all role format variations.

**Fixed in**: `Approvals.tsx`
- Added more flexible role matching patterns
- Handles spaces, hyphens, and partial matches
- Added support for "Program Head" vs "Program-Head" variations

## How to Verify the Fix

### Step 1: Run the Diagnostic Script
1. Open your browser's Developer Console (F12)
2. Copy and paste the contents of `debug-cards.js`
3. Press Enter to run the diagnostic
4. Review the output for any issues

### Step 2: Check User Profile
1. Go to Profile page
2. Fill out Personal Information form:
   - Name (e.g., "Dr. Robert Principal")
   - Department
   - Designation (must match your role, e.g., "Principal")
3. Save the profile

### Step 3: Test Document Submission
1. Go to Document Management page
2. Submit a test document:
   - Title: "Test Document"
   - Type: Letter
   - Upload a file
   - Select recipients (e.g., Principal, Registrar, HOD)
   - Priority: Normal
   - Add description
3. Click Submit

### Step 4: Verify Tracking Card
1. Go to Track Documents page
2. You should see your submitted document
3. Check console logs for filtering debug info
4. Verify the card shows:
   - Document title
   - Workflow progress
   - Recipients list

### Step 5: Verify Approval Cards
1. Log in as a recipient (e.g., Principal)
2. Go to Approval Center
3. You should see the approval card
4. Check console logs for recipient matching debug info

## Common Issues & Solutions

### Issue 1: No Cards Appearing at All
**Symptoms**: Both Track Documents and Approval Center are empty

**Solutions**:
1. Check localStorage:
   ```javascript
   console.log('Tracking cards:', JSON.parse(localStorage.getItem('submitted-documents') || '[]'));
   console.log('Approval cards:', JSON.parse(localStorage.getItem('pending-approvals') || '[]'));
   ```
2. If empty, submit a new document
3. Check browser console for errors during submission

### Issue 2: Tracking Card Appears But Approval Cards Don't
**Symptoms**: Submitter sees card in Track Documents, but recipients don't see it in Approval Center

**Solutions**:
1. Check recipient IDs in tracking card:
   ```javascript
   const docs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
   console.log('Recipients:', docs[0]?.workflow?.recipients);
   ```
2. Verify recipient IDs match the format: `role-name-department`
3. Check if approval cards were created:
   ```javascript
   const approvals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
   console.log('Approval cards:', approvals);
   ```

### Issue 3: Cards Appear for Some Recipients But Not Others
**Symptoms**: Some recipients see cards, others don't

**Solutions**:
1. Check role matching in console logs
2. Verify user profile designation matches their role exactly
3. Check for typos in recipient selection
4. Ensure recipient IDs are in correct format

### Issue 4: Cards Disappear After Page Refresh
**Symptoms**: Cards visible initially but gone after refresh

**Solutions**:
1. Check if localStorage is being cleared
2. Verify events are being dispatched correctly
3. Check for JavaScript errors in console
4. Ensure user profile is saved

## Debug Console Commands

### View All Tracking Cards
```javascript
JSON.parse(localStorage.getItem('submitted-documents') || '[]').forEach((doc, i) => {
  console.log(`${i+1}. ${doc.title} - Submitted by: ${doc.submittedBy}`);
  console.log('   Recipients:', doc.workflow?.recipients);
});
```

### View All Approval Cards
```javascript
JSON.parse(localStorage.getItem('pending-approvals') || '[]').forEach((card, i) => {
  console.log(`${i+1}. ${card.title} - For: ${card.recipients?.join(', ')}`);
  console.log('   Recipient IDs:', card.recipientIds);
});
```

### Check Current User Info
```javascript
const profile = JSON.parse(localStorage.getItem('user-profile') || '{}');
const auth = JSON.parse(localStorage.getItem('auth-user') || '{}');
console.log('Profile:', profile);
console.log('Auth:', auth);
```

### Test Recipient Matching
```javascript
const userRole = 'principal'; // Change to your role
const cards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
cards.forEach(card => {
  const match = (card.recipientIds || []).some(id => 
    id.toLowerCase().includes(userRole.toLowerCase())
  );
  console.log(`${card.title}: ${match ? 'MATCH ✅' : 'NO MATCH ❌'}`);
});
```

### Clear All Cards (Reset)
```javascript
localStorage.removeItem('submitted-documents');
localStorage.removeItem('pending-approvals');
console.log('All cards cleared. Submit a new document to test.');
```

## Expected Behavior After Fix

### For Submitter:
1. Submit document → See tracking card in **Track Documents** page
2. Tracking card shows:
   - Document details
   - Workflow progress
   - All recipients
   - Current step
   - Signature status
3. Can view, download, and remove their own documents

### For Recipients:
1. Document submitted → Receive approval card in **Approval Center** page
2. Approval card shows:
   - Document details
   - View, Approve & Sign, Reject buttons
   - Comment section
3. Card visibility depends on workflow type:
   - **Sequential**: Only current recipient sees card
   - **Parallel**: All recipients see card simultaneously
4. Recipients do NOT see tracking cards (only submitters do)

## Testing Checklist

- [ ] User profile is filled out completely
- [ ] Document submission creates tracking card
- [ ] Tracking card appears in Track Documents for submitter
- [ ] Approval cards created in localStorage
- [ ] Recipients see approval cards in Approval Center
- [ ] Role matching works for all recipient types
- [ ] Console logs show correct filtering logic
- [ ] No JavaScript errors in console
- [ ] Cards persist after page refresh
- [ ] Workflow progresses correctly when approved

## Additional Notes

### Recipient ID Format
Recipient IDs should follow this format:
```
role-name-department-branch-year
```

Examples:
- `principal-dr.-robert-principal`
- `hod-dr.-cse-hod-cse`
- `registrar-prof.-sarah-registrar`

### Role Matching Priority
1. Exact role match (e.g., "principal" matches "principal")
2. Role in recipient ID (e.g., "hod" matches "hod-dr.-cse-hod-cse")
3. Department match (e.g., "CSE" matches recipient with CSE department)
4. Name match (e.g., "Dr. Robert" matches "Dr. Robert Principal")

### Event Flow
```
Document Submission
  ↓
Create Tracking Card → Save to localStorage
  ↓
Create Approval Cards → Save to localStorage
  ↓
Dispatch Events:
  - document-approval-created
  - approval-card-created
  - document-submitted
  ↓
Components Listen & Update:
  - DocumentTracker reloads
  - Approvals page reloads
  ↓
Cards Appear
```

## Contact & Support

If issues persist after following this guide:
1. Run the diagnostic script and save the output
2. Check browser console for errors
3. Verify localStorage contents
4. Check Network tab for failed requests
5. Review the console logs during document submission

## Files Modified
- `src/components/DocumentTracker.tsx` - Fixed filtering logic
- `src/pages/Approvals.tsx` - Improved recipient matching
- `debug-cards.js` - Diagnostic tool
- `TROUBLESHOOT_CARD_VISIBILITY.md` - This guide
