/**
 * IAOMS Web Push Service Worker
 *
 * Handles background push notifications using the standard Web Push API.
 * No Firebase dependencies — works natively in Chrome, Edge, Firefox, and Safari 16.4+.
 *
 * Place this file at /public/sw.js  →  served at /sw.js
 */

'use strict';

// ── Install / Activate ───────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Take control immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all open clients so push events are received straight away
  event.waitUntil(self.clients.claim());
});

// ── Push Event ────────────────────────────────────────────────────────────────
// Fired when the backend sends a Web Push notification via the Push API.

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    payload = {
      title: 'IAOMS Notification',
      body: event.data ? event.data.text() : '',
      urgency: 'normal'
    };
  }

  const title = payload.title || 'IAOMS';
  const urgency = payload.urgency || 'normal';

  // Premium visual configuration
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/security-logo-transparent.png',
    data: payload.data || {},
    timestamp: payload.data?.timestamp || Date.now(),
    
    // Critical alerts require explicit interaction
    requireInteraction: urgency === 'critical',
    
    // Custom vibration patterns based on urgency
    vibrate: urgency === 'critical' ? [200, 100, 200, 100, 400] :
             urgency === 'high'     ? [100, 50, 100] :
                                      [50],

    // IAOMS Branding: Show 'iaoms.dev' context in browsers that support it
    actions: [
      { action: 'open', title: 'Open IAOMS', icon: '/favicon.ico' }
    ],

    // Collapse duplicate notifications (e.g. chat) under the same tag
    tag: payload.data?.type === 'chat' ? `chat-${payload.data?.threadId || 'general'}` : `iaoms-${Date.now()}`,
    renotify: payload.data?.type === 'chat',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ────────────────────────────────────────────────────────
// Opens / focuses the app and navigates to the action URL embedded in the notification.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle 'open' action or general click
  const actionUrl = event.notification.data?.url || '/dashboard';
  const targetUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Look for an existing app window/tab
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            // If already on the target page, just focus; otherwise navigate
            if (client.url !== targetUrl) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});


// ── Push Subscription Change ──────────────────────────────────────────────────
// Some browsers (e.g. Firefox) may silently rotate push subscriptions.
// Re-register the new subscription with the backend so delivery continues.

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSubscription) => {
        // Notify the open app client to re-register with the backend
        return self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            const payload = JSON.stringify({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: newSubscription.toJSON(),
            });
            clientList.forEach((client) => client.postMessage(payload));
          });
      })
  );
});
