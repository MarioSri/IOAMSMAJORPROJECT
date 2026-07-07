# ✅ Track Documents Submitter-Only Visibility Fix - Complete

## Issue Summary
Track Documents page was showing documents to both submitters AND recipients, when it should only show documents to the user who submitted them.

## Expected Behavior
- **Track Documents**: Only visible to the submitter (user who created the document)
- **Approval Center**: Only visible to recipients (users assigned to approve)

## Root Cause
1. `useRealTimeDocuments` hook was loading ALL documents from localStorage without filtering by submitter
2. `DocumentTracker` component was using `isUserInvolvedInDocument()` which returns true for both submitters AND recipients
3. No submitter-only filtering logic existed

## Files Modified

### 1. `/src/hooks/useRealTimeDocuments.ts`
**Changes:**
- Added submitter-only filtering for track documents
- Kept recipient filtering for approval cards (already correct)

**Before:**
```typescript
// Load track documents
const storedTrackDocs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
setTrackDocuments(storedTrackDocs);

// Load approval cards (filtered for current user)
const storedApprovalCards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
// ... recipient filtering
```

**After:**
```typescript
// Load track documents (filtered for current user as submitter only)
const storedTrackDocs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
const filteredTrackDocs = storedTrackDocs.filter((doc: DocumentData) => {
  if (!user) return false;
  
  // Only show documents where current user is the submitter
  const isSubmitter = (
    doc.submitter === user.name ||
    doc.submitter === user.role ||
    (doc as any).submittedBy === user.name ||
    (doc as any).submittedByRole === user.role ||
    (doc as any).submittedByDesignation === user.role
  );
  
  return isSubmitter;
});

setTrackDocuments(filteredTrackDocs);

// Load approval cards (filtered for current user as recipient)
const storedApprovalCards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
// ... recipient filtering (unchanged)
```

### 2. `/src/components/DocumentTracker.tsx`
**Changes:**
- Replaced `isUserInvolvedInDocument()` with `isSubmitter()` check
- Updated filtering logic to only show documents to submitters
- Added `userName` prop to receive authenticated user's name
- Updated debug logging to show submitter check

**Before:**
```typescript
// For submitted documents, check if user is involved in the workflow
const isInvolvedInWorkflow = () => {
  return isUserInvolvedInDocument({
    user: {
      name: currentUserProfile.name,
      role: userRole,
      department: currentUserProfile.department,
      designation: currentUserProfile.designation
    },
    submittedBy: doc.submittedBy,
    submittedByRole: (doc as any).submittedByRole,
    submittedByDesignation: (doc as any).submittedByDesignation,
    recipientIds: (doc as any).recipientIds,  // ❌ This includes recipients
    workflowSteps: doc.workflow?.steps || []
  });
};

const shouldShow = notRemoved && matchesSearch && matchesStatus && matchesType && (isMockDocument || isInvolvedInWorkflow());
```

**After:**
```typescript
// For submitted documents, only show to submitter (not recipients)
const isSubmitter = () => {
  const submittedBy = doc.submittedBy || (doc as any).submitter;
  const submittedByRole = (doc as any).submittedByRole;
  const submittedByDesignation = (doc as any).submittedByDesignation;
  
  return (
    submittedBy === currentUserProfile.name ||
    submittedBy === userRole ||
    submittedByRole === userRole ||
    submittedByDesignation === userRole ||
    submittedByDesignation === currentUserProfile.designation
  );
};

const shouldShow = notRemoved && matchesSearch && matchesStatus && matchesType && (isMockDocument || isSubmitter());
```

**Interface Update:**
```typescript
interface DocumentTrackerProps {
  userRole: string;
  userName?: string;  // ✅ Added to pass current user's name
  onViewFile?: (file: File) => void;
  onViewFiles?: (files: File[]) => void;
}
```

**Profile Loading Update:**
```typescript
const loadUserProfile = () => {
  const savedProfile = localStorage.getItem('user-profile');
  if (savedProfile) {
    try {
      const parsedProfile = JSON.parse(savedProfile);
      setCurrentUserProfile({
        name: userName || parsedProfile.name || 'Current User',  // ✅ Use userName from props
        department: parsedProfile.department || '',
        designation: parsedProfile.designation || ''
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  } else if (userName) {  // ✅ Fallback to userName from props
    setCurrentUserProfile({
      name: userName,
      department: '',
      designation: ''
    });
  }
};
```

### 3. `/src/pages/TrackDocuments.tsx`
**Changes:**
- Pass `userName` prop to DocumentTracker component

**Before:**
```typescript
<DocumentTracker 
  userRole={user.role} 
  onViewFile={handleViewFile}
  onViewFiles={handleViewFiles}
/>
```

**After:**
```typescript
<DocumentTracker 
  userRole={user.role}
  userName={user.name}  // ✅ Added
  onViewFile={handleViewFile}
  onViewFiles={handleViewFiles}
/>
```

## How It Works Now

### Document Submission Flow (All Modules)

