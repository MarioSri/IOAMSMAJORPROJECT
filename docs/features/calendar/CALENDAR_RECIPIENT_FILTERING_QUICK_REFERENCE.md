# 📅 Calendar Recipient Filtering - Quick Reference

## 🎯 Requirement Summary

**Meeting cards should be visible ONLY to:**
1. ✅ Selected attendees (users chosen in "Select Attendees" section)
2. ✅ Meeting organizer (person who created the meeting)

**Meeting cards should be hidden from:**
- ❌ Users NOT selected as attendees
- ❌ Users in different departments (unless specifically invited)
- ❌ Users with higher roles (if not invited)

---

## 📊 Current System Status

### ❌ **Problems:**

1. **Calendar Page (`MeetingScheduler.tsx`):**
   - Shows ALL meetings to ALL users
   - No recipient filtering implemented

2. **Dashboard Widget (`CalendarWidget.tsx`):**
   - Uses role-based filtering (not recipient-based)
   - String-based matching (broken for object arrays)
   - Separate mock data (not synchronized)

3. **Data Storage:**
   - No persistence (component state only)
   - No data sharing between components

---

## ✅ **Solution:**

### **3-Step Implementation:**

```
1. Create Shared Filtering Function
   ↓
2. Add localStorage for Data Persistence
   ↓
3. Apply Filtering in Both Components
```

---

## 🔧 Implementation Overview

### **Step 1: Filtering Function**

```tsx
// src/utils/meetingFilters.ts
export const filterMeetingsByRecipient = (meetings, currentUser) => {
  return meetings.filter((meeting) => {
    // Check if user is organizer
    if (meeting.createdBy === currentUser.id) return true;
    
    // Check if user is in attendees by ID
    if (meeting.attendees?.some(a => a.id === currentUser.id)) return true;
    
    // Check if user is in attendees by name (fallback)
    if (meeting.attendees?.some(a => a.name === currentUser.name)) return true;
    
    // Not a recipient - exclude
    return false;
  });
};
```

---

### **Step 2: Save to localStorage**

```tsx
// MeetingScheduler.tsx - handleCreateMeeting()
const response = await meetingAPI.createMeeting(newMeeting);

// Save to localStorage
const existingMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
const updatedMeetings = [response.meeting, ...existingMeetings];
localStorage.setItem('meetings', JSON.stringify(updatedMeetings));

// Dispatch event for real-time updates
window.dispatchEvent(new Event('storage'));
```

---

### **Step 3: Apply Filtering**

```tsx
// Both MeetingScheduler.tsx and CalendarWidget.tsx

useEffect(() => {
  const loadMeetings = () => {
    // Load from localStorage
    const storedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    
    // Combine with mock data
    const allMeetings = [...storedMeetings, ...mockMeetings];
    
    // Apply recipient filtering
    const filtered = filterMeetingsByRecipient(allMeetings, user);
    
    setMeetings(filtered);
  };
  
  loadMeetings();
  
  // Listen for updates
  window.addEventListener('storage', loadMeetings);
  return () => window.removeEventListener('storage', loadMeetings);
}, [user]);
```

---

## 📋 Behavior Matrix

| User | Is Organizer? | In Attendees? | Sees Meeting? |
|------|--------------|---------------|---------------|
| Dr. Smith | ✅ YES | ❌ NO | ✅ **YES** |
| Prof. Chen | ❌ NO | ✅ YES | ✅ **YES** |
| Dr. Johnson | ❌ NO | ✅ YES | ✅ **YES** |
| Mr. Wilson | ❌ NO | ❌ NO | ❌ **NO** |

---

## 🎯 Example Scenario

### **Meeting Created:**
- **Title:** Faculty Review Board
- **Organizer:** Dr. Smith (`principal-001`)
- **Attendees:** Prof. Chen (`registrar-001`), Dr. Johnson (`hod-cse-001`)

### **Visibility:**

```
✅ Dr. Smith (Organizer)
   └─ Sees in Calendar Page: YES
   └─ Sees in Dashboard Widget: YES
   └─ Reason: Created the meeting

✅ Prof. Chen (Attendee)
   └─ Sees in Calendar Page: YES
   └─ Sees in Dashboard Widget: YES
   └─ Reason: Selected as attendee

✅ Dr. Johnson (Attendee)
   └─ Sees in Calendar Page: YES
   └─ Sees in Dashboard Widget: YES
   └─ Reason: Selected as attendee

❌ Mr. Wilson (Not Selected)
   └─ Sees in Calendar Page: NO
   └─ Sees in Dashboard Widget: NO
   └─ Reason: Not in attendees list
```

---

## 🔍 Filtering Logic (Simplified)

```javascript
// For each meeting:
if (user.id === meeting.createdBy) {
  return SHOW; // Organizer always sees
}

if (meeting.attendees.some(a => a.id === user.id)) {
  return SHOW; // User is invited
}

return HIDE; // User not involved
```

---

## 📂 Files to Modify

| File | Changes |
|------|---------|
| `src/utils/meetingFilters.ts` | **CREATE** - Filtering function |
| `src/components/MeetingScheduler.tsx` | **UPDATE** - Add localStorage save + filtering |
| `src/components/dashboard/widgets/CalendarWidget.tsx` | **UPDATE** - Load from localStorage + filtering |

---

## 🧪 Testing Checklist

- [ ] **Test 1:** Organizer sees their created meetings
- [ ] **Test 2:** Selected attendees see the meeting
- [ ] **Test 3:** Non-selected users do NOT see the meeting
- [ ] **Test 4:** Meeting appears in both Calendar page and Dashboard widget
- [ ] **Test 5:** Real-time sync works (create in Calendar, see in Dashboard)
- [ ] **Test 6:** Multiple meetings filter correctly per user
- [ ] **Test 7:** Console logs show filtering decisions

---

## 🚀 Quick Implementation Steps

1. Create `src/utils/meetingFilters.ts` with filtering function
2. In `MeetingScheduler.tsx`:
   - Import filtering function
   - Save to localStorage in `handleCreateMeeting()`
   - Apply filtering in `loadMeetings()`
3. In `CalendarWidget.tsx`:
   - Import filtering function
   - Load from localStorage in `useEffect`
   - Replace role-based filtering with recipient filtering
4. Test with different users

---

## 📊 Data Structure

### **Meeting Object:**
```typescript
{
  id: "meeting-001",
  title: "Faculty Review",
  createdBy: "principal-001", // ⭐ Organizer user ID
  attendees: [ // ⭐ Array of attendee objects
    {
      id: "registrar-001", // ⭐ User ID
      name: "Prof. Chen",
      email: "chen@iaoms.edu",
      role: "Registrar",
      status: "invited"
    }
  ],
  // ... other fields
}
```

---

## 🎯 Key Points

1. **Filter by USER ID** (not role, not department)
2. **Organizer ALWAYS sees** their meetings
3. **Check attendees[] array** for user ID match
4. **Use localStorage** for data persistence
5. **Storage events** for real-time sync

---

**Status:** 📋 Ready for Implementation  
**Priority:** HIGH  
**Estimated Time:** 2-3 hours  
**Complexity:** Medium
