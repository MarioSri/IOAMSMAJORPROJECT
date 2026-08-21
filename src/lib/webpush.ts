/**
 * Native Web Push API helpers.
 *
 * The browser owns the subscription; the backend stores the serialized
 * endpoint and encryption keys. No third-party client SDK is required.
 */

const API_BASE = '/api';
const VAPID_PUBLIC_KEY_FROM_ENV = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const normalized = base64String.trim();
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  if (VAPID_PUBLIC_KEY_FROM_ENV?.trim()) {
    return VAPID_PUBLIC_KEY_FROM_ENV.trim();
  }

  try {
    const res = await fetch(`${API_BASE}/notifications/vapid-public-key`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const json = await res.json() as { vapidPublicKey?: unknown };
    return typeof json.vapidPublicKey === 'string' && json.vapidPublicKey.trim()
      ? json.vapidPublicKey.trim()
      : null;
  } catch {
    return null;
  }
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getOrCreatePushSubscription(): Promise<PushSubscriptionData | null> {
  if (!isWebPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidKey = await fetchVapidPublicKey();
    if (!vapidKey) return null;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = subscription.toJSON() as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    };
    if (
      typeof json.endpoint !== 'string' ||
      !json.endpoint ||
      typeof json.keys?.p256dh !== 'string' ||
      typeof json.keys.auth !== 'string' ||
      !json.keys.p256dh ||
      !json.keys.auth
    ) {
      return null;
    }

    return {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    };
  } catch (error) {
    console.error('[WebPush] Failed to create push subscription:', error);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isWebPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    return endpoint;
  } catch (error) {
    console.error('[WebPush] Failed to unsubscribe:', error);
    return null;
  }
}
