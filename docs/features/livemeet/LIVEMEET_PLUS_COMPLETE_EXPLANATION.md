# 🟢🔴 LiveMeet+ Complete Implementation Guide

## 📋 Overview

This document provides a comprehensive explanation of how the **LiveMeet+** feature works in your IOAMS application, covering both the **recipient filtering logic** and the **card UI design**.

---

## 🔄 Complete LiveMeet+ Workflow

### **Phase 1: Initiating LiveMeet+ from Approval Center**

#### **Location:** `src/pages/Approvals.tsx` (Lines 1814-1830)

When a user clicks the **"LiveMeet+"** button on any approval card:

```tsx
<Button 
  size="sm" 
  variant="outline" 
  className="border-orange-500 text-orange-600 hover:bg-orange-50"
  onClick={() => {
    setSelectedDocument({ 
      id: doc.id, 
      type: doc.type.toLowerCase(), 
      title: doc.title 
    });
    setShowLiveMeetingModal(true);
  }}
>
  <div className="flex items-center gap-2">
    <div className="relative w-4 h-4">
      <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full"></div>
      <div className="absolute inset-1 w-2 h-2 bg-red-500 rounded-full"></div>
    </div>
    LiveMeet+
  </div>
</Button>
```

**What Happens:**
1. ✅ User clicks **LiveMeet+ button** on approval card (e.g., "Faculty Meeting Minutes – Q4 2024")
2. ✅ Document details captured: `id`, `type`, `title`
3. ✅ `LiveMeetingRequestModal` opens

---

### **Phase 2: Selecting Recipients in LiveMeet+ Modal**

#### **Location:** `src/components/LiveMeetingRequestModal.tsx` (Lines 60-115)

The modal displays a **recipient selection interface**:

```
┌──────────────────────────────────────────────────────────────┐
│                    LiveMeet+ Request Modal                    │
│                                                               │
│  Document: Faculty Meeting Minutes – Q4 2024                 │
│                                                               │
│  Meeting Purpose: Need Clarification                         │
│  Urgency Level: ⚡ Immediate                                 │
│  Meeting Format: 🖥️ Online                                  │
│                                                               │
│  ┌─────────── SELECT RECIPIENTS ───────────┐                │
│  │  ☑ Dr. Robert Smith (Principal)         │ ◄─ Selected   │
│  │  ☑ Prof. Michael Chen (HOD)             │ ◄─ Selected   │
│  │  ☑ Ms. Lisa Wang (Registrar)            │ ◄─ Selected   │
│  │  ☐ Dr. Sarah Johnson (Dean)             │ ◄─ NOT Selected│
│  │  ☐ Prof. Alex Martinez (Faculty)        │ ◄─ NOT Selected│
│  └──────────────────────────────────────────┘                │
│                                                               │
│  Agenda: [Text area for meeting description]                 │
│                                                               │
│                              [Send LiveMeet+ Request]         │
└──────────────────────────────────────────────────────────────┘
```

**Key State Variables:**
```tsx
const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);

const handleParticipantToggle = (participantId: string) => {
  setSelectedParticipants(prev => 
    prev.includes(participantId) 
      ? prev.filter(id => id !== participantId)  // Unselect
      : [...prev, participantId]                  // Select
  );
};
```

**User Actions:**
- ✅ Check/uncheck recipients using checkboxes
- ✅ Add custom participants if needed
- ✅ Must select at least one recipient (validation required)

---

### **Phase 3: Creating LiveMeet+ Request with Selected Recipients**

#### **Location:** `src/components/LiveMeetingRequestModal.tsx` (Lines 182-250)

When the user clicks **"Send LiveMeet+ Request"**:

