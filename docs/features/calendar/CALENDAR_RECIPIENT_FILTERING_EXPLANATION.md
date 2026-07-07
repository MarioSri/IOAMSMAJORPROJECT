# 📅 Calendar Meeting Recipient Filtering - Explanation

## 🎯 Requirement

**When a user schedules a new meeting from the Schedule New Meeting page and selects attendees in the Select Attendees section:**

1. **A new meeting card should be displayed in:**
   - ✅ Calendar page → Upcoming Meetings section
   - ✅ Dashboard → Calendar & Meetings Widget section

2. **Visibility Rule:**
   - ⚠️ Meeting card should be **visible ONLY to the selected recipients (attendees)**
   - ❌ Users NOT selected as attendees should NOT see the meeting card

---

## 📂 Current System Architecture

### **1. Calendar Page Structure**

**Location:** `src/pages/Calendar.tsx`

```
Calendar Page
├── DashboardLayout
└── MeetingScheduler Component
    ├── Calendar View Tab
    │   └── Calendar Grid with meeting dots
    ├── List View Tab
    │   ├── Upcoming Meetings Section
    │   └── All Meetings Section
    └── Schedule New Meeting Dialog
        ├── Basic Info Tab
        ├── Attendees Tab (Select Attendees)
        ├── Settings Tab
        └── Approval Tab
```

---

### **2. Meeting Scheduler Component**

**Location:** `src/components/MeetingScheduler.tsx`

#### **Key Functions:**

```tsx
// Lines 470-539: Creates a new meeting
const handleCreateMeeting = async () => {
  // 1. Validates required fields
  // 2. Checks for conflicts
  // 3. Creates meeting via API
  // 4. Adds meeting to state: setMeetings()
  // 5. Shows success toast
  // 6. Generates meeting links (Google Meet/Zoom)
}

// Lines 600-615: Adds attendees to new meeting
const addAttendee = (attendeeData: any) => {
  const attendee: MeetingAttendee = {
    id: attendeeData.id,
    name: attendeeData.name,
    email: attendeeData.email,
    role: attendeeData.role,
    department: attendeeData.department,
    status: "invited",
    isRequired: true,
    canEdit: false
  };

  setNewMeeting(prev => ({
    ...prev,
    attendees: [...(prev.attendees || []), attendee]
  }));
}
```

#### **Meeting Data Structure:**

```tsx
interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string; // "2024-01-18"
  time: string; // "10:00"
  duration: number; // minutes
  attendees: MeetingAttendee[]; // ⭐ KEY: List of selected attendees
  location: string;
  type: 'online' | 'in-person' | 'hybrid';
  status: 'scheduled' | 'confirmed' | 'cancelled';
  createdBy: string; // User ID of organizer
  // ... other fields
}

interface MeetingAttendee {
  id: string; // ⭐ KEY: User ID
  name: string;
  email: string;
  role: string;
  department?: string;
  status: 'invited' | 'accepted' | 'declined' | 'tentative' | 'no-response';
  isRequired: boolean;
  canEdit: boolean;
}
```

---

### **3. Dashboard Calendar Widget**

**Location:** `src/components/dashboard/widgets/CalendarWidget.tsx`

#### **Current Implementation:**

```tsx
useEffect(() => {
  const fetchMeetings = async () => {
    // Lines 65-132: Mock meetings data
    const mockMeetings: Meeting[] = [...];
    
    // Lines 134-151: CURRENT FILTERING LOGIC
    const filteredMeetings = mockMeetings.filter(meeting => {
      if (userRole === 'employee') {
        return meeting.attendees.includes('All Employees') || 
               meeting.attendees.includes(user?.department || '');
      }
      if (userRole === 'hod') {
        return meeting.attendees.includes(`HOD-${user?.branch}`) ||
               meeting.attendees.includes('All HODs') ||
               meeting.organizer === `HOD-${user?.branch}`;
      }
      if (userRole === 'program-head') {
        return meeting.attendees.includes('Program Heads') ||
               meeting.attendees.includes(`${user?.branch} Program Head`);
      }
      return true; // ⚠️ Principal and Registrar see ALL meetings
    });
    
    setMeetings(filteredMeetings);
  };
  
  fetchMeetings();
}, [userRole, user]);
```

#### **Widget Display Sections:**

