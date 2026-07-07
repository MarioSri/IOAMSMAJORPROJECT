# 🧪 Calendar Recipient Filtering - Testing Guide

## 🎯 Quick Test Scenarios

### **Scenario 1: Basic Recipient Filtering** (5 minutes)

**Test:** Only selected attendees should see the meeting

**Steps:**
1. **Login as Principal** (Dr. Robert Smith)
2. Navigate to **Calendar** page
3. Click **"Schedule Meeting"** button
4. Fill in:
   - Title: "Test Meeting 1"
   - Date: Tomorrow
   - Time: 10:00 AM
   - Duration: 60 minutes
5. Click **"Attendees"** tab
6. Select **ONLY**:
   - ✅ Prof. Registrar
   - ✅ Dr. HOD-CSE
   - ❌ Do NOT select Dr. HOD-EEE
7. Click **"Schedule Meeting"**

**Verify in Calendar Page:**
- ✅ Meeting appears in "Upcoming Meetings"
- ✅ Console shows: "Added meeting to localStorage"

**Verify in Dashboard:**
- ✅ Navigate to Dashboard
- ✅ Meeting appears in "Calendar & Meetings" widget

---

**Test as Attendee:**
8. **Logout** and **Login as Registrar** (Prof. Michael Chen)
9. Go to **Calendar** page

**Expected:**
- ✅ "Test Meeting 1" appears in Upcoming Meetings
- ✅ Shows "You are invited"

10. Go to **Dashboard**

**Expected:**
- ✅ Meeting appears in Calendar widget

---

**Test as Non-Recipient:**
11. **Logout** and **Login as HOD-EEE** (Mr. James Wilson)
12. Go to **Calendar** page

**Expected:**
- ❌ "Test Meeting 1" does NOT appear
- ✅ Only sees meetings where he's selected

13. Go to **Dashboard**

**Expected:**
- ❌ Meeting does NOT appear in widget

---

### **Scenario 2: Organizer Always Sees Own Meetings** (3 minutes)

**Test:** Organizer should always see their created meetings

**Steps:**
1. **Login as Principal**
2. Go to Calendar page
3. Note the meetings you see (you created them)
4. Verify all YOUR created meetings appear

**Expected:**
- ✅ All meetings you created are visible
- ✅ Even if you didn't add yourself as attendee

---

### **Scenario 3: Real-Time Sync** (5 minutes)

**Test:** Changes should sync automatically without refresh

**Setup:**
1. Open **TWO browser windows**
   - Window A: Login as Principal
   - Window B: Login as Registrar

**Steps:**
1. In **Window A** (Principal):
   - Go to Calendar page
   - Create new meeting "Sync Test"
   - Add Registrar as attendee
   - Click "Schedule Meeting"