```tsx
const handleSubmitRequest = async () => {
  // Validation: At least one recipient must be selected
  if (selectedParticipants.length === 0) {
    toast({
      title: "Validation Error",
      description: "Please select at least one participant",
      variant: "destructive"
    });
    return;
  }

  // Get selected participant names for display
  const selectedParticipantNames = selectedParticipants.map(id => 
    availableParticipants.find(p => p.id === id)?.name || 'Unknown'
  );
  
  // Create card data with ONLY selected participants
  const cardData = {
    id: `livemeet-${Date.now()}`,
    title: documentTitle,
    type: documentType,
    submitter: user?.name || 'Current User',      // Initiator name
    submitterRole: user?.role || 'employee',       // Initiator role
    status: 'pending',
    priority: urgency,
    description: agenda || 'LiveMeet+ request for document discussion',
    meetingFormat,
    purpose: purpose,
    requestedDate: requestedDate,
    startTime: startTime,
    endTime: endTime,
    location: meetingFormat === 'in_person' ? location : undefined,
    
    // ⭐ CRITICAL: Store recipient information for filtering
    targetParticipants: selectedParticipantNames,        // Display names
    targetParticipantIds: selectedParticipants          // Unique IDs for matching
  };

  // Store in localStorage for Messages page to read
  const existingRequests = JSON.parse(localStorage.getItem('livemeet-requests') || '[]');
  existingRequests.unshift(cardData);
  localStorage.setItem('livemeet-requests', JSON.stringify(existingRequests));
  
  // Show success notification
  toast({
    title: "LiveMeet+ Request Sent",
    description: `Your LiveMeet+ request has been sent to: ${selectedParticipantNames.join(', ')}`,
    variant: "default"
  });
};
```

**Stored Data Structure:**
```json
{
  "id": "livemeet-1730822400000",
  "title": "Faculty Meeting Minutes – Q4 2024",
  "type": "circular",
  "submitter": "Dr. Robert Smith",
  "submitterRole": "principal",
  "status": "pending",
  "priority": "immediate",
  "targetParticipants": [
    "Dr. Robert Smith",
    "Prof. Michael Chen",
    "Ms. Lisa Wang"
  ],
  "targetParticipantIds": [
    "principal-001",
    "hod-cse-002",
    "registrar-003"
  ]
}
```

---

### **Phase 4: Messages Page - Loading & Filtering LiveMeet+ Requests**

#### **Location:** `src/pages/Messages.tsx` (Lines 115-120)

#### **Current Implementation (Without Filtering):**
```tsx
const loadLiveMeetRequests = useCallback(() => {
  const requests = JSON.parse(localStorage.getItem('livemeet-requests') || '[]');
  setLiveMeetRequests(requests);
  setStats(prev => ({ ...prev, liveMeetingRequests: requests.length }));
}, []);
```

#### **⚠️ REQUIRED: Add Recipient Filtering**

```tsx
const loadLiveMeetRequests = useCallback(() => {
  // Load all LiveMeet+ requests from localStorage
  const allRequests = JSON.parse(localStorage.getItem('livemeet-requests') || '[]');
  
  // Get current user information
  const currentUserId = user?.id;
  const currentUserName = user?.name;
  const currentUserRole = user?.role;
  
  // ⭐ FILTER: Show only requests where current user is a target participant
  const filteredRequests = allRequests.filter((request: any) => {
    // Check if current user ID is in targetParticipantIds array
    if (request.targetParticipantIds?.includes(currentUserId)) {
      return true;
    }
    
    // Fallback: Check by name if ID matching doesn't work
    if (request.targetParticipants?.some((name: string) => 
      name.toLowerCase() === currentUserName?.toLowerCase()
    )) {
      return true;
    }
    
    // If user is the initiator, they should also see their own request
    if (request.submitter?.toLowerCase() === currentUserName?.toLowerCase()) {
      return true;
    }
    
    return false;
  });
  
  // Update state with filtered requests only
  setLiveMeetRequests(filteredRequests);
  setStats(prev => ({ ...prev, liveMeetingRequests: filteredRequests.length }));
}, [user]);
```

---

### **Phase 5: Displaying LiveMeet+ Cards (UI Design)**

#### **Location:** `src/components/LiveMeetingRequestManager.tsx` (Lines 480-745)

The Messages page displays LiveMeet+ cards following the **exact demo card design**:

---

## 🎨 LiveMeet+ Card UI Design Specification

### **✅ CORRECT Design (Following Demo Cards)**

