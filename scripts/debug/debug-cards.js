// Debug script to check tracking cards and approval cards
// Run this in browser console to diagnose card visibility issues

console.log('='.repeat(80));
console.log('CARD VISIBILITY DIAGNOSTIC TOOL');
console.log('='.repeat(80));

// 1. Check submitted documents (tracking cards)
console.log('\n📄 TRACKING CARDS (submitted-documents):');
const submittedDocs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
console.log(`Total tracking cards: ${submittedDocs.length}`);
submittedDocs.forEach((doc, index) => {
  console.log(`\n${index + 1}. ${doc.title}`);
  console.log(`   ID: ${doc.id}`);
  console.log(`   Submitted by: ${doc.submittedBy}`);
  console.log(`   Submitted by designation: ${doc.submittedByDesignation || 'N/A'}`);
  console.log(`   Status: ${doc.status}`);
  console.log(`   Recipients in workflow:`, doc.workflow?.recipients || 'None');
  console.log(`   Workflow steps:`, doc.workflow?.steps?.map(s => `${s.name} (${s.status})`).join(', ') || 'None');
});

// 2. Check approval cards
console.log('\n\n📋 APPROVAL CARDS (pending-approvals):');
const approvalCards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
console.log(`Total approval cards: ${approvalCards.length}`);
approvalCards.forEach((card, index) => {
  console.log(`\n${index + 1}. ${card.title}`);
  console.log(`   ID: ${card.id}`);
  console.log(`   Tracking Card ID: ${card.trackingCardId || 'N/A'}`);
  console.log(`   Submitter: ${card.submitter}`);
  console.log(`   Recipients (names):`, card.recipients || 'None');
  console.log(`   Recipient IDs:`, card.recipientIds || 'None');
  console.log(`   Status: ${card.status}`);
  console.log(`   Priority: ${card.priority}`);
  console.log(`   Files:`, card.files?.length || 0, 'files');
});

// 3. Check user profile
console.log('\n\n👤 CURRENT USER PROFILE:');
const userProfile = JSON.parse(localStorage.getItem('user-profile') || '{}');
console.log('Name:', userProfile.name || 'Not set');
console.log('Department:', userProfile.department || 'Not set');
console.log('Designation:', userProfile.designation || 'Not set');

// 4. Check auth context
console.log('\n\n🔐 AUTH CONTEXT:');
const authUser = JSON.parse(localStorage.getItem('auth-user') || '{}');
console.log('User name:', authUser.name || 'Not set');
console.log('User role:', authUser.role || 'Not set');
console.log('User email:', authUser.email || 'Not set');

// 5. Matching test
console.log('\n\n🔍 RECIPIENT MATCHING TEST:');
const currentUserRole = (authUser.role || '').toLowerCase();
const currentUserName = (userProfile.name || authUser.name || '').toLowerCase();

console.log(`Testing with: Role="${currentUserRole}", Name="${currentUserName}"`);

approvalCards.forEach((card) => {
  const recipientsToCheck = card.recipientIds || card.recipients || [];
  const matches = recipientsToCheck.filter((recipient) => {
    const recipientLower = recipient.toLowerCase();
    return recipientLower.includes(currentUserRole) || 
           recipientLower.includes(currentUserName) ||
           recipientLower.includes(currentUserRole.replace(/\s+/g, '-'));
  });
  
  console.log(`\n${card.title}:`);
  console.log(`  Should show: ${matches.length > 0 ? 'YES ✅' : 'NO ❌'}`);
  if (matches.length > 0) {
    console.log(`  Matched recipients:`, matches);
  }
});

// 6. Check for common issues
console.log('\n\n⚠️ COMMON ISSUES CHECK:');
const issues = [];

if (submittedDocs.length === 0) {
  issues.push('No tracking cards found - try submitting a document first');
}

if (approvalCards.length === 0) {
  issues.push('No approval cards found - check if cards were created during submission');
}

if (!userProfile.name && !authUser.name) {
  issues.push('User name not set - cards may not be visible');
}

if (!authUser.role) {
  issues.push('User role not set - recipient matching will fail');
}

// Check for orphaned approval cards (no matching tracking card)
approvalCards.forEach((card) => {
  if (card.trackingCardId) {
    const hasTrackingCard = submittedDocs.some(doc => doc.id === card.trackingCardId);
    if (!hasTrackingCard) {
      issues.push(`Approval card "${card.title}" has no matching tracking card (ID: ${card.trackingCardId})`);
    }
  }
});

if (issues.length === 0) {
  console.log('✅ No obvious issues detected');
} else {
  console.log('Found issues:');
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue}`);
  });
}

// 7. Recommendations
console.log('\n\n💡 RECOMMENDATIONS:');
console.log('1. Make sure you have filled out Personal Information (Profile page)');
console.log('2. Check that recipient IDs in approval cards match your role');
console.log('3. Look at browser console for filtering logs when viewing pages');
console.log('4. Try submitting a new document and watch the console logs');
console.log('5. Check Network tab for any failed API calls');

console.log('\n' + '='.repeat(80));
console.log('END OF DIAGNOSTIC');
console.log('='.repeat(80));
