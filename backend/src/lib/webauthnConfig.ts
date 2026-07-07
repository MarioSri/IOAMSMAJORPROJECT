// backend/src/lib/webauthnConfig.ts
// Fail-fast: crash on startup if env vars are wrong or formatted incorrectly.

const rpID   = process.env.WEBAUTHN_RP_ID   ?? '';
// Remove trailing slash if present to avoid strict-match failures
const origin = (process.env.WEBAUTHN_ORIGIN ?? '').replace(/\/$/, '');
const rpName = process.env.WEBAUTHN_RP_NAME ?? 'IAOMS';

if (!rpID) {
  throw new Error('[WebAuthn] WEBAUTHN_RP_ID env var is missing');
}
if (!origin) {
  throw new Error('[WebAuthn] WEBAUTHN_ORIGIN env var is missing');
}
if (rpID.includes(':')) {
  throw new Error(
    `[WebAuthn] WEBAUTHN_RP_ID must NOT include a port. Got: "${rpID}". ` +
    'Expected format: "app.iaoms.dev"'
  );
}
if (!origin.startsWith('https://')) {
  throw new Error(
    `[WebAuthn] WEBAUTHN_ORIGIN must start with "https://". Got: "${origin}". ` +
    'Expected format: "https://app.iaoms.dev"'
  );
}

export const webauthnConfig = {
  rpID,
  rpName,
  origin,
  // Export an array of valid origins for verification flexibility
  validOrigins: [origin, `${origin}/`],
};