```
┌────────────────────────────────────────────────────────────────┐
│ 🟢🔴 Faculty Meeting Minutes – Q4 2024                         │
│ [Circular] [2024-01-15]                    [Pending] [⚡Immediate]│
│                                                                 │
│ 👤 From: Dr. Robert Smith • PRINCIPAL      📅 Date: 09/26/2025 │
│ ⚙️ Meeting Purpose: 📄 Need Clarification  ⏰ Time: 10:56 AM    │
│ 👥 Meeting Format: 🖥️ Online                       To: 11:56 AM │
│                                                                 │
│ 💬 Description & Agenda                                        │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Add a risk-mitigation section to highlight potential   │   │
│ │ delays or issues.                                       │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                           [✓ Accept] [✗ Decline]│
└────────────────────────────────────────────────────────────────┘
```

### **Key UI Elements:**

#### **1. Title & Badges**
```tsx
<h3 className="font-semibold text-lg flex items-center gap-2">
  <div className="relative w-4 h-4">
    <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full"></div>
    <div className="absolute inset-1 w-2 h-2 bg-red-500 rounded-full"></div>
  </div>
  Faculty Meeting Minutes – Q4 2024
</h3>
<div className="flex items-center gap-2">
  <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
    <FileText className="h-3 w-3" />
    Circular
  </div>
  <div className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
    <Calendar className="h-3 w-3" />
    2024-01-15
  </div>
</div>
```

#### **2. From Field (Initiator Only) ⭐ IMPORTANT**
```tsx
<div className="flex items-center gap-1">
  <User className="h-4 w-4" />
  <span className="font-medium">From:</span> {request.submitter} • {request.submitterRole.toUpperCase()}
</div>
```

**Display:**
- 👤 **From:** Dr. Robert Smith • PRINCIPAL

**CRITICAL:**
- ✅ **Shows ONLY the initiator** (person who clicked LiveMeet+ button)
- ✅ **Format:** `{submitter} • {submitterRole.toUpperCase()}`
- ❌ **Does NOT show selected recipients/participants**
- ❌ **No separate "Participants" or "Recipients" section**

#### **3. Meeting Details Grid**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
  {/* From */}
  <div className="flex items-center gap-1">
    <User className="h-4 w-4" />
    <span className="font-medium">From:</span> {request.submitter} • {request.submitterRole.toUpperCase()}
  </div>
  
  {/* Date */}
  <div className="flex items-center gap-1">
    <Calendar className="h-4 w-4" />
    <span className="font-medium">Date:</span> {request.requestedDate}
  </div>
  
  {/* Meeting Purpose */}
  <div className="flex items-center gap-1">
    <Settings className="h-4 w-4" />
    <span className="font-medium">Meeting Purpose:</span> 
    <div className="flex items-center gap-1">
      <FileText className="h-4 w-4" />
      {request.purpose}
    </div>
  </div>
  
  {/* Time */}
  <div className="flex items-center gap-1">
    <Clock className="h-4 w-4" />
    <span className="font-medium">Time: From:</span> {request.startTime} — To: {request.endTime}
  </div>
  
  {/* Meeting Format */}
  <div className="md:col-span-2 flex items-center gap-1">
    <Users className="h-4 w-4" />
    <span className="font-medium">Meeting Format:</span> 
    <div className="flex items-center gap-1">
      <Monitor className="h-4 w-4" />
      {request.meetingFormat}
    </div>
  </div>
  
  {/* Location (if in-person) */}
  {request.meetingFormat === 'in_person' && (
    <div className="flex items-center gap-1">
      <MapPin className="h-4 w-4" />
      <span className="font-medium">Meeting Location:</span> 
      <div className="flex items-center gap-1">
        <Globe className="h-4 w-4" />
        {request.location}
      </div>
    </div>
  )}
</div>
```

#### **4. Description & Agenda**
```tsx
<div className="flex items-center gap-1">
  <MessageSquare className="h-4 w-4" />
  <span className="text-sm font-medium">Description & Agenda</span>
</div>
<div className="bg-muted p-3 rounded text-sm">
  <p>{request.description}</p>