2. In **Window B** (Registrar):
   - Stay on Dashboard (don't refresh!)
   - Watch the Calendar & Meetings widget

**Expected:**
- ✅ Window B updates automatically
- ✅ "Sync Test" meeting appears
- ✅ No page refresh needed
- ✅ Console shows: "Storage event detected"

---

### **Scenario 4: Multiple Meetings Filter Correctly** (7 minutes)

**Test:** Each user sees only their relevant meetings

**Setup:**
1. **Login as Principal**, create:
   - Meeting A: Attendees = [Registrar, HOD-CSE]
   - Meeting B: Attendees = [HOD-EEE, Finance Head]

2. **Login as Registrar**, create:
   - Meeting C: Attendees = [Principal, HOD-CSE]

3. **Login as HOD-CSE**, create:
   - Meeting D: Attendees = [Registrar, HOD-EEE]

**Test Each User:**

**Principal:**
- ✅ Sees Meeting A (organizer)
- ✅ Sees Meeting B (organizer)
- ✅ Sees Meeting C (attendee)
- ❌ Does NOT see Meeting D (not involved)
- **Total: 3 meetings**

**Registrar:**
- ✅ Sees Meeting A (attendee)
- ❌ Does NOT see Meeting B (not involved)
- ✅ Sees Meeting C (organizer)
- ✅ Sees Meeting D (attendee)
- **Total: 3 meetings**

**HOD-CSE:**
- ✅ Sees Meeting A (attendee)
- ❌ Does NOT see Meeting B (not involved)
- ✅ Sees Meeting C (attendee)
- ✅ Sees Meeting D (organizer)
- **Total: 3 meetings**

**HOD-EEE:**
- ❌ Does NOT see Meeting A (not involved)
- ✅ Sees Meeting B (attendee)
- ❌ Does NOT see Meeting C (not involved)
- ✅ Sees Meeting D (attendee)
- **Total: 2 meetings**

**Finance Head:**
- ❌ Does NOT see Meeting A (not involved)
- ✅ Sees Meeting B (attendee)
- ❌ Does NOT see Meeting C (not involved)
- ❌ Does NOT see Meeting D (not involved)
- **Total: 1 meeting**

---

## 🔍 What to Check

### **In Calendar Page:**
- [ ] "Upcoming Meetings" section shows filtered meetings
- [ ] "All Meetings" list shows filtered meetings
- [ ] Meeting count badge is correct
- [ ] "Scheduled" count is correct

### **In Dashboard Widget:**
- [ ] Calendar & Meetings widget shows filtered meetings
- [ ] "Upcoming Meetings (X)" count is correct
- [ ] Calendar grid dots show correct meetings
- [ ] Click on meeting opens details

### **Console Logs:**
Open browser DevTools → Console, look for:
```
[Meeting Filtering] Filtering X meetings for user: {id: "...", name: "..."}
[Meeting Filtering] ✅ Including "Meeting Title" - User is organizer
[Meeting Filtering] ✅ Including "Meeting Title" - User is attendee (ID match)
[Meeting Filtering] ❌ Excluding "Meeting Title" - User not a recipient
[Meeting Filtering] Result: X meetings visible to User Name

[Meeting Storage] Added meeting "Meeting Title" and dispatched update event
[MeetingScheduler] Storage event detected - reloading meetings
[Calendar Widget] Storage event detected - reloading meetings
```

---

## 🐛 Common Issues to Check

### **Issue 1: Meeting Not Appearing**
**Check:**
- [ ] Is user selected as attendee?
- [ ] Is user the organizer (createdBy)?
- [ ] Console shows "❌ Excluding" message?

**Fix:**
- Re-create meeting with user as attendee
- Or login as the organizer

---

### **Issue 2: Meeting Appears for Everyone**
**Check:**
- [ ] Filtering function called?
- [ ] Console shows filtering logs?
- [ ] User object has valid ID?

**Debug:**
- Check console for: `[Meeting Filtering] No user logged in`
- Verify user.id is not null/undefined

---

### **Issue 3: Dashboard Not Updating**
**Check:**
- [ ] Storage event listeners attached?
- [ ] Console shows "Storage event detected"?
- [ ] localStorage has meetings data?

**Debug:**
- Open DevTools → Application → Local Storage
- Look for key: `meetings`
- Check if it contains JSON array

---

### **Issue 4: Duplicate Meetings**
**Check:**
- [ ] Deduplication logic working?
- [ ] Same meeting ID in mock + storage?

**Debug:**
- Console should show unique count
- Check: `[MeetingScheduler] Loaded X meetings (Y from storage, Z mock)`

---

## ✅ Success Criteria

**All tests pass if:**

1. **Recipient Filtering:**
   - ✅ Only selected attendees see meetings
   - ✅ Non-selected users don't see meetings
   - ✅ Organizers always see their meetings

2. **Real-Time Sync:**
   - ✅ Dashboard updates without refresh
   - ✅ Calendar page updates without refresh
   - ✅ Storage events dispatched correctly

3. **Data Persistence:**
   - ✅ Meetings saved to localStorage
   - ✅ Meetings loaded on page refresh
   - ✅ Mock meetings + stored meetings combined

4. **Console Logs:**
   - ✅ Filtering decisions logged
   - ✅ Storage operations logged
   - ✅ No errors in console

5. **UI Behavior:**
   - ✅ Correct meeting counts
   - ✅ Proper badge numbers
   - ✅ Meetings appear in both locations

---

## 📊 Expected Console Output

### **When Creating Meeting:**
```
[Meeting Storage] Saved 3 meetings to localStorage
[Meeting Storage] Added meeting "Department Budget Review" and dispatched update event
[MeetingScheduler] Loaded 3 meetings (1 from storage, 2 mock)
[Meeting Filtering] Filtering 3 meetings for user: {id: "principal-001", name: "Dr. Robert Smith"}
[Meeting Filtering] ✅ Including "Department Budget Review" - User is organizer
[Meeting Filtering] ✅ Including "Faculty Review Board" - User is attendee (ID match)
[Meeting Filtering] Result: 2 meetings visible to Dr. Robert Smith
```

### **When Other Component Detects Change:**
```
[Calendar Widget] Storage event detected - reloading meetings
[Meeting Storage] Loaded 3 meetings from localStorage
[Calendar Widget] Total meetings: 3, Filtered: 2
[Meeting Filtering] Filtering 3 meetings for user: {id: "registrar-001", name: "Prof. Michael Chen"}
[Meeting Filtering] ✅ Including "Department Budget Review" - User is attendee (ID match)
[Meeting Filtering] ✅ Including "Faculty Review Board" - User is attendee (ID match)
[Meeting Filtering] Result: 2 meetings visible to Prof. Michael Chen
```

### **When Non-Recipient Checks:**
```
[Meeting Filtering] Filtering 3 meetings for user: {id: "hod-eee-001", name: "Mr. James Wilson"}
[Meeting Filtering] ❌ Excluding "Department Budget Review" - User not a recipient
[Meeting Filtering] ❌ Excluding "Faculty Review Board" - User not a recipient
[Meeting Filtering] ✅ Including "EEE Department Review" - User is attendee (ID match)
[Meeting Filtering] Result: 1 meetings visible to Mr. James Wilson
```

---

## 🎯 Quick Verification Checklist

Run through this 2-minute check:

- [ ] **Login as Principal** → See own created meetings ✅
- [ ] **Create meeting** with 2 attendees → Meeting appears ✅
- [ ] **Go to Dashboard** → Meeting appears in widget ✅
- [ ] **Login as Attendee** → See the meeting ✅
- [ ] **Login as Non-Attendee** → Don't see the meeting ✅
- [ ] **Check console** → No errors ✅
- [ ] **Storage event** → Real-time updates work ✅

**If all ✅ → Implementation Working Perfectly!** 🎉

---

**Testing Status:** 🔄 Ready for Testing  
**Estimated Time:** 15-20 minutes for complete testing  
**Difficulty:** Easy  
**Prerequisites:** Multiple test user accounts
