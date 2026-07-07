// Test script to create approval cards for testing
// Run this in browser console to add test approval cards

function createTestApprovalCards() {
  const testCards = [
    {
      id: 'test-principal-card',
      title: 'Test Document for Principal',
      type: 'Letter',
      submitter: 'Test User',
      submittedDate: new Date().toISOString().split('T')[0],
      priority: 'high',
      description: 'Test document specifically for Principal role',
      recipients: ['Dr. Robert Principal'],
      recipientIds: ['principal-dr.-robert-principal'],
      isEmergency: false,
      isParallel: false,
      source: 'test'
    },
    {
      id: 'test-registrar-card',
      title: 'Test Document for Registrar',
      type: 'Circular',
      submitter: 'Test User',
      submittedDate: new Date().toISOString().split('T')[0],
      priority: 'medium',
      description: 'Test document specifically for Registrar role',
      recipients: ['Prof. Sarah Registrar'],
      recipientIds: ['registrar-prof.-sarah-registrar'],
      isEmergency: false,
      isParallel: false,
      source: 'test'
    },
    {
      id: 'test-hod-card',
      title: 'Test Document for HOD',
      type: 'Report',
      submitter: 'Test User',
      submittedDate: new Date().toISOString().split('T')[0],
      priority: 'normal',
      description: 'Test document specifically for HOD role',
      recipients: ['Dr. CSE HOD'],
      recipientIds: ['hod-dr.-cse-hod'],
      isEmergency: false,
      isParallel: false,
      source: 'test'
    },
    {
      id: 'test-all-recipients',
      title: 'Test Document for All Recipients',
      type: 'Letter',
      submitter: 'Test User',
      submittedDate: new Date().toISOString().split('T')[0],
      priority: 'high',
      description: 'Test document for all recipients (parallel mode)',
      recipients: ['Dr. Robert Principal', 'Prof. Sarah Registrar', 'Dr. CSE HOD'],
      recipientIds: ['principal-dr.-robert-principal', 'registrar-prof.-sarah-registrar', 'hod-dr.-cse-hod'],
      isEmergency: false,
      isParallel: true,
      source: 'test'
    }
  ];

  // Get existing cards
  const existing = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
  
  // Remove any existing test cards
  const filtered = existing.filter(card => !card.id.startsWith('test-'));
  
  // Add new test cards
  const updated = [...filtered, ...testCards];
  
  // Save to localStorage
  localStorage.setItem('pending-approvals', JSON.stringify(updated));
  
  console.log('✅ Created test approval cards:', testCards.length);
  console.log('📋 Total cards in storage:', updated.length);
  
  // Trigger storage event to update UI
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'pending-approvals',
    newValue: JSON.stringify(updated)
  }));
  
  return testCards;
}

function clearTestApprovalCards() {
  const existing = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
  const filtered = existing.filter(card => !card.id.startsWith('test-'));
  localStorage.setItem('pending-approvals', JSON.stringify(filtered));
  
  console.log('🗑️ Cleared test approval cards');
  console.log('📋 Remaining cards:', filtered.length);
  
  // Trigger storage event to update UI
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'pending-approvals',
    newValue: JSON.stringify(filtered)
  }));
}

function showCurrentUser() {
  try {
    const authData = localStorage.getItem('auth-user');
    if (authData) {
      const user = JSON.parse(authData);
      console.log('👤 Current user:', user);
      return user;
    } else {
      console.log('❌ No user found in localStorage');
      return null;
    }
  } catch (e) {
    console.error('Error reading user data:', e);
    return null;
  }
}

function testRecipientMatching() {
  const user = showCurrentUser();
  if (!user) {
    console.log('❌ Cannot test without user data');
    return;
  }
  
  const cards = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
  console.log('🧪 Testing recipient matching for', cards.length, 'cards');
  
  cards.forEach(card => {
    console.log(`\n📄 Testing card: "${card.title}"`);
    console.log('  Recipients:', card.recipients);
    console.log('  Recipient IDs:', card.recipientIds);
    
    // Simple matching logic
    let shouldShow = false;
    
    if (card.recipientIds && card.recipientIds.length > 0) {
      shouldShow = card.recipientIds.some(id => {
        const idLower = id.toLowerCase();
        const userRole = (user.role || '').toLowerCase();
        const userName = (user.name || '').toLowerCase().replace(/\s+/g, '-');
        
        return idLower.includes(userRole) || idLower.includes(userName);
      });
    } else if (card.recipients && card.recipients.length > 0) {
      shouldShow = card.recipients.some(recipient => {
        const recipientLower = recipient.toLowerCase();
        const userRole = (user.role || '').toLowerCase();
        const userName = (user.name || '').toLowerCase();
        
        return recipientLower.includes(userRole) || recipientLower.includes(userName);
      });
    } else {
      shouldShow = true; // No recipients specified
    }
    
    console.log(`  Result: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
  });
}

// Export functions to global scope
window.createTestApprovalCards = createTestApprovalCards;
window.clearTestApprovalCards = clearTestApprovalCards;
window.showCurrentUser = showCurrentUser;
window.testRecipientMatching = testRecipientMatching;

console.log('🔧 Test functions loaded. Available commands:');
console.log('  createTestApprovalCards() - Create test approval cards');
console.log('  clearTestApprovalCards() - Remove test approval cards');
console.log('  showCurrentUser() - Show current logged in user');
console.log('  testRecipientMatching() - Test recipient matching logic');