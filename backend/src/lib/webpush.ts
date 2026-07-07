import webpush from 'web-push';

let _configured = false;

/**
 * Lazily configure web-push with VAPID keys from env vars.
 * Called once on first use.
 */
function configure(): void {
  if (_configured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@iaoms.dev';

  if (!publicKey || !privateKey) {
    console.warn(
      '[WebPush] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled.'
    );
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  _configured = true;
}

export function isWebPushConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return !!(publicKey && privateKey);
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification to a single Web Push subscription.
 * Returns true on success, false if the subscription is stale/invalid.
 */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: string
): Promise<{ success: boolean; stale: boolean }> {
  configure();

  if (!_configured) {
    return { success: false, stale: false };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      payload,
      {
        TTL: 60 * 60 * 24, // 24-hour message TTL
        urgency: 'normal',
      }
    );
    return { success: true, stale: false };
  } catch (err: any) {
    // 410 Gone / 404 Not Found = subscription expired or revoked
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return { success: false, stale: true };
    }
    console.error('[WebPush] sendNotification error:', err?.message ?? err);
    return { success: false, stale: false };
  }
}
