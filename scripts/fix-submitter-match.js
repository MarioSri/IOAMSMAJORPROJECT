// Quick fix script for submitter matching issues
// Run this in browser console after submitting a document

console.log('🔧 SUBMITTER MATCHING FIX TOOL');
console.log('='.repeat(60));

// Get current user info
const userProfile = JSON.parse(localStorage.getItem('user-profile') || '{}');
const authUser = JSON.parse(localStorage.getItem('auth-user') || '{}');

console.log('\n👤 Current User Info:');
console.log('Profile Name:', userProfile.name || 'NOT SET ❌');
console.log('Profile Designation:', userProfile.designation || 'NOT SET ❌');
console.log('Auth Role:', authUser.role || 'NOT SET ❌');
console.log('Auth Name:', authUser.name || 'NOT SET ❌');

// Get submitted documents
const submittedDocs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');

console.log('\n📄 Submitted Documents:', submittedDocs.length);

if (submittedDocs.length === 0) {
  console.log('❌ No documents found. Submit a document first.');
} else {
  submittedDocs.forEach((doc, i) => {
    console.log(`\n${i + 1}. ${doc.title}`);
    console.log('   Submitted By:', doc.submittedBy);
    console.log('   Submitted By Designation:', doc.submittedByDesignation || 'NOT SET');
    
    // Check if it matches current user
    const matches = [
      doc.submittedBy === userProfile.name,
      doc.submittedBy === authUser.role,
      doc.submittedByDesignation === authUser.role,
      doc.submittedByDesignation === userProfile.designation
    ];
    
    const shouldShow = matches.some(m => m);
    console.log(`   Should Show: ${shouldShow ? '✅ YES' : '❌ NO'}`);
    
    if (!shouldShow) {
      console.log('   ⚠️ MISMATCH DETECTED!');
      console.log('   Fix: Update document to match current user');
      
      // Auto-fix option
      console.log(`   Run this to fix: fixDocument(${i})`);
    }
  });
}

// Auto-fix function
window.fixDocument = function(index) {
  const docs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
  if (docs[index]) {
    const doc = docs[index];
    
    // Update to match current user
    doc.submittedBy = userProfile.name || authUser.name || 'Current User';
    doc.submittedByDesignation = userProfile.designation || authUser.role || 'Employee';
    
    docs[index] = doc;
    localStorage.setItem('submitted-documents', JSON.stringify(docs));
    
    console.log('✅ Fixed! Reload the Track Documents page.');
    
    // Trigger update
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'submitted-documents',
      newValue: JSON.stringify(docs)
    }));
  }
};

// Fix all documents
window.fixAllDocuments = function() {
  const docs = JSON.parse(localStorage.getItem('submitted-documents') || '[]');
  const userName = userProfile.name || authUser.name || 'Current User';
  const userDesignation = userProfile.designation || authUser.role || 'Employee';
  
  docs.forEach(doc => {
    doc.submittedBy = userName;
    doc.submittedByDesignation = userDesignation;
  });
  
  localStorage.setItem('submitted-documents', JSON.stringify(docs));
  console.log(`✅ Fixed ${docs.length} documents! Reload the Track Documents page.`);
  
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'submitted-documents',
    newValue: JSON.stringify(docs)
  }));
};

console.log('\n💡 Quick Fixes:');
console.log('1. Fill out Profile → Personal Information');
console.log('2. Run: fixAllDocuments() to update all documents');
console.log('3. Reload Track Documents page');
console.log('='.repeat(60));
