/**
 * Web Push API helper (replaces Firebase Messaging on the client side).
 *
 * Uses the browser's native PushManager API — no third-party SDK required.
 * Works in Chrome, Edge, Firefox, and Safari 16.4+.
 * 
 * BULLETPROOF DESIGN:
 * 1. Uses environment variable VAPID key (no backend dependency)
 * 2. Falls back to backend API if env var is missing
 * 3. Gracefully disables if both fail
 */

const API_BASE = '/api';

// VAPID public key from environment variable (ALWAYS AVAILABLE)
const VAPID_PUBLIC_KEY_FROM_ENV = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Convert a URL-safe base64 string to a Uint8Array.
 * Required to pass the VAPID public key to pushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch the VAPID public key with multiple fallback layers:
 * 1. Environment variable (instant, no network call)
 * 2. Backend API (requires backend to be running)
 * 3. Returns null if both fail (Web Push disabled gracefully)
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  // Layer 1: Use environment variable (BEST - no backend dependency)
  if (VAPID_PUBLIC_KEY_FROM_ENV) {
    console.info('[WebPush] Using VAPID key from environment variable');
    return VAPID_PUBLIC_KEY_FROM_ENV;
  }

  // Layer 2: Fallback to backend API
  try {
    const res = await fetch(`${API_BASE}/notifications/vapid-public-key`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!res.ok) {
      console.debug(`[WebPush] Backend VAPID endpoint returned ${res.status}`);
      return null;
    }
    
    const json = await res.json();
    if (json.vapidPublicKey) {
      console.info('[WebPush] Using VAPID key from backend API');
      return json.vapidPublicKey;
    }
    
    return null;
  } catch (err) {
    console.debug('[WebPush] Backend not available, Web Push disabled');
    return null;
  }
}

/**
 * Check if the browser supports Web Push notifications.
 */
export function isWebPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get or create a Web Push subscription for the current browser.
 *
 * Steps:
 * 1. Wait for the service worker to be ready.
 * 2. Fetch the VAPID public key (env var or backend).
 * 3. Subscribe via pushManager.subscribe().
 * 4. Return the serialised subscription, or null on failure.
 */
export async function getOrCreatePushSubscription(): Promise<PushSubscriptionData | null> {
  if (!isWebPushSupported()) {
    console.debug('[WebPush] Push notifications not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const vapidKey = await fetchVapidPublicKey();
    if (!vapidKey) {
      console.debug('[WebPush] VAPID key unavailable — Web Push disabled');
      return null;
    }

    // Check for an existing active subscription first
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      console.info('[WebPush] New push subscription created');
    } else {
      console.info('[WebPush] Using existing push subscription');
    }

    // Serialize subscription to a plain object
    const json = subscription.toJSON() as {
      endpoint: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error('[WebPush] Subscription missing required keys');
      return null;
    }

    return {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh!,
        auth: json.keys.auth!,
      },
    };
  } catch (err) {
    console.error('[WebPush] Failed to create push subscription:', err);
    return null;
  }
}

/**
 * Unsubscribe the current browser from Web Push.
 * Returns the endpoint that was unsubscribed (for server-side cleanup).
 */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    console.info('[WebPush] Push subscription removed');
    return endpoint;
  } catch (err) {
    console.error('[WebPush] Failed to unsubscribe:', err);
    return null;
  }
}
