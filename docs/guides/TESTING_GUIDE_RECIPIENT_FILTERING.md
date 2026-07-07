# 🧪 Quick Testing Guide - Approval Center Recipient Filtering

## 🎯 What to Test

Testing whether Approval Center cards are **only visible to selected recipients**.

## 📋 Quick Test (5 minutes)

### Test 1: Single Recipient Filter

1. **Login as Employee**
   - Go to Login page
   - Select "Employee" role
   - Click "Sign In"

2. **Submit Emergency Document**
   - Navigate to "Emergency Management" page
   - Click "EMERGENCY SUBMIT" button
   - Fill in:
     - Title: "Test Document for Principal Only"
     - Description: "This should only be visible to Principal"
   - In **Recipients** section, select **ONLY**:
     - ✅ Dr. Robert Principal (under Leadership)
   - Click "Submit Emergency Document"
   - Wait for success toast notification

3. **Verify Principal Can See It**
   - Logout (click user menu → Logout)
   - Login as "Principal"
   - Navigate to "Approval Center" → "Pending Approvals" tab
   - ✅ **PASS**: You should see "Test Document for Principal Only"
   - Check browser console for log: `🔍 Card "Test Document for Principal Only" - User: Dr. Robert Smith/principal - Recipients: ["Dr. Robert Principal"] - Match: true`

4. **Verify Others Cannot See It**
   - Logout
   - Login as "Registrar"
   - Navigate to "Approval Center" → "Pending Approvals"
   - ✅ **PASS**: Card should **NOT** be visible
   - Check browser console for log: `Match: false`

---

### Test 2: Multiple Recipients Filter

1. **Login as Program Head**

2. **Submit Emergency Document**
   - Navigate to "Emergency Management"
   - Click "EMERGENCY SUBMIT"
   - Fill in:
     - Title: "Test Document for Leadership Team"
     - Description: "Visible to Principal, Registrar, and Dean"
   - In **Recipients** section, select:
     - ✅ Dr. Robert Principal
     - ✅ Prof. Sarah Registrar
     - ✅ Dr. Maria Dean
   - Submit

3. **Test Each Recipient**
   - Login as Principal → ✅ Should see card
   - Login as Registrar → ✅ Should see card
   - Login as Dean → ✅ Should see card (if role available)
   - Login as HOD → ✅ Should **NOT** see card

---

## 🔍 What to Look For

### ✅ Success Indicators

1. **Cards are filtered correctly**
   - Selected recipients see the card
   - Non-recipients don't see the card

2. **Console logs show matching**
   ```
   🔍 Card "Test Document" - User: Dr. Robert Smith/principal - Recipients: ["Dr. Robert Principal"] - Match: true
   ```

3. **Card count is accurate**
   - "Pending Approvals" counter shows correct number
   - Only cards for current user are counted

### ❌ Failure Indicators

1. **All users see all cards** (filtering not working)
2. **Console shows `Match: false` but card is still visible**
3. **Selected recipient doesn't see their card**
4. **Error messages in console**

---

## 🐛 Debugging Tips

### If filtering is not working:

1. **Check Browser Console** (F12 → Console tab)
   - Look for `🔍 Card` logs
   - Verify `Match: true/false` is correct

2. **Check localStorage**
   - Open Console → Type: `JSON.parse(localStorage.getItem('pending-approvals'))`
   - Verify `recipients` field contains **names** not IDs
   - Example: `["Dr. Robert Principal"]` ✅
   - Not: `["principal-dr.-robert-principal"]` ❌

3. **Check User Role**
   - Console → Type: `JSON.parse(sessionStorage.getItem('iaoms-user'))`
   - Check `name` and `role` fields match expected values

4. **Clear Storage and Retry**
   - Console → Type: `localStorage.clear(); sessionStorage.clear()`
   - Refresh page (F5)
   - Login and test again

---

## 🎓 Expected Results Summary

| User Role      | Document Recipients           | Should See Card? |
|---------------|-------------------------------|------------------|
| Principal     | [Principal]                   | ✅ Yes           |
| Principal     | [Registrar]                   | ❌ No            |
| Registrar     | [Principal, Registrar]        | ✅ Yes           |
| HOD           | [All Leadership]              | ❌ No            |
| Principal     | [All CDC Employees]           | ❌ No            |
| CDC Head*     | [Dr. CDC Head]                | ✅ Yes           |

*Note: CDC Head role may need to be added to login options

---

## 🔧 Advanced Testing

### Test Role-Based Matching

1. Submit document to "HOD" (generic role)
2. Login as any HOD (CSE, ECE, etc.)
3. All HODs should see it due to role matching

### Test Department-Specific Filtering

1. Submit document to "Dr. CSE HOD" only
2. Login as CSE HOD → Should see it
3. Login as ECE HOD → Should NOT see it

### Test Dashboard Widget

1. Submit emergency document with specific recipients
2. Check main **Dashboard** page
3. "Documents Widget" should show same filtering
4. Only selected recipients see document in widget

---

## ✅ Completion Checklist

- [ ] Tested single recipient filtering
- [ ] Tested multiple recipients filtering
- [ ] Tested role-based matching
- [ ] Verified console logs show correct matching
- [ ] Checked localStorage has names not IDs
- [ ] Tested with different user roles
- [ ] Verified non-recipients cannot see cards
- [ ] Dashboard widget filtering consistent
- [ ] No JavaScript errors in console

---

## 🎉 Success Criteria

The fix is working correctly if:

1. ✅ Cards only visible to selected recipients
2. ✅ Console logs show `Match: true` for recipients
3. ✅ Console logs show `Match: false` for non-recipients
4. ✅ Pending approvals counter is accurate
5. ✅ No JavaScript errors
6. ✅ Dashboard widget shows same filtering

**Status**: Ready for testing! 🚀
