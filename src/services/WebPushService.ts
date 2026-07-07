/**
 * WebPushService — replaces FCMService.
 *
 * Handles:
 *  - Requesting notification permission
 *  - Creating a Web Push subscription via the browser PushManager
 *  - Registering / unregistering that subscription with the backend
 *
 * The subscription endpoint is used as the unique device identifier.
 * It is stored locally so we can skip re-registration on the same device.
 */

import { getOrCreatePushSubscription, unsubscribeFromPush, isWebPushSupported } from '@/lib/webpush';
import { supabase } from '@/lib/supabase';

const API_BASE = '/api';
const ENDPOINT_STORAGE_KEY = 'web_push_registered_endpoint';

export class WebPushService {
  /**
   * Request browser notification permission.
   * Returns true if granted.
   */
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[WebPush] Notifications not supported in this browser.');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  /**
   * Create a Web Push subscription and register it with the backend.
   * Must be called after the user is authenticated.
   *
   * @param userId - The authenticated user's Supabase UUID (used for logging only)
   */
  static async registerToken(userId: string): Promise<void> {
    if (!isWebPushSupported()) {
      console.info('[WebPush] Push notifications not supported — skipping registration.');
      return;
    }

    try {
      const granted = await this.requestPermission();
      if (!granted) {
        console.info('[WebPush] Push notification permission not granted.');
        return;
      }

      const subscription = await getOrCreatePushSubscription();
      if (!subscription) return;

      // Skip re-registration if we've already registered this endpoint
      const stored = localStorage.getItem(ENDPOINT_STORAGE_KEY);
      if (stored === subscription.endpoint) {
        console.info('[WebPush] Subscription already registered — skipping.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[WebPush] No active session — cannot register subscription.');
        return;
      }

      const res = await fetch(`${API_BASE}/notifications/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscription,                              // { endpoint, keys: { p256dh, auth } }
          deviceType: 'web',
          email: session.user?.email ?? null,
        }),
      });

      if (res.ok) {
        // Persist AFTER confirmed success so the guard never masks failures
        localStorage.setItem(ENDPOINT_STORAGE_KEY, subscription.endpoint);
        console.info('[WebPush] Subscription registered successfully.');
      } else {
        const body = await res.text().catch(() => '');
        console.error('[WebPush] Subscription registration failed. Status:', res.status, body);
      }
    } catch (err) {
      console.error('[WebPush] registerToken error:', err);
    }
  }

  /**
   * Unsubscribe from Web Push and remove the registration from the backend.
   * Call this on sign-out.
   */
  static async unregisterToken(): Promise<void> {
    try {
      const storedEndpoint = localStorage.getItem(ENDPOINT_STORAGE_KEY);
      if (!storedEndpoint) return;

      // Unsubscribe from the browser PushManager
      await unsubscribeFromPush();

      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      // Delete from backend — endpoint is URL-encoded as the route param
      await fetch(
        `${API_BASE}/notifications/devices/${encodeURIComponent(storedEndpoint)}`,
        { method: 'DELETE', headers: { ...authHeader } }
      );

      localStorage.removeItem(ENDPOINT_STORAGE_KEY);
      console.info('[WebPush] Subscription unregistered.');
    } catch (err) {
      console.error('[WebPush] unregisterToken error:', err);
    }
  }

  /**
   * Force re-registration — clears the local cache so the next
   * registerToken() call sends the subscription to the backend unconditionally.
   * Useful from DevTools or a debug panel to unstick a failed device.
   */
  static clearRegistrationCache(): void {
    localStorage.removeItem(ENDPOINT_STORAGE_KEY);
    console.info('[WebPush] Registration cache cleared. Will re-register on next login.');
  }
}
