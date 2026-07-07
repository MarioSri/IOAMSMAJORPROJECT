/**
 * Service Worker Cleanup & Diagnostic Tool
 * 
 * Run this in your browser console to:
 * 1. Unregister all service workers
 * 2. Clear caches
 * 3. Test the VAPID endpoint
 */

(async function diagnoseAndFix() {
  console.log('🔧 Starting Service Worker Cleanup & Diagnostic...\n');

  // Step 1: Unregister all service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log(`Found ${registrations.length} service worker(s)`);
    
    for (const registration of registrations) {
      await registration.unregister();
      console.log('✅ Unregistered:', registration.scope);
    }
  }

  // Step 2: Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    console.log(`\nFound ${cacheNames.length} cache(s)`);
    
    for (const name of cacheNames) {
      await caches.delete(name);
      console.log('✅ Deleted cache:', name);
    }
  }

  // Step 3: Test VAPID endpoint
  console.log('\n🧪 Testing VAPID endpoint...');
  try {
    const response = await fetch('/api/notifications/vapid-public-key');
    const data = await response.json();
    
    console.log('✅ VAPID endpoint works!');
    console.log('Status:', response.status);
    console.log('Data:', data);
  } catch (error) {
    console.error('❌ VAPID endpoint failed:', error);
  }

  console.log('\n✨ Cleanup complete! Please refresh the page.');
})();