```tsx
// Lines 168-175: Get upcoming meetings
const getUpcomingMeetings = () => {
  const today = new Date();
  return meetings
    .filter(meeting => new Date(meeting.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, isMobile ? 3 : 5);
};

// Display in widget
const upcomingMeetings = getUpcomingMeetings();
```

---

## 🔍 Current vs Required Behavior

### **Current Behavior:**

#### **Calendar Page (MeetingScheduler):**
- ✅ Shows all meetings in state array
- ❌ **NO recipient filtering implemented**
- ❌ **ALL users see ALL meetings** regardless of whether they are attendees

#### **Dashboard Widget (CalendarWidget):**
- ⚠️ **Basic role-based filtering exists** (by department, role)
- ❌ **Does NOT check if user is in meeting.attendees array**
- ❌ Filters by string matching: `meeting.attendees.includes('All Employees')`
- ❌ attendees array contains strings like "Principal", "HOD-CSE" (not user IDs)

---

### **Required Behavior:**

#### **Calendar Page (MeetingScheduler):**
- ✅ When displaying meetings in "Upcoming Meetings" section:
  - **Filter meetings** where `currentUser.id` exists in `meeting.attendees[].id`
  - **OR** where `currentUser.id === meeting.createdBy` (organizer always sees their meetings)

#### **Dashboard Widget (CalendarWidget):**
- ✅ Replace role-based filtering with **recipient-based filtering**:
  - Check if `currentUser.id` is in `meeting.attendees[].id` array
  - Check if `currentUser.id === meeting.organizer` (createdBy)
  - Show meeting ONLY if user matches

---

## 🚨 Current Issues

### **Issue #1: No Recipient Filtering in Calendar Page**

**Location:** `src/components/MeetingScheduler.tsx`

**Problem:**
```tsx
// Lines 850-960: Upcoming Meetings section
// NO filtering applied - shows ALL meetings
{meetings
  .filter(m => m.status === 'scheduled' || m.status === 'confirmed')
  .slice(0, 5)
  .map((meeting) => (
    // Displays meeting card
  ))
}
```

**Impact:**
- ❌ When User A creates a meeting with attendees [User B, User C]
- ❌ User D (not selected) can see the meeting in Upcoming Meetings
- ❌ User E (not selected) can see the meeting in All Meetings list

---

### **Issue #2: String-Based Filtering in Dashboard Widget**

**Location:** `src/components/dashboard/widgets/CalendarWidget.tsx` (Lines 134-151)

**Problem:**
```tsx
// Current code uses STRING matching
meeting.attendees.includes('All Employees') 
meeting.attendees.includes(user?.department || '')

// But attendees is actually an ARRAY OF OBJECTS:
attendees: [
  { id: "user-123", name: "Dr. Smith", role: "Principal", ... },
  { id: "user-456", name: "Prof. Chen", role: "HOD", ... }
]
```

**Impact:**
- ❌ `.includes()` on object array will always return `false`
- ❌ Logic is broken - filtering doesn't work correctly
- ❌ Wrong data type assumption (string vs object)

---

### **Issue #3: Mock Data vs Real Data Mismatch**

**Problem:**
```tsx
// Mock meetings have STRING attendees (Lines 73-75)
attendees: ['Principal', 'Registrar', 'HOD-CSE', 'HR Head'],

// But newly created meetings have OBJECT attendees
attendees: [
  {
    id: "1",
    name: "Dr. Principal",
    email: "principal@iaoms.edu",
    role: "Principal",
    status: "accepted",
    isRequired: true,
    canEdit: false
  }
]
```

**Impact:**
- ❌ Inconsistent data structure
- ❌ Filtering logic won't work for new meetings
- ❌ Need to standardize to object-based attendees

---

### **Issue #4: No Data Persistence**

**Problem:**
- Meetings created in Calendar page are stored in **component state** only
- Dashboard widget loads **mock data** from its own `useEffect`
- No shared data source (localStorage, API, context)

**Impact:**
- ❌ Meeting created in Calendar page does NOT appear in Dashboard widget
- ❌ Each component has separate meeting lists
- ❌ No real-time updates between components

---

## ✅ Required Implementation

### **Step 1: Standardize Meeting Data Structure**

**Update mock meetings to use object-based attendees:**

