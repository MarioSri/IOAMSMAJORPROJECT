# Workflow Progress Tracking Fix for Track Documents

## Problem
The workflow progress in Track Documents page is not updating correctly when documents are approved or rejected in the Approval Center.

## Root Causes

### 1. **Approval Progress Calculation Issues**
- Progress calculation doesn't properly handle all routing types (sequential, parallel, bidirectional, reverse)
- Division by zero errors when calculating percentages
- Inconsistent step counting between different workflow modes

### 2. **Rejection Progress Issues**
- Rejected steps don't update the progress bar correctly
- Bypassed steps (in parallel mode) don't show proper visual indicators
- Workflow status doesn't reflect partial completions

### 3. **Step Status Updates**
- Current step indicator doesn't advance properly after approval
- Completed steps don't show checkmarks consistently
- Rejected/bypassed steps show wrong icons

## How It Works Currently

### Approval Flow (Approvals.tsx → handleAcceptDocumentFallback)
1. User clicks "Approve & Sign" in Approval Center
2. Function finds the document in `submitted-documents` localStorage
3. Updates workflow steps based on routing type:
   - **Sequential**: Marks current step as completed, advances to next
   - **Parallel**: Marks user's step as completed, others stay current
   - **Approval Chain Bypass**: Marks step as completed, handles bypassed recipients
4. Calculates new progress percentage
5. Saves to localStorage and triggers `workflow-updated` event
6. Track Documents page listens and reloads

### Rejection Flow (Approvals.tsx → handleRejectDocumentFallback)
1. User clicks "Reject" with comments
2. Function updates workflow based on routing type:
   - **Sequential**: Marks current as rejected, cancels pending steps
   - **Parallel with Bypass**: Marks user's step as rejected, others continue
   - **Parallel without Bypass**: Stops entire workflow
3. Updates progress and status
4. Saves and triggers events

## The Fix

### Key Changes Needed

1. **Standardize Progress Calculation**
```typescript
// Before (inconsistent)
const newProgress = Math.round((completedCount / recipientSteps.length) * 100);

// After (safe division)
const totalSteps = recipientSteps.length;
const newProgress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
```

2. **Fix Step Counting**
```typescript
// Always exclude 'Submission' step from recipient count
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');

// Count all actioned steps (completed, rejected, bypassed)
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'rejected' || s.status === 'bypassed'
).length;
```

3. **Update Current Step Display**
```typescript
// For sequential: show next step name or "Complete"
currentStep: allCompleted ? 'Complete' : updatedSteps[currentStepIndex + 1]?.name || 'Complete'

// For parallel: show progress count
currentStep: allCompleted ? 'Complete' : `Signed by ${completedCount} of ${totalSteps} recipients`
```

4. **Fix Status Logic**
```typescript
// Determine final status based on workflow completion
status: allCompleted ? 'approved' : 
        hasRejections && !hasBypass ? 'rejected' : 
        'pending'
```

## Implementation Steps

### Step 1: Fix Approval Progress (Lines ~1100-1300 in Approvals.tsx)
- Add safe division checks for all progress calculations
- Ensure totalSteps variable is defined before use
- Update currentStep text to reflect actual workflow state

### Step 2: Fix Rejection Progress (Lines ~1400-1600 in Approvals.tsx)
- Add proper step counting for bypassed recipients
- Update progress to include rejected steps in parallel mode
- Fix status determination logic

### Step 3: Update Track Documents Display (DocumentTracker.tsx)
- Ensure workflow steps show correct icons:
  - ✓ Green checkmark for completed
  - ✗ Red X for rejected
  - ✗ Red X for bypassed (with BYPASS badge)
  - ⏸ Gray circle for cancelled
  - ⏳ Blue clock for current
  - ○ Empty circle for pending

### Step 4: Test All Routing Types
1. **Sequential**: Approve → Progress advances → Next recipient sees card
2. **Parallel**: Approve → Progress increases → All recipients keep cards
3. **Approval Chain Bypass Sequential**: Reject → Step marked bypassed → Next recipient gets card
4. **Approval Chain Bypass Parallel**: Reject → Step marked bypassed → All continue
5. **Bidirectional**: Reject → Resend/Re-upload buttons appear

## Expected Behavior After Fix

### Approval
- ✅ Progress bar updates immediately in Track Documents
- ✅ Current step advances to next recipient
- ✅ Completed steps show green checkmarks
- ✅ Signature count increases
- ✅ Status changes to "approved" when all complete

### Rejection
- ✅ Progress bar shows rejection (red X on step)
- ✅ Sequential: Workflow stops, pending steps cancelled
- ✅ Parallel with Bypass: Rejected step marked, others continue
- ✅ Parallel without Bypass: All steps cancelled
- ✅ Status changes to "rejected" or "partially-approved"

## Testing Checklist

- [ ] Sequential workflow: Approve → Check progress advances
- [ ] Sequential workflow: Reject → Check workflow stops
- [ ] Parallel workflow: Multiple approvals → Check all tracked
- [ ] Parallel with bypass: Reject → Check others continue
- [ ] Approval Chain Bypass: Reject → Check BYPASS badge shows
- [ ] Bidirectional: Reject → Check Resend button appears
- [ ] Progress percentage matches actual completion
- [ ] Current step text is accurate
- [ ] All icons display correctly in Track Documents

## Files Modified
1. `src/pages/Approvals.tsx` - Approval and rejection handlers
2. `src/components/DocumentTracker.tsx` - Visual display of workflow steps

## Related Issues
- Workflow progress not updating after approval
- Rejection not showing proper status
- Progress bar stuck at incorrect percentage
- Current step not advancing
- Icons not matching step status
