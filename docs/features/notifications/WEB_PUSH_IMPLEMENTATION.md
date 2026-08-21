# Web Push Notifications

IAOMS uses the browser Web Push API with VAPID authentication. The browser creates a subscription, the backend stores the endpoint and encryption keys in `user_devices`, and the backend sends signed push payloads through the `web-push` package. The existing notification-preferences interface remains the user-facing control surface.

## Runtime flow

1. `src/main.tsx` registers `public/sw.js` at the application origin.
2. After authentication, `AuthContext` attempts silent registration only when browser permission is already granted.
3. The Push Notifications switch in `NotificationPreferences` requests permission from the user’s interaction, persists `push_enabled`, and registers or unregisters the current device.
4. `WebPushService` stores the registered endpoint under a user-scoped local-storage key. This prevents one account’s cached endpoint from suppressing registration after an account switch.
5. `POST /api/notifications/devices/register` validates an HTTPS endpoint and required encryption keys, resolves the notification email, and upserts the device by its globally unique Web Push endpoint.
6. Backend dispatch filters disabled users, sends to the user’s registered devices, and reports successful and failed delivery counts. Central user-targeted dispatch does not send a second email-targeted copy to the same user.
7. HTTP 404 and 410 responses cause stale device rows to be pruned.
8. `public/sw.js` displays notifications in the background, validates in-app click destinations, focuses or opens the application, and forwards rotated subscriptions to an open authenticated client.
9. Clearing a preferred notification email synchronizes `NULL` to device rows so stale email-targeted device records are not retained.

## Required configuration

The frontend requires only the public VAPID key:

```env
VITE_VAPID_PUBLIC_KEY=...
```

The backend requires the matching public key, the private key, and a contact subject:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:notifications@example.com
```

Generate a matching pair with `npx web-push generate-vapid-keys`. The private key must remain in the backend environment and must never be exposed to the browser or committed to Git.

## Delivery and preference rules

Push delivery is enabled by default when no preference row exists, matching the application’s existing default preferences. An explicit `push_enabled = false` is respected by every backend push path, including user-ID and email-targeted delivery. A missing or malformed subscription is rejected, while an unavailable VAPID configuration causes delivery to fail safely without attempting provider requests.

The `user_devices.fcm_token` column is a legacy name retained for database compatibility; for Web Push it stores the subscription endpoint. `push_keys` stores the `p256dh` and `auth` encryption material. The endpoint is treated as sensitive device-registration data and is not written to application logs.

## Verification

Run the following checks from the repository root:

```bash
npm run build
npm test -- --run
npm run build:backend
npm run test:backend
npm run lint
npm run lint:backend
npm audit --audit-level=high
npm audit --prefix backend --audit-level=high
```

For a browser smoke test, use a secure origin or local development origin, sign in, open the existing notification-preferences panel, enable Push Notifications, allow the browser prompt, and confirm that a `user_devices` row contains the current endpoint and both encryption keys. Trigger a notification from an approval, emergency, LiveMeet, or chat workflow, then verify the background notification and in-app click destination.

If a browser has a stale subscription, sign out and sign back in after clearing the site’s notification permission or use the existing `public/cleanup-sw.js` diagnostic helper. The service worker will also request re-registration when the browser emits `pushsubscriptionchange` while an authenticated application tab is open.