```tsx
// CalendarWidget.tsx - Lines 65-132
const mockMeetings: Meeting[] = [
  {
    id: '1',
    title: 'Faculty Recruitment Review',
    // ... other fields
    attendees: [
      { id: 'principal-001', name: 'Dr. Principal', email: 'principal@iaoms.edu', role: 'Principal', status: 'accepted', isRequired: true, canEdit: false },
      { id: 'registrar-001', name: 'Prof. Registrar', email: 'registrar@iaoms.edu', role: 'Registrar', status: 'accepted', isRequired: true, canEdit: false },
      { id: 'hod-cse-001', name: 'Dr. HOD-CSE', email: 'hod.cse@iaoms.edu', role: 'HOD', status: 'invited', isRequired: true, canEdit: false }
    ],
    createdBy: 'principal-001', // Organizer user ID
    // ... other fields
  }
];
```

---

### **Step 2: Implement Shared Data Storage**

**Option A: localStorage (Simple solution)**

```tsx
// MeetingScheduler.tsx - handleCreateMeeting
const handleCreateMeeting = async () => {
  // ... existing code
  
  // After creating meeting:
  const response = await meetingAPI.createMeeting(newMeeting);
  
  // Save to localStorage
  const existingMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
  const updatedMeetings = [response.meeting, ...existingMeetings];
  localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
  
  // Dispatch storage event for cross-component updates
  window.dispatchEvent(new Event('storage'));
  
  // Update local state
  setMeetings(prev => [response.meeting, ...prev]);
}
```

**CalendarWidget.tsx - Load from localStorage:**

```tsx
useEffect(() => {
  const loadMeetings = () => {
    // Load from localStorage
    const storedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    
    // Combine with mock meetings
    const allMeetings = [...storedMeetings, ...mockMeetings];
    
    // Apply recipient filtering
    const filteredMeetings = filterMeetingsByRecipient(allMeetings, user);
    
    setMeetings(filteredMeetings);
  };
  
  loadMeetings();
  
  // Listen for storage changes
  window.addEventListener('storage', loadMeetings);
  return () => window.removeEventListener('storage', loadMeetings);
}, [user]);
```

---

### **Step 3: Implement Recipient Filtering Function**

**Create shared filtering utility:**

```tsx
// src/utils/meetingFilters.ts
import { Meeting, MeetingAttendee } from '@/types/meeting';

export const filterMeetingsByRecipient = (
  meetings: Meeting[],
  currentUser: { id: string; name: string; role: string } | null
): Meeting[] => {
  if (!currentUser) return [];
  
  return meetings.filter((meeting) => {
    // 1. Check if user is the organizer
    if (meeting.createdBy === currentUser.id) {
      return true;
    }
    
    // 2. Check if user is in attendees array by ID
    const isAttendeeById = meeting.attendees?.some(
      (attendee: MeetingAttendee) => attendee.id === currentUser.id
    );
    
    if (isAttendeeById) {
      return true;
    }
    
    // 3. Fallback: Check by name (for backward compatibility)
    const isAttendeeByName = meeting.attendees?.some(
      (attendee: MeetingAttendee) => attendee.name === currentUser.name
    );
    
    if (isAttendeeByName) {
      return true;
    }
    
    // 4. Not a recipient - exclude meeting
    console.log(`[Meeting Filtering] Excluding meeting "${meeting.title}" - User not a recipient`);
    return false;
  });
};
```

---

### **Step 4: Apply Filtering in Calendar Page**

**Update MeetingScheduler.tsx:**

```tsx
import { filterMeetingsByRecipient } from '@/utils/meetingFilters';

export function MeetingScheduler({ userRole, className }: MeetingSchedulerProps) {
  const { user } = useAuth();
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  
  // Computed filtered meetings
  const meetings = useMemo(() => {
    return filterMeetingsByRecipient(allMeetings, user);
  }, [allMeetings, user]);
  
  const loadMeetings = async () => {
    setLoading(true);
    try {
      // Load from localStorage
      const storedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
      
      // Load mock meetings
      const mockMeetings = [...]; // existing mock data
      
      // Combine all meetings
      const combined = [...storedMeetings, ...mockMeetings];
      
      // Store ALL meetings (before filtering)
      setAllMeetings(combined);
      
      // Filtering happens via useMemo above
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load meetings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Rest of component...
}
```

---

### **Step 5: Apply Filtering in Dashboard Widget**

