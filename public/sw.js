/**
 * IAOMS Web Push Service Worker
 *
 * Receives native Web Push events, displays notifications, focuses the app on
 * interaction, and asks an open authenticated client to persist rotated
 * subscriptions.
 */
'use strict';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizePayload(event) {
  let parsed = {};
  try {
    if (event.data) parsed = event.data.json();
  } catch {
    parsed = { body: event.data ? event.data.text() : '' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

function safeAppUrl(value) {
  try {
    const candidate = new URL(typeof value === 'string' ? value : '/dashboard', self.location.origin);
    return candidate.origin === self.location.origin
      ? candidate.href
      : new URL('/dashboard', self.location.origin).href;
  } catch {
    return new URL('/dashboard', self.location.origin).href;
  }
}

self.addEventListener('push', (event) => {
  const payload = normalizePayload(event);
  const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : {};
  const urgency = payload.urgency === 'critical' || payload.urgency === 'high'
    ? payload.urgency
    : 'normal';

  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: typeof payload.icon === 'string' ? payload.icon : '/favicon.ico',
    badge: typeof payload.badge === 'string' ? payload.badge : '/security-logo-transparent.png',
    data: { ...data, url: safeAppUrl(data.url) },
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    requireInteraction: urgency === 'critical',
    vibrate: urgency === 'critical' ? [200, 100, 200, 100, 400] : urgency === 'high' ? [100, 50, 100] : [50],
    actions: [{ action: 'open', title: 'Open IAOMS', icon: '/favicon.ico' }],
    tag: data.type === 'chat' ? `chat-${data.threadId || 'general'}` : `iaoms-${data.type || 'notification'}`,
    renotify: data.type === 'chat',
  };

  event.waitUntil(self.registration.showNotification(
    typeof payload.title === 'string' && payload.title ? payload.title : 'IAOMS',
    options
  ));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeAppUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          const navigation = client.url !== targetUrl && 'navigate' in client
            ? client.navigate(targetUrl)
            : Promise.resolve(client);
          return navigation.then(() => client.focus());
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  const oldOptions = event.oldSubscription?.options;
  if (!oldOptions) return;

  event.waitUntil(
    self.registration.pushManager.subscribe(oldOptions)
      .then((newSubscription) => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          const message = {
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: newSubscription.toJSON(),
          };
          clientList.forEach((client) => client.postMessage(message));
        }))
      .catch((error) => {
        console.warn('[SW] Subscription rotation could not be re-created:', error);
      })
  );
});
