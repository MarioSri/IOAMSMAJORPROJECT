# 🚀 Quick Test Guide - Sequential Workflow

## ⚡ 5-Minute Verification Test

### Test 1: Basic Sequential Flow (2 minutes)

**Setup**:
1. Login as **Employee** role
2. Go to **Document Management** page

**Steps**:
```
1. Click "Submit Document"
2. Fill in:
   - Title: "Test Sequential Flow"
   - Description: "Testing A → B → C flow"
   - Upload any file
3. Select Recipients (in order):
   - Click "HODs (All Branches)" → Select "Dr. CSE HOD"
   - Click "Leadership" → Select "Prof. Sarah Registrar"  
   - Click "Leadership" → Select "Dr. Robert Principal"
4. Click "Submit"
```

**Expected Result**: ✅
- Toast: "Document Submitted"
- Console shows: "Approval card created"
- Console shows: "Notified 3 recipients"

---

### Test 2: Verify Recipient A Sees Card (1 minute)

**Setup**:
1. Logout
2. Login as **HOD** role

**Steps**:
```
1. Go to "Approval Center"
2. Look for "Test Sequential Flow" card
```

**Expected Result**: ✅
- Card is visible in "Pending Approvals" tab
- Shows document details
- Has "Approve & Sign" and "Reject" buttons
- Console shows: "✅ SHOW card to current user"

---

### Test 3: Approve and Move to Next (1 minute)

**Still logged in as HOD**:

**Steps**:
```
1. On "Test Sequential Flow" card:
   - Add comment: "Approved by HOD"
   - Click "Approve & Sign"
   - Click "Complete Signing" in Documenso modal
```

**Expected Result**: ✅
- Toast: "Document Signed & Approved"
- Card disappears from HOD's view
- Console shows: "SEQUENTIAL MODE: Advancing workflow"
- Console shows: "Notified next recipient"

---

### Test 4: Verify Next Recipient Sees Card (1 minute)

**Setup**:
1. Logout
2. Login as **Registrar** role

**Steps**:
```
1. Go to "Approval Center"
2. Look for "Test Sequential Flow" card
```

**Expected Result**: ✅
- Card is NOW visible to Registrar
- Shows HOD's signature in Track Documents
- Progress shows 33% (1 of 3 approved)

---

### Test 5: Rejection Stops Workflow (1 minute)

**Still logged in as Registrar**:

**Steps**:
```
1. On "Test Sequential Flow" card:
   - Add comment: "Need more information"
   - Click "Reject"
```

**Expected Result**: ✅
- Toast: "Document Rejected. Workflow stopped for all recipients."
- Card disappears from Registrar's view
- Console shows: "SEQUENTIAL MODE: Rejection stops workflow"
- Console shows: "Removing card for ALL recipients"

---

### Test 6: Verify Principal Never Sees Card (30 seconds)

**Setup**:
1. Logout
2. Login as **Principal** role

**Steps**:
```
1. Go to "Approval Center"
2. Look for "Test Sequential Flow" card
```

**Expected Result**: ✅
- Card is NOT visible (workflow was stopped)
- Principal never received the card

---

### Test 7: Check Track Documents (30 seconds)

**Setup**:
1. Logout
2. Login as **Employee** role (original submitter)

**Steps**:
```
1. Go to "Track Documents"
2. Find "Test Sequential Flow" card
```

**Expected Result**: ✅
- Status: "Rejected"
- Workflow shows:
  - ✓ Submission (completed)
  - ✓ HOD Review (completed) - Circle-check-big
  - ✗ Registrar Review (rejected) - Circle-x
  - ⊘ Principal Approval (cancelled)
- Badge shows: Circle-x (Rejected)
- Signed by: 1 recipient (HOD)

---

## 🎯 Console Verification

Open browser console (F12) and look for these logs:

### On Document Submission:
```
✅ Document Management submission complete
📬 Notification Summary: 3 of 3 recipients notified
📢 Dispatching approval-card-created event
```

### On Approval (HOD):
```
✅ [Accept] Processing approval for: Test Sequential Flow
📋 SEQUENTIAL MODE: Advancing workflow to next step
📊 Progress: Step 2 of 3 (66%)
📬 Notifying next recipient: Prof. Sarah Registrar
```

### On Rejection (Registrar):
```
❌ [Reject] Processing rejection for: Test Sequential Flow
📋 SEQUENTIAL MODE: Rejection stops workflow
🗑️ Removing card for ALL recipients
```

### On Approval Center Load:
```
🔍 Checking card "Test Sequential Flow" for user: [Your Name]
✅ Role match: registrar matches role Registrar
✅ Final result: SHOW
```

---

## 🔍 localStorage Verification

Open browser console and run:

```javascript
// Check pending approvals
console.log('Pending Approvals:', JSON.parse(localStorage.getItem('pending-approvals')));

// Check submitted documents
console.log('Submitted Documents:', JSON.parse(localStorage.getItem('submitted-documents')));

// Check notification preferences
console.log('Notification Prefs:', JSON.parse(localStorage.getItem('notification-preferences')));
```

---

## ✅ Success Criteria

All tests should show:
- ✅ Sequential flow works (one at a time)
- ✅ Approval moves to next recipient
- ✅ Rejection stops workflow completely
- ✅ No further routing after rejection
- ✅ Track Documents updates in real-time
- ✅ Notifications sent based on preferences
- ✅ Console logs show correct flow

---

## 🐛 Troubleshooting

### Card Not Visible?
**Check**:
1. Console logs: "Should show card to current user: true/false"
2. Recipient IDs match user role
3. Workflow step status is 'current' for this user

### Rejection Not Stopping?
**Check**:
1. Console logs: "SEQUENTIAL MODE: Rejection stops workflow"
2. localStorage 'pending-approvals' - card should be removed
3. Track Documents shows 'cancelled' for pending steps

### Notifications Not Sending?
**Check**:
1. Profile → Preferences → Notification Preferences
2. Enable at least one channel (Email/Push/SMS/WhatsApp)
3. Enable "Approvals" toggle for that channel
4. Console logs: "Notified via: Email, Push"

---

## 📱 Mobile Testing

Same tests work on mobile:
1. Open app on mobile browser
2. Follow same steps
3. UI is responsive and touch-friendly

---

## 🎉 Expected Total Time: 5-7 minutes

**All tests should PASS without any code changes needed.**

---

**Last Updated**: ${new Date().toISOString()}
