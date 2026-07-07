// Run this in browser console to clear old localStorage data
// This fixes the quota exceeded error

console.log('Clearing old localStorage data...');

// Clear old document data with large files
localStorage.removeItem('submitted-documents');
localStorage.removeItem('pending-approvals');
localStorage.removeItem('approval-history-new');

console.log('✅ Cleared! Refresh the page.');
