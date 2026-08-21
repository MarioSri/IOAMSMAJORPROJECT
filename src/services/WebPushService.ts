import { getOrCreatePushSubscription, unsubscribeFromPush, isWebPushSupported, type PushSubscriptionData } from '@/lib/webpush';
import { supabase } from '@/lib/supabase';

const API_BASE = '/api';
const ENDPOINT_STORAGE_PREFIX = 'web_push_registered_endpoint:';

function storageKey(userId: string): string {
  return `${ENDPOINT_STORAGE_PREFIX}${userId}`;
}

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function isPushEnabledForUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('push_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  // Missing preference rows use the application default (enabled). A query
  // failure should not silently disable an already-granted subscription.
  return error || data?.push_enabled === undefined ? true : data.push_enabled !== false;
}

export class WebPushService {
  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch (error) {
      console.warn('[WebPush] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Register the current browser subscription for an authenticated user.
   * Permission prompts are intentionally opt-in so authentication does not
   * trigger a browser prompt outside a user gesture. Already-granted users
   * still register automatically after sign-in.
   */
  static async registerToken(
    userId: string,
    options: { requestPermission?: boolean } = {}
  ): Promise<boolean> {
    if (!userId || !isWebPushSupported()) return false;

    try {
      if (!await isPushEnabledForUser(userId)) return false;

      const permissionGranted = Notification.permission === 'granted' || (
        options.requestPermission === true && await this.requestPermission()
      );
      if (!permissionGranted) return false;

      const subscription = await getOrCreatePushSubscription();
      if (!subscription) return false;

      const storedEndpoint = localStorage.getItem(storageKey(userId));
      if (storedEndpoint === subscription.endpoint) return true;

      const token = await getAccessToken();
      if (!token) return false;

      const res = await fetch(`${API_BASE}/notifications/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscription,
          deviceType: 'web',
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[WebPush] Subscription registration failed:', res.status, body);
        return false;
      }

      localStorage.setItem(storageKey(userId), subscription.endpoint);
      return true;
    } catch (error) {
      console.error('[WebPush] registerToken error:', error);
      return false;
    }
  }

  /** Re-register a subscription received from the service worker. */
  static async registerSubscription(userId: string, subscription: PushSubscriptionData): Promise<boolean> {
    if (!userId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return false;
    }

    try {
      if (!await isPushEnabledForUser(userId)) return false;

      const token = await getAccessToken();
      if (!token) return false;

      const res = await fetch(`${API_BASE}/notifications/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription, deviceType: 'web' }),
      });
      if (!res.ok) return false;

      localStorage.setItem(storageKey(userId), subscription.endpoint);
      return true;
    } catch (error) {
      console.error('[WebPush] Rotated subscription registration failed:', error);
      return false;
    }
  }

  /**
   * Remove the browser subscription and the authenticated user's device row.
   * The server delete is scoped by user ID, so an account switch cannot remove
   * another account's device registration.
   */
  static async unregisterToken(userId?: string): Promise<void> {
    if (!userId) return;

    const key = storageKey(userId);
    const storedEndpoint = localStorage.getItem(key);

    try {
      const browserEndpoint = await unsubscribeFromPush();
      const endpoint = browserEndpoint || storedEndpoint;
      const token = await getAccessToken();

      if (endpoint && token) {
        await fetch(`${API_BASE}/notifications/devices/${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error('[WebPush] unregisterToken error:', error);
    } finally {
      localStorage.removeItem(key);
    }
  }

  static clearRegistrationCache(userId?: string): void {
    if (userId) {
      localStorage.removeItem(storageKey(userId));
      return;
    }

    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(ENDPOINT_STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  }
}
