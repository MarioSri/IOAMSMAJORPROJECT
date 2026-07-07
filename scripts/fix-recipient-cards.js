// Fix recipient card visibility issues
// Run this in browser console on Approval Center page

console.log('🔧 RECIPIENT CARD FIX TOOL');
console.log('='.repeat(60));

// Get current user
const authUser = JSON.parse(localStorage.getItem('auth-user') || '{}');
const userProfile = JSON.parse(localStorage.getItem('user-profile') || '{}');

console.log('\n👤 Current User:');
console.log('Name:', authUser.name || userProfile.name || 'NOT SET ❌');
console.log('Role:', authUser.role || 'NOT SET ❌');
console.log('Email:', authUser.email || 'NOT SET ❌');

const currentRole = (authUser.role || '').toLowerCase();
const currentName = (authUser.name || userProfile.name || '').toLowerCase();

// Get approval cards
const approvalCards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');

console.log('\n📋 Approval Cards:', approvalCards.length);

if (approvalCards.length === 0) {
  console.log('❌ No approval cards found.');
  console.log('💡 Submit a document from Document Management page first.');
} else {
  approvalCards.forEach((card, i) => {
    console.log(`\n${i + 1}. ${card.title}`);
    console.log('   Recipients (names):', card.recipients || []);
    console.log('   Recipient IDs:', card.recipientIds || []);
    
    // Test matching
    const recipientsToCheck = card.recipientIds || card.recipients || [];
    const matches = recipientsToCheck.filter(r => {
      const rLower = r.toLowerCase();
      return rLower.includes(currentRole) || 
             rLower.includes(currentName) ||
             rLower.includes(currentRole.replace(/\s+/g, '-'));
    });
    
    const shouldShow = matches.length > 0;
    console.log(`   Should Show: ${shouldShow ? '✅ YES' : '❌ NO'}`);
    
    if (!shouldShow && recipientsToCheck.length > 0) {
      console.log('   ⚠️ MISMATCH! Your role/name not in recipients.');
      console.log(`   Your role: "${currentRole}"`);
      console.log(`   Recipients: ${recipientsToCheck.join(', ')}`);
    }
  });
}

// Check tracking cards
console.log('\n\n📄 Tracking Cards (for reference):');
const trackingCards = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
console.log('Total:', trackingCards.length);

trackingCards.forEach((doc, i) => {
  console.log(`\n${i + 1}. ${doc.title}`);
  console.log('   Workflow recipients:', doc.workflow?.recipients || []);
  
  // Check if approval cards exist for this tracking card
  const relatedApprovals = approvalCards.filter(a => 
    a.trackingCardId === doc.id || a.id === doc.id
  );
  console.log(`   Related approval cards: ${relatedApprovals.length}`);
});

console.log('\n\n💡 TROUBLESHOOTING:');
console.log('1. Check if your role matches recipient IDs');
console.log('2. Recipient IDs should contain your role (e.g., "principal")');
console.log('3. Try logging in with the correct role');
console.log('4. Check if approval cards were created during submission');

console.log('\n📊 ROLE MATCHING TEST:');
const testRoles = ['principal', 'registrar', 'hod', 'dean', 'employee'];
testRoles.forEach(role => {
  const matchCount = approvalCards.filter(card => {
    const recipients = card.recipientIds || card.recipients || [];
    return recipients.some(r => r.toLowerCase().includes(role));
  }).length;
  console.log(`${role}: ${matchCount} cards`);
});

console.log('\n='.repeat(60));