**Update CalendarWidget.tsx:**

```tsx
import { filterMeetingsByRecipient } from '@/utils/meetingFilters';

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  
  useEffect(() => {
    const loadMeetings = () => {
      // Load from localStorage
      const storedMeetings = JSON.parse(localStorage.getItem('meetings') || '[]');
      
      // Load mock meetings (with updated object-based attendees)
      const mockMeetings: Meeting[] = [...]; // updated structure
      
      // Combine all meetings
      const allMeetings = [...storedMeetings, ...mockMeetings];
      
      // ⭐ Apply recipient filtering
      const filteredMeetings = filterMeetingsByRecipient(allMeetings, user);
      
      console.log(`[Calendar Widget] Total meetings: ${allMeetings.length}`);
      console.log(`[Calendar Widget] Filtered for ${user?.name}: ${filteredMeetings.length}`);
      
      setMeetings(filteredMeetings);
    };
    
    loadMeetings();
    
    // Listen for storage changes (real-time updates)
    window.addEventListener('storage', loadMeetings);
    const customEventListener = () => loadMeetings();
    window.addEventListener('meetings-updated', customEventListener);
    
    return () => {
      window.removeEventListener('storage', loadMeetings);
      window.removeEventListener('meetings-updated', customEventListener);
    };
  }, [user]);
  
  // Rest of component...
}
```

---

## 📊 Behavior Examples

### **Example 1: User Creates Meeting with Selected Attendees**

**Scenario:**
- **Organizer:** Dr. Robert Smith (Principal) - `user-id: principal-001`
- **Action:** Creates meeting "Faculty Review Board"
- **Selected Attendees:**
  - Prof. Michael Chen (Registrar) - `user-id: registrar-001`
  - Dr. Sarah Johnson (HOD-CSE) - `user-id: hod-cse-001`
- **Not Selected:**
  - Mr. James Wilson (HOD-EEE) - `user-id: hod-eee-001`

**Expected Results:**

| User | Sees Meeting in Calendar Page? | Sees Meeting in Dashboard Widget? | Reason |
|------|-------------------------------|-----------------------------------|--------|
| Dr. Robert Smith (Organizer) | ✅ YES | ✅ YES | `createdBy === current user ID` |
| Prof. Michael Chen (Attendee) | ✅ YES | ✅ YES | In `attendees[]` array |
| Dr. Sarah Johnson (Attendee) | ✅ YES | ✅ YES | In `attendees[]` array |
| Mr. James Wilson (Not Selected) | ❌ NO | ❌ NO | Not in `attendees[]` and not organizer |

---

### **Example 2: Multiple Meetings from Different Organizers**

**Setup:**
- Meeting A: Organizer = Dr. Smith → Attendees = [Prof. Chen, Dr. Johnson]
- Meeting B: Organizer = Prof. Chen → Attendees = [Dr. Smith, Mr. Wilson]

**What Each User Sees:**

| User | Sees Meeting A? | Sees Meeting B? | Total Visible |
|------|----------------|----------------|---------------|
| Dr. Smith | ✅ YES (organizer) | ✅ YES (attendee) | 2 |
| Prof. Chen | ✅ YES (attendee) | ✅ YES (organizer) | 2 |
| Dr. Johnson | ✅ YES (attendee) | ❌ NO | 1 |
| Mr. Wilson | ❌ NO | ✅ YES (attendee) | 1 |
| Ms. Brown (not involved) | ❌ NO | ❌ NO | 0 |

---

## 🔍 Filtering Logic Flow

```
┌─────────────────────────────────────────────────────────┐
│ Load all meetings from localStorage + mock data         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ For each meeting, check filtering criteria:            │
└─────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                  ↓
┌──────────────────────┐       ┌──────────────────────┐
│ Is current user      │       │ Is current user in   │
│ the organizer?       │       │ attendees[] by ID?   │
│                      │       │                      │
│ YES → INCLUDE ✅     │       │ YES → INCLUDE ✅     │
│ NO → Continue        │       │ NO → Continue        │
└──────────────────────┘       └──────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                  ↓
┌──────────────────────┐       ┌──────────────────────┐
│ Is current user in   │       │ Not a match          │
│ attendees[] by name? │       │                      │
│ (fallback)           │       │ EXCLUDE ❌           │
│                      │       │                      │
│ YES → INCLUDE ✅     │       │                      │
│ NO → Exclude         │       │                      │
└──────────────────────┘       └──────────────────────┘
```

