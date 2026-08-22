// src/services/WebAuthnService.ts
// Browser-side WebAuthn service using @simplewebauthn/browser.
// All calls go to /api/webauthn/* via the existing Vite proxy (/api → localhost:3001).
import {
  startRegistration,
  startAuthentication,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { supabase } from '@/lib/supabase';

const API_BASE = '/api/webauthn';

// ── Token cache ───────────────────────────────────────────────────────────────
// Cache the JWT access token so repeated calls to listCredentials() don't each
// pay the cost of a supabase.auth.getSession() round-trip.
// The cache is invalidated automatically on TOKEN_REFRESHED / SIGNED_OUT events.

let _cachedToken: string | null = null;

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
    _cachedToken = session?.access_token ?? null;
  } else if (event === 'SIGNED_OUT') {
    _cachedToken = null;
  }
});

// Eagerly warm the token cache from the persisted session (runs once on import).
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.access_token) _cachedToken = session.access_token;
}).catch(() => { /* non-critical */ });

async function getToken(): Promise<string> {
  // Fast-path: return the cached token if available
  if (_cachedToken) return _cachedToken;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated — please sign in first');
  _cachedToken = token;
  return token;
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function apiGet<T = unknown>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function apiDelete<T = unknown>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register a new passkey for the authenticated user.
 * If this is the user's first passkey, the response includes `backupCodes`
 * (10 plaintext codes, returned once and never again).
 */
export async function registerPasskey(deviceName?: string): Promise<{
  verified: boolean;
  backupCodes?: string[];
}> {
  const options = await apiPost<PublicKeyCredentialCreationOptionsJSON>('/register/options', {});
  const response = await startRegistration({ optionsJSON: options });
  return apiPost<{ verified: boolean; backupCodes?: string[] }>(
    '/register/verify',
    { body: response, deviceName: deviceName ?? 'My Device' },
  );
}

// ── Authentication ────────────────────────────────────────────────────────────

export type AuthPurpose = 'authentication' | 'approval' | 'document_signing';

/**
 * Authenticate with a passkey.
 * Returns { verified: true, trustLevel: 'device' | 'synced' }
 */
export async function authenticatePasskey(
  purpose: AuthPurpose = 'authentication',
  documentId?: string,
  signingTransactionId?: string,
): Promise<{ verified: boolean; trustLevel: 'device' | 'synced'; requestId?: string }> {
  const options = await apiPost<PublicKeyCredentialRequestOptionsJSON>('/login/options', {
    purpose,
    documentId,
    signingTransactionId,
  });
  const response = await startAuthentication({ optionsJSON: options });
  return apiPost<{ verified: boolean; trustLevel: 'device' | 'synced'; requestId?: string }>(
    '/login/verify',
    { body: response, purpose, documentId, signingTransactionId },
  );
}

// ── Backup Code Fallback ──────────────────────────────────────────────────────

/**
 * Verify a backup code as a fallback when biometric is unavailable.
 * Returns { verified: true, codesRemaining: number }
 */
export async function verifyBackupCode(
  code: string,
  purpose: AuthPurpose = 'authentication',
  documentId?: string,
  signingTransactionId?: string,
): Promise<{ verified: boolean; codesRemaining: number; requestId?: string }> {
  return apiPost<{ verified: boolean; codesRemaining: number; requestId?: string }>('/backup/verify', {
    code,
    purpose,
    documentId,
    signingTransactionId,
  });
}

// ── Credentials Management ───────────────────────────────────────────────────

export interface PasskeyCredential {
  id: string;
  device_name: string;
  device_type: string;
  backup_state: boolean;
  backup_eligible: boolean;
  last_used_at: string | null;
  created_at: string;
  aaguid: string | null;
}

/** List all active (non-revoked) passkeys for the authenticated user. */
export async function listCredentials(): Promise<PasskeyCredential[]> {
  return apiGet<PasskeyCredential[]>('/credentials');
}

/** Soft-revoke a passkey by its database row ID. */
export async function revokeCredential(credentialRowId: string): Promise<{ revoked: boolean }> {
  return apiDelete<{ revoked: boolean }>(`/credentials/${credentialRowId}`);
}