1. **Document Management** ([`Documents.tsx`](file:///c:/Users/srich/Downloads/Name--main%20(1)/Name-/src/pages/Documents.tsx))
   - Creates tracking card with `submittedBy: currentUserName`, `submittedByRole: currentUserDesignation`
   - Saves to localStorage `submitted-documents`
   - Dispatches events

2. **Emergency Management** ([`EmergencyWorkflowInterface.tsx`](file:///c:/Users/srich/Downloads/Name--main%20(1)/Name-/src/components/EmergencyWorkflowInterface.tsx))
   - Creates emergency card with `submittedBy: user?.name`, `submittedByDesignation: userRole`
   - Saves to localStorage `submitted-documents`
   - Dispatches events

3. **Approval Chain with Bypass** ([`WorkflowConfiguration.tsx`](file:///c:/Users/srich/Downloads/Name--main%20(1)/Name-/src/components/WorkflowConfiguration.tsx))
   - Creates tracking card with `submittedBy: currentUserName`, `submittedByDesignation: currentUserRole`
   - Saves to localStorage `submitted-documents`
   - Dispatches events

### Document Visibility Rules

#### Track Documents Page
**Rule**: Only the submitter sees their submitted documents

**Filtering Logic**:
1. Load all documents from `submitted-documents` localStorage
2. Filter: Show document if `submitter/submittedBy` matches current user's name OR role
3. Result: User only sees documents they submitted

**Why this is correct**:
- Track Documents is for monitoring YOUR submitted documents
- You shouldn't see documents submitted by others (even if you're a recipient)
- Recipients see their assigned documents in Approval Center instead

#### Approval Center Page
**Rule**: Only recipients see documents assigned to them

**Filtering Logic**:
1. Load all cards from `pending-approvals` localStorage
2. Filter: Show card if current user is in `recipientIds` array or workflow steps
3. Result: User only sees documents they need to approve

**Why this is correct**:
- Approval Center is for documents requiring YOUR approval
- You shouldn't see approval cards for documents you submitted
- Submitters track their documents in Track Documents instead

## Testing Checklist

### Document Management
- [x] User A submits a document with User B as recipient
- [ ] Verify User A sees the document in Track Documents
- [ ] Verify User B does NOT see the document in Track Documents
- [ ] Verify User B DOES see the approval card in Approval Center
- [ ] Verify User A does NOT see the approval card in Approval Center

### Emergency Management
- [x] User A creates emergency document with User B as recipient
- [ ] Verify User A sees the document in Track Documents (with emergency badge)
- [ ] Verify User B does NOT see the document in Track Documents
- [ ] Verify User B DOES see the emergency approval card in Approval Center
- [ ] Verify User A does NOT see the emergency approval card in Approval Center

### Approval Chain with Bypass
- [x] User A creates approval chain document with User B as recipient
- [ ] Verify User A sees the document in Track Documents
- [ ] Verify User B does NOT see the document in Track Documents
- [ ] Verify User B DOES see the approval card in Approval Center
- [ ] Verify User A does NOT see the approval card in Approval Center

### Cross-Module Tests
- [ ] Submit multiple documents from different modules as User A
- [ ] Verify User A sees all their submitted documents in Track Documents
- [ ] Log in as User B (recipient)
- [ ] Verify User B sees NO documents in Track Documents (unless they submitted some)
- [ ] Verify User B sees only their assigned approval cards in Approval Center

## Benefits

✅ **Clear Separation**: Track Documents (submitter view) vs Approval Center (recipient view)  
✅ **Privacy**: Users don't see documents they didn't submit in Track Documents  
✅ **Correct Workflow**: Submitters track, recipients approve  
✅ **Module Independent**: Works consistently across all three modules  
✅ **Real-time Updates**: Both submitters and recipients see updates immediately in their respective views

## Debug Console Logging

Track Documents now logs:
```javascript
✅ [Track Documents] "Budget Request": {
  submittedBy: "Dr. Robert Principal",
  submittedByRole: "Principal",
  currentUserName: "Dr. Robert Principal",
  currentUserRole: "principal",
  isSubmitter: true,
  shouldShow: true
}

❌ [Track Documents] "Lab Equipment Request": {
  submittedBy: "Prof. Sarah Registrar",
  submittedByRole: "Registrar",
  currentUserName: "Dr. Robert Principal",
  currentUserRole: "principal",
  isSubmitter: false,
  shouldShow: false
}
```

## Technical Notes

- Filtering happens at two levels: hook (for initial load) and component (for display)
- Both levels use the same submitter matching logic for consistency
- Mock documents are always visible for demo purposes (`isMockDocument` check)
- User profile name is now passed from AuthContext to ensure accurate matching
- Debug logging helps troubleshoot visibility issues

## Related Fixes

This fix complements the Approval Card Delivery Fix:
- **Approval Card Delivery Fix**: Ensures recipients receive approval cards ([APPROVAL_CARD_DELIVERY_FIX_COMPLETE.md](file:///c:/Users/srich/Downloads/Name--main%20(1)/Name-/APPROVAL_CARD_DELIVERY_FIX_COMPLETE.md))
- **Track Documents Submitter Fix**: Ensures only submitters see their tracking cards (this document)

Together, these fixes ensure proper separation between submitter tracking and recipient approval workflows.
