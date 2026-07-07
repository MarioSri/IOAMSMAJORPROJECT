# Test Recipient Card Visibility

## Quick Test Steps

### 1. Run Diagnostic Script
Open browser console (F12) and paste:
```javascript
// Check approval cards
const cards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log('Total approval cards:', cards.length);

// Check current user
const user = JSON.parse(localStorage.getItem('auth-user') || '{}');
console.log('Current user role:', user.role);

// Test matching
cards.forEach(card => {
  const recipients = card.recipientIds || card.recipients || [];
  const matches = recipients.filter(r => 
    r.toLowerCase().includes(user.role?.toLowerCase() || '')
  );
  console.log(`${card.title}: ${matches.length > 0 ? 'MATCH ✅' : 'NO MATCH ❌'}`);
  if (matches.length === 0) {
    console.log('  Recipients:', recipients);
    console.log('  Your role:', user.role);
  }
});
```

### 2. Check Recipient IDs Format
Recipient IDs should contain the role name:
- ✅ `principal-dr.-robert-principal` (contains "principal")
- ✅ `hod-dr.-cse-hod-cse` (contains "hod")
- ✅ `registrar-prof.-sarah-registrar` (contains "registrar")

### 3. Verify Card Creation
After submitting a document, check console for:
```
📄 CREATING APPROVAL CARDS
📋 Selected recipient IDs: [...]
✅ APPROVAL CARD CREATED
```

### 4. Check Approval Center
1. Log in as a recipient
2. Go to Approval Center
3. Check console for filtering logs
4. Cards should appear if role matches

## Common Issues

### Issue: No cards in Approval Center
**Check:**
```javascript
JSON.parse(localStorage.getItem('pending-approvals') || '[]')
```
If empty, approval cards weren't created during submission.

### Issue: Cards exist but not visible
**Check role matching:**
```javascript
const user = JSON.parse(localStorage.getItem('auth-user') || '{}');
const cards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log('Your role:', user.role);
console.log('Card recipients:', cards[0]?.recipientIds);
```

### Issue: Wrong role logged in
Make sure you're logged in with the correct role that matches the recipients.

## Manual Fix

If cards exist but don't show, run:
```javascript
// Get cards and current user
const cards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
const user = JSON.parse(localStorage.getItem('auth-user') || '{}');

// Show which cards should be visible
cards.forEach(card => {
  const recipients = card.recipientIds || [];
  const shouldShow = recipients.some(r => 
    r.toLowerCase().includes(user.role?.toLowerCase() || '')
  );
  console.log(`${card.title}: ${shouldShow ? 'SHOULD SHOW' : 'HIDDEN'}`);
});
```