</div>
```

#### **5. Action Buttons**
```tsx
<Button variant="outline" size="sm" onClick={() => handleAccept(request.id)}>
  <CheckCircle className="h-4 w-4 mr-2" />
  Accept
</Button>
<Button variant="outline" size="sm" onClick={() => handleDecline(request.id)}>
  <XCircle className="h-4 w-4 mr-2" />
  Decline
</Button>
```

---

## ❌ What NOT to Display on LiveMeet+ Cards

### **INCORRECT Implementation (LiveMeetingRequestCard.tsx - Lines 162-179):**

```tsx
{/* ❌ DO NOT SHOW THIS */}
<div>
  <h4 className="font-medium text-sm mb-2">Participants:</h4>
  <div className="flex items-center gap-2">
    {request.participants.slice(0, 3).map((participant) => (
      <div key={participant.id} className="flex items-center gap-1">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">
            {participant.userName.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-gray-600">{participant.userName}</span>
      </div>
    ))}
    {request.participants.length > 3 && (
      <span className="text-xs text-gray-500">
        +{request.participants.length - 3} more
      </span>
    )}
  </div>
</div>
```

**Why This Should Be Removed:**
- ❌ **Privacy**: Recipients don't need to see who else received the request
- ❌ **Design Consistency**: Demo cards don't show participants
- ❌ **Redundancy**: Filtering already ensures only relevant users see the card
- ❌ **Clutter**: Makes the card unnecessarily complex

---

## 🔐 Recipient Filtering Logic - Who Sees What

### **Scenario 1: User is Selected Recipient**

**Example:**
- **Initiator:** Dr. Robert Smith (Principal)
- **Selected Recipients:** Prof. Michael Chen (HOD), Ms. Lisa Wang (Registrar), Dr. Robert Smith (Principal)
- **Current User:** Prof. Michael Chen

**Filtering Check:**
```tsx
// Check if 'hod-cse-002' is in targetParticipantIds
targetParticipantIds: ['principal-001', 'hod-cse-002', 'registrar-003']
currentUserId: 'hod-cse-002'

// Result: TRUE ✅ - User sees the card
```

**Card Display:**
```
┌──────────────────────────────────────────────────┐
│ 🟢🔴 Faculty Meeting Minutes – Q4 2024           │
│ 👤 From: Dr. Robert Smith • PRINCIPAL ✅         │
│ ... (full card details) ...                     │
└──────────────────────────────────────────────────┘
```

---

### **Scenario 2: User is NOT Selected Recipient**

**Example:**
- **Initiator:** Dr. Robert Smith (Principal)
- **Selected Recipients:** Prof. Michael Chen (HOD), Ms. Lisa Wang (Registrar)
- **Current User:** Dr. Sarah Johnson (Dean)

**Filtering Check:**
```tsx
// Check if 'dean-004' is in targetParticipantIds
targetParticipantIds: ['principal-001', 'hod-cse-002', 'registrar-003']
currentUserId: 'dean-004'

// Result: FALSE ❌ - User does NOT see the card
```

**Messages Page Display:**
```
┌──────────────────────────────────────────────────┐
│ 🟢🔴 LiveMeet+ Tab                               │
│  Badge: 0 pending requests                      │
│                                                  │
│  No LiveMeet+ requests at this time             │
└──────────────────────────────────────────────────┘
```

---

### **Scenario 3: User is the Initiator**

**Example:**
- **Initiator:** Dr. Robert Smith (Principal)
- **Selected Recipients:** Prof. Michael Chen (HOD), Ms. Lisa Wang (Registrar)
- **Current User:** Dr. Robert Smith (initiator)

**Filtering Check:**
```tsx
// Check 1: Is user in targetParticipantIds?
targetParticipantIds: ['hod-cse-002', 'registrar-003']
currentUserId: 'principal-001'
// Result: FALSE

// Check 2: Is user the initiator?
request.submitter: 'Dr. Robert Smith'
user.name: 'Dr. Robert Smith'
// Result: TRUE ✅ - Initiator always sees their own requests
```

**Card Display:**
```
┌──────────────────────────────────────────────────┐
│ 🟢🔴 Faculty Meeting Minutes – Q4 2024           │
│ 👤 From: Dr. Robert Smith • PRINCIPAL ✅         │
│ (Shows own card)                                │
└──────────────────────────────────────────────────┘
```

---

## 📊 Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│              APPROVAL CENTER PAGE                             │
│  ┌────────────────────────────────────────────┐             │
│  │ Approval Card: Faculty Meeting Minutes     │             │
│  │ [View] [🟢🔴 LiveMeet+] [Approve & Sign]   │ ◄── Click   │
│  └────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│           LIVEMEET+ REQUEST MODAL OPENS                       │
│  ┌────────────────────────────────────────┐                 │
│  │ SELECT RECIPIENTS:                      │                 │
│  │  ☑ Dr. Robert Smith (Principal)        │ ◄── Selected   │
│  │  ☑ Prof. Michael Chen (HOD)            │ ◄── Selected   │
│  │  ☑ Ms. Lisa Wang (Registrar)           │ ◄── Selected   │
│  │  ☐ Dr. Sarah Johnson (Dean)            │ ◄── NOT Selected│
│  └────────────────────────────────────────┘                 │
│  [Send LiveMeet+ Request] ◄───── User clicks                 │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│              LOCALSTORAGE STORAGE                             │
│  Key: 'livemeet-requests'                                    │
│  {                                                            │
│    id: 'livemeet-1234567890',                                │
│    title: 'Faculty Meeting Minutes – Q4 2024',               │
│    submitter: 'Dr. Robert Smith',          ◄── Initiator    │
│    submitterRole: 'principal',                               │
│    targetParticipants: [                   ◄── Display names │
│      'Dr. Robert Smith',                                     │
│      'Prof. Michael Chen',                                   │
│      'Ms. Lisa Wang'                                         │
│    ],                                                        │
│    targetParticipantIds: [                 ◄── For filtering │
│      'principal-001',                                        │
│      'hod-cse-002',                                          │
│      'registrar-003'                                         │
│    ]                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│        MESSAGES PAGE → LiveMeet+ TAB                          │
│                                                               │
│  ┌─── FILTERING LOGIC ────────────────────┐                 │
│  │ For: Prof. Michael Chen (HOD)          │                 │
│  │ Check: Is 'hod-cse-002' in array?      │                 │
│  │ Result: ✅ YES → Show card              │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 🟢🔴 Faculty Meeting Minutes – Q4 2024             │     │
│  │ 👤 From: Dr. Robert Smith • PRINCIPAL ✅           │     │
│  │ (Only shows initiator, not participants)          │     │
│  │ 📅 Date: 09/26/2025                               │     │
│  │ ⚙️ Meeting Purpose: Need Clarification             │     │
│  │ 👥 Meeting Format: Online                          │     │
│  │ 💬 Description & Agenda                           │     │
│  │ [Accept] [Decline]                                │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│     WHAT USERS NOT IN targetParticipantIds SEE               │
│                                                               │
│  ┌─── FILTERING LOGIC ────────────────────┐                 │
│  │ For: Dr. Sarah Johnson (Dean)          │                 │
│  │ Check: Is 'dean-004' in array?         │                 │
│  │ Result: ❌ NO → Hide card               │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 🟢🔴 LiveMeet+ Tab                                 │     │
│  │  Badge: 0 pending requests                        │     │
│  │                                                    │     │
│  │  No LiveMeet+ requests at this time               │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ Implementation Checklist

### **✓ Already Implemented:**
1. ✅ LiveMeet+ button in Approval Center (`Approvals.tsx`)
2. ✅ LiveMeetingRequestModal with recipient selection
3. ✅ Data storage with `targetParticipantIds` array
4. ✅ Card display in Messages page
5. ✅ Demo cards showing correct UI design

### **⚠️ Needs Implementation:**

#### **1. Add Recipient Filtering in Messages.tsx**
**File:** `src/pages/Messages.tsx` (Line ~115)

```tsx
const loadLiveMeetRequests = useCallback(() => {
  const allRequests = JSON.parse(localStorage.getItem('livemeet-requests') || '[]');
  
  const filteredRequests = allRequests.filter((request: any) => {
    return request.targetParticipantIds?.includes(user?.id) ||
           request.targetParticipants?.includes(user?.name) ||
           request.submitter === user?.name;
  });
  
  setLiveMeetRequests(filteredRequests);
  setStats(prev => ({ ...prev, liveMeetingRequests: filteredRequests.length }));
}, [user]);
```

#### **2. Fix LiveMeetingRequestCard.tsx Display**
**File:** `src/components/LiveMeetingRequestCard.tsx`

**Change 1 (Line 93-95):** Update "From" field
```tsx
// ❌ OLD (Wrong):
<span>From: {request.requesterName} • HOD</span>

// ✅ NEW (Correct):
<span>From: {request.requesterName} • {request.requesterRole.toUpperCase()}</span>
```

**Change 2 (Lines 162-179):** Remove Participants Section
```tsx
// ❌ DELETE THIS ENTIRE BLOCK:
{/* Participants */}
<div>
  <h4 className="font-medium text-sm mb-2">Participants:</h4>
  <div className="flex items-center gap-2">
    {request.participants.slice(0, 3).map((participant) => (
      // ... participant display code
    ))}
  </div>
</div>
```

#### **3. Update Request Creation in LiveMeetingRequestModal.tsx**
**File:** `src/components/LiveMeetingRequestModal.tsx` (Line ~217)

Ensure `submitter` and `submitterRole` are included:
```tsx
const cardData = {
  // ... other fields
  submitter: user?.name || 'Current User',
  submitterRole: user?.role || 'employee',
  targetParticipants: selectedParticipantNames,
  targetParticipantIds: selectedParticipants
};
```

---

## 🎯 Key Principles

### **1. Privacy & Security**
- ✅ Only selected recipients see the LiveMeet+ card
- ✅ Non-recipients cannot access the card at all
- ✅ Filtering happens client-side based on `targetParticipantIds`

### **2. UI Consistency**
- ✅ Card design matches demo cards exactly
- ✅ Shows only "From" field with initiator information
- ✅ No participant names displayed on card
- ✅ Clean, uncluttered design

### **3. Data Integrity**
- ✅ `targetParticipantIds` array stores selected recipients
- ✅ `submitter` and `submitterRole` identify the initiator
- ✅ All data persisted in localStorage
- ✅ Real-time updates via storage events

### **4. User Experience**
- ✅ Clear recipient selection interface
- ✅ Validation ensures at least one recipient selected
- ✅ Success notification shows who received the request
- ✅ Badge count shows pending requests for current user only

---

## 📝 Summary

### **LiveMeet+ Request Flow:**
1. **Initiate** from Approval Center (any card)
2. **Select Recipients** in modal (checkbox interface)
3. **Store Request** with `targetParticipantIds` array
4. **Filter Display** in Messages page (only selected recipients see it)
5. **Show Initiator Only** on card (no participant names)
6. **Accept/Decline** buttons for recipients to respond

### **Card Display Rules:**
- ✅ **Show:** Initiator name and role (From: Dr. Robert Smith • PRINCIPAL)
- ✅ **Show:** Meeting details (purpose, format, date, time, location)
- ✅ **Show:** Description & agenda
- ❌ **Don't Show:** Selected recipient/participant names
- ❌ **Don't Show:** Participant avatars or list

### **Visibility Rules:**
- ✅ **See Card:** Users in `targetParticipantIds` array
- ✅ **See Card:** Request initiator (submitter)
- ❌ **Don't See Card:** Users not in `targetParticipantIds` array

---

## 🚀 Next Steps

1. Implement recipient filtering in `Messages.tsx`
2. Update `LiveMeetingRequestCard.tsx` to remove participants section
3. Ensure `submitter` and `submitterRole` are stored correctly
4. Test with multiple users to verify filtering works
5. Verify UI matches demo card design exactly

---

**Document Version:** 1.0  
**Last Updated:** November 5, 2025  
**Status:** Complete Implementation Guide ✅
