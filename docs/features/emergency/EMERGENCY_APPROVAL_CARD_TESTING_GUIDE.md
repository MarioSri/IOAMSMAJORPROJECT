# 🧪 Emergency Approval Card Creation - Testing Guide

## 🎯 What to Test

Verifying that when submitting an emergency document, approval cards are:
1. **Created** in localStorage
2. **Dispatched** via events
3. **Displayed** in Approval Center
4. **Filtered** to show only to selected recipients

---

## 📋 Step-by-Step Testing

### Test 1: Basic Approval Card Creation

1. **Open Browser DevTools** (F12)
2. **Navigate to Console tab**
3. **Login as Employee**
4. **Go to Emergency Management page**
5. **Fill in the form:**
   - Title: "Test Emergency Document"
   - Description: "Testing approval card creation"
   - Select **Document Type**: Check at least one (Letter/Circular/Report)
   - Select **Recipients**: Choose "Dr. Robert Principal" only
6. **Click "SUBMIT EMERGENCY" button**
7. **Check Console Logs** - You should see:
   ```
   🚨 Creating Emergency Approval Card: { id: ..., title: ..., recipients: [...], recipientCount: 1 }
   ✅ Approval card saved to localStorage. Total cards: X
   📢 Dispatching approval-card-created event
   ```

### Test 2: Verify localStorage Storage

1. **After submitting** (from Test 1)
2. **In DevTools Console**, type:
   ```javascript
   JSON.parse(localStorage.getItem('pending-approvals'))
   ```
3. **Expected Output:**
   - Array containing your emergency document
   - Check `recipients` field contains names like `["Dr. Robert Principal"]` (NOT IDs)
   - Verify `isEmergency: true`
   - Check `title`, `description`, `files` fields

### Test 3: Verify Event Reception in Approval Center

1. **Stay logged in as Employee**
2. **Navigate to Approval Center → Pending Approvals**
3. **Check Console** - You should see:
   ```
   📋 New approval card received in Approvals page: {...}
   👤 Current user: Mr. John Doe | Role: employee
   👥 Card recipients: ["Dr. Robert Principal"]
   ✅ Adding new approval card to state and localStorage
   ```

### Test 4: Recipient Filtering - Positive Test

1. **Logout**
2. **Login as Principal**
3. **Navigate to Approval Center → Pending Approvals**
4. **Expected Result:** 
   - ✅ You should SEE the "Test Emergency Document" card
   - Card should have red border/background (emergency styling)
   - "EMERGENCY" badge should be visible
5. **Check Console:**
   ```
   🔍 Card "Test Emergency Document" - User: Dr. Robert Smith/principal - Recipients: ["Dr. Robert Principal"] - Match: true
   ```

### Test 5: Recipient Filtering - Negative Test

1. **Logout**
2. **Login as Registrar**
3. **Navigate to Approval Center → Pending Approvals**
4. **Expected Result:**
   - ❌ Card should NOT be visible
5. **Check Console:**
   ```
   🔍 Card "Test Emergency Document" - User: Prof. Sarah Johnson/registrar - Recipients: ["Dr. Robert Principal"] - Match: false
   ```

### Test 6: Multiple Recipients

1. **Login as Program Head**
2. **Go to Emergency Management**
3. **Submit new document:**
   - Title: "Multi-Recipient Test"
   - Description: "Testing multiple recipients"
   - Select Recipients: "Dr. Robert Principal", "Prof. Sarah Registrar", "Dr. CDC Head"
4. **Click Submit**
5. **Verify in Console:**
   ```
   🚨 Creating Emergency Approval Card: { ..., recipientCount: 3 }
   ```
6. **Test each recipient:**
   - Login as Principal → ✅ Should see card
   - Login as Registrar → ✅ Should see card
   - Login as HOD → ❌ Should NOT see card

---

## 🔍 Debugging Checklist

### If cards are NOT created:

1. **Check Console for errors:**
   - Look for any red error messages
   - Check if `createEmergencyDocumentCard()` is being called

2. **Verify form validation:**
   - Title filled?
   - Description filled?
   - At least one recipient selected?

3. **Check localStorage:**
   ```javascript
   localStorage.getItem('pending-approvals')
   ```
   - If `null` or `[]`, cards aren't being saved

### If cards are created but NOT visible:

1. **Check recipient matching:**
   - Console should show: `🔍 Card "..." - Match: true/false`
   - If always `false`, recipient names might not match

2. **Inspect recipient data:**
   ```javascript
   const approvals = JSON.parse(localStorage.getItem('pending-approvals'));
   console.log('Recipients:', approvals[0].recipients);
   ```
   - Should be names like `["Dr. Robert Principal"]`
   - NOT IDs like `["principal-dr.-robert-principal"]`

3. **Check user data:**
   ```javascript
   const user = JSON.parse(sessionStorage.getItem('iaoms-user'));
   console.log('User:', user.name, user.role);
   ```
   - Verify user name and role are correct

### If events are NOT firing:

1. **Check if event listener is attached:**
   - Navigate to Approval Center
   - Console should show event reception logs
   - If not, check if `useEffect` is running

2. **Manually dispatch event:**
   ```javascript
   window.dispatchEvent(new CustomEvent('approval-card-created', { 
     detail: { approval: JSON.parse(localStorage.getItem('pending-approvals'))[0] } 
   }));
   ```

---

## 📊 Expected Console Output Flow

### In Emergency Management (on submit):
```
🚨 Creating Emergency Approval Card: {
  id: "1730678400000",
  title: "Test Emergency Document",
  recipients: ["Dr. Robert Principal"],
  recipientCount: 1
}
✅ Approval card saved to localStorage. Total cards: 1
📢 Dispatching approval-card-created event
```

### In Approval Center (on navigation):
```
📋 New approval card received in Approvals page: { ... }
👤 Current user: Dr. Robert Smith | Role: principal
👥 Card recipients: ["Dr. Robert Principal"]
✅ Adding new approval card to state and localStorage
```

### During Filtering:
```
🔍 Card "Test Emergency Document" - User: Dr. Robert Smith/principal - Recipients: ["Dr. Robert Principal"] - Match: true
```

---

## ✅ Success Criteria

- [x] Console shows "Creating Emergency Approval Card" message
- [x] Console shows "Approval card saved to localStorage"
- [x] Console shows "Dispatching approval-card-created event"
- [x] localStorage contains the approval card
- [x] Recipients field contains names (not IDs)
- [x] Approval Center receives the event
- [x] Selected recipients can see the card
- [x] Non-recipients cannot see the card
- [x] Emergency styling applied (red border, badge)
- [x] Filtering console logs show correct matches

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No console logs | Check if app is running on correct port (8083) |
| Card not in localStorage | Check form validation passed |
| Recipients are IDs not names | Verify `getRecipientName()` is being called |
| Event not received | Refresh Approval Center page |
| All users see card | Check `isUserInRecipients()` function |
| No cards visible | Clear localStorage and test again |

---

## 🔄 Reset Testing Environment

To start fresh:

1. **Clear all localStorage:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Refresh page** (F5)

3. **Login again** and test

---

**Status**: Ready for testing! 🚀  
**Date**: November 3, 2025
