// WORKFLOW PROGRESS FIX - Apply these changes to Approvals.tsx

// ============================================
// FIX 1: Approval Chain Bypass - Sequential/Reverse Mode
// Location: Line ~1050 in handleAcceptDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const completedCount = recipientSteps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
const allCompleted = completedCount === recipientSteps.length;
const newProgress = Math.round((completedCount / recipientSteps.length) * 100);

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const completedCount = recipientSteps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
const totalSteps = recipientSteps.length;
const allCompleted = completedCount === totalSteps;
const newProgress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;


// ============================================
// FIX 2: Approval Chain Bypass - Parallel/Bidirectional Mode
// Location: Line ~1070 in handleAcceptDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const completedCount = recipientSteps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
const allCompleted = completedCount === recipientSteps.length;
const newProgress = Math.round((completedCount / recipientSteps.length) * 100);

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const completedCount = recipientSteps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
const totalSteps = recipientSteps.length;
const allCompleted = completedCount === totalSteps;
const newProgress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;


// ============================================
// FIX 3: Parallel Mode Progress Calculation
// Location: Line ~1095 in handleAcceptDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const completedCount = recipientSteps.filter((s: any) => s.status === 'completed').length;
const totalRecipients = recipientSteps.length;
const newProgress = Math.round((completedCount / totalRecipients) * 100);
const allCompleted = completedCount === totalRecipients;

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const completedCount = recipientSteps.filter((s: any) => s.status === 'completed').length;
const totalRecipients = recipientSteps.length;
const newProgress = totalRecipients > 0 ? Math.round((completedCount / totalRecipients) * 100) : 0;
const allCompleted = completedCount === totalRecipients;


// ============================================
// FIX 4: Sequential Mode Progress Calculation
// Location: Line ~1120 in handleAcceptDocumentFallback
// ============================================
// REPLACE THIS:
const isLastStep = currentStepIndex === trackDoc.workflow.steps.length - 1;
const newProgress = isLastStep ? 100 : Math.round(((currentStepIndex + 1) / trackDoc.workflow.steps.length) * 100);

// WITH THIS:
const totalSteps = trackDoc.workflow.steps.length;
const isLastStep = currentStepIndex === totalSteps - 1;
const completedSteps = currentStepIndex + 1;
const newProgress = isLastStep ? 100 : (totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0);


// ============================================
// FIX 5: Rejection - Parallel with Bypass Progress
// Location: Line ~1450 in handleRejectDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'rejected'
).length;
const totalRecipients = recipientSteps.length;
const newProgress = Math.round((actionedCount / totalRecipients) * 100);

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'rejected'
).length;
const totalRecipients = recipientSteps.length;
const newProgress = totalRecipients > 0 ? Math.round((actionedCount / totalRecipients) * 100) : 0;


// ============================================
// FIX 6: Rejection - Approval Chain Bypass Sequential
// Location: Line ~1380 in handleRejectDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'bypassed'
).length;
const allActioned = actionedCount === recipientSteps.length;

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'bypassed'
).length;
const totalSteps = recipientSteps.length;
const allActioned = actionedCount === totalSteps;


// ============================================
// FIX 7: Rejection - Approval Chain Bypass Parallel
// Location: Line ~1405 in handleRejectDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'bypassed'
).length;
const allActioned = actionedCount === recipientSteps.length;

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'bypassed'
).length;
const totalSteps = recipientSteps.length;
const allActioned = actionedCount === totalSteps;


// ============================================
// FIX 8: Rejection - Approval Chain Bypass Reverse
// Location: Line ~1430 in handleRejectDocumentFallback
// ============================================
// REPLACE THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'bypassed'
).length;
const allActioned = actionedCount === recipientSteps.length;

// WITH THIS:
const recipientSteps = updatedSteps.filter((s: any) => s.name !== 'Submission');
const actionedCount = recipientSteps.filter((s: any) => 
  s.status === 'completed' || s.status === 'bypassed'
).length;
const totalSteps = recipientSteps.length;
const allActioned = actionedCount === totalSteps;


// ============================================
// SUMMARY OF CHANGES
// ============================================
// All changes follow the same pattern:
// 1. Define totalSteps variable before using it
// 2. Add safe division check: totalSteps > 0 ? calculation : 0
// 3. Use totalSteps consistently instead of .length inline
//
// This prevents division by zero errors and ensures
// accurate progress calculation for all workflow types
// ============================================