---

## 🎨 Visual Example

### **Calendar Page - Upcoming Meetings Section**

**User:** Prof. Michael Chen (Registrar)

```
┌────────────────────────────────────────────────────┐
│              UPCOMING MEETINGS                     │
│  ┌──────────────────────────────────────────┐     │
│  │ ✅ Faculty Review Board                  │     │
│  │ 📅 Jan 18, 2024 • 10:00 AM             │     │
│  │ 👥 3 attendees • You are invited        │     │
│  │ [Join Meeting]                           │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │ ✅ Budget Planning Session               │     │
│  │ 📅 Jan 20, 2024 • 9:00 AM              │     │
│  │ 👥 8 attendees • You are invited        │     │
│  │ [Join Meeting]                           │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ❌ Does NOT see: "EEE Department Review"        │
│     (Not selected as attendee)                    │
└────────────────────────────────────────────────────┘
```

---

### **Dashboard - Calendar & Meetings Widget**

**User:** Mr. James Wilson (HOD-EEE) - `user-id: hod-eee-001`

```
┌────────────────────────────────────────────────────┐
│      📅 CALENDAR & MEETINGS                        │
│  ┌──────────────────────────────────────────┐     │
│  │ Upcoming Meetings (3)                    │     │
│  │                                           │     │
│  │ ✅ EEE Department Review                 │     │
│  │ Jan 19 • 11:00 AM • Virtual             │     │
│  │ [You are invited]                        │     │
│  │                                           │     │
│  │ ✅ Monthly Academic Committee            │     │
│  │ Jan 21 • 2:00 PM • Conference Room      │     │
│  │ [You are the organizer]                  │     │
│  │                                           │     │
│  │ ✅ All HODs Budget Meeting               │     │
│  │ Jan 22 • 10:00 AM • Auditorium          │     │
│  │ [You are invited]                        │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ❌ Does NOT see:                                 │
│     - "Faculty Review Board" (Not selected)       │
│     - "CSE Curriculum Update" (Different dept)    │
└────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Summary

### **Files to Modify:**

1. **`src/utils/meetingFilters.ts`** (NEW)
   - Create `filterMeetingsByRecipient()` function
   - Shared filtering logic

2. **`src/components/MeetingScheduler.tsx`**
   - Update `handleCreateMeeting()` to save to localStorage
   - Apply `filterMeetingsByRecipient()` to displayed meetings
   - Add storage event listener for real-time updates

3. **`src/components/dashboard/widgets/CalendarWidget.tsx`**
   - Update mock meetings to use object-based attendees
   - Load meetings from localStorage
   - Apply `filterMeetingsByRecipient()` instead of role-based filtering
   - Add storage event listener

4. **`src/types/meeting.ts`**
   - Ensure `MeetingAttendee` interface is exported
   - Ensure `Meeting` interface includes `createdBy` field

---

## 🎯 Key Requirements Checklist

- [ ] **Recipient Filtering:** Only selected attendees see meeting cards
- [ ] **Organizer Visibility:** Organizer always sees their created meetings
- [ ] **Calendar Page:** Upcoming Meetings section filters by recipient
- [ ] **Dashboard Widget:** Calendar & Meetings widget filters by recipient
- [ ] **Data Persistence:** Meetings saved to localStorage
- [ ] **Real-Time Updates:** Storage events sync between components
- [ ] **Consistent Data Structure:** All meetings use object-based attendees
- [ ] **Console Logging:** Debug logs for filtering decisions
- [ ] **Backward Compatibility:** Fallback name matching for legacy data

---

## 🚀 Next Steps for Implementation

1. **Create filtering utility:** `src/utils/meetingFilters.ts`
2. **Update MeetingScheduler:** Add localStorage save and filtering
3. **Update CalendarWidget:** Load from localStorage and apply filtering
4. **Standardize mock data:** Convert string attendees to object attendees
5. **Test scenarios:** Verify filtering works for all user roles
6. **Add console logs:** Debug visibility decisions
7. **Handle edge cases:** Empty attendees, deleted users, etc.

---

**Status:** 📋 Explanation Complete - Ready for Implementation  
**Date:** November 5, 2025  
**Priority:** HIGH - Core visibility and privacy feature
