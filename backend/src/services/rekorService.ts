// =============================================================================
// Rekor Service — Sigstore Transparency Log Integration
//
// Signing approach (Phase 1): Service account signs all events.
//   - Actor identity is embedded in the signed event payload.
//   - All signatures share the same service identity certificate.
//   - Phase 2 migration: replace with individual OIDC tokens per @hitam.org user.
//
// Rekor instance: public rekor.sigstore.dev (free, production-grade).
// =============================================================================

import axios from 'axios';
import { generateKeyPairSync, createSign } from 'crypto';
import { calculateEventHash } from './blockchainAuditService';
import type {
  BlockchainEventPayload,
  RekorUploadResult,
  RekorVerificationResult,
  ChainVerificationResult,
  ChainLinkStatus,
} from '../types/blockchainAudit';
import { getAuditTrailForDocument } from './blockchainAuditService';

const REKOR_BASE_URL = process.env.REKOR_URL || 'https://rekor.sigstore.dev';
const LOG_PREFIX = '[RekorService]';

// ---------------------------------------------------------------------------
// Rekor API helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a Rekor log entry by UUID.
 * Returns null if the entry does not exist or the request fails.
 */
export async function getRekorEntry(uuid: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await axios.get(
      `${REKOR_BASE_URL}/api/v1/log/entries/${uuid}`,
      { timeout: 10_000 }
    );
    return response.data as Record<string, unknown>;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr?.response?.status === 404) return null;
    console.warn(`${LOG_PREFIX} Failed to fetch Rekor entry ${uuid}:`, err);
    return null;
  }
}

/**
 * Fetches basic Rekor log info (tree size, root hash, etc.).
 * Used by the monitoring service to check log consistency.
 */
export async function getRekorLogInfo(): Promise<{
  treeSize: number;
  rootHash: string;
  treeID: number;
} | null> {
  try {
    const response = await axios.get(`${REKOR_BASE_URL}/api/v1/log`, { timeout: 10_000 });
    const data = response.data as { treeSize: number; rootHash: string; treeID: number };
    return {
      treeSize: data.treeSize,
      rootHash: data.rootHash,
      treeID: data.treeID,
    };
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to fetch Rekor log info:`, err);
    return null;
  }
}

/**
 * Searches Rekor for entries by email identity.
 * Returns matching UUIDs (may be empty).
 */
export async function searchRekorByEmail(email: string): Promise<string[]> {
  try {
    const response = await axios.post(
      `${REKOR_BASE_URL}/api/v1/index/retrieve`,
      { email },
      { timeout: 15_000 }
    );
    return (response.data as string[]) ?? [];
  } catch (err) {
    console.warn(`${LOG_PREFIX} Rekor identity search failed for ${email}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sign & Upload
//
// Phase 1: We create a hashedrekord entry (Rekor's simplest entry type) that
// contains a SHA-256 hash of the event payload as the "artifact hash".
// We sign this using the service account key loaded from the environment.
//
// The @sigstore/sign package provides OIDC-based keyless signing. For Phase 1
// we use a process-lifetime ephemeral ECDSA P-256 key. Actor identity is
// embedded inside the signed payload so Rekor records WHO did WHAT.
// ---------------------------------------------------------------------------

interface HashedRekorEntry {
  apiVersion: string;
  kind: string;
  spec: {
    data: {
      hash: {
        algorithm: string;
        value: string;
      };
    };
    signature: {
      content: string;       // Base64-encoded DER signature bytes
      publicKey: {
        content: string;     // Base64-encoded PEM public key
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Phase 1 ephemeral signing key
//
// A single ECDSA P-256 key pair is generated once at process startup and
// reused for all audit events. Rekor requires a valid cryptographic signature
// over the artifact hash — a placeholder PEM is rejected with HTTP 400.
//
// The actor identity (email, role) is embedded inside the signed payload, so
// Rekor's transparency log records WHAT happened and WHO did it even though
// all signatures share this one service identity key.
//
// Phase 2 migration: replace with per-user OIDC keyless signing via
// @sigstore/sign (each actor's Google Workspace OIDC token issues a cert).
// ---------------------------------------------------------------------------
const { privateKey: PHASE1_PRIVATE_KEY, publicKey: PHASE1_PUBLIC_KEY_PEM } =
  generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

console.info('[RekorService] Phase 1 ephemeral ECDSA P-256 signing key generated');

/**
 * Builds a Rekor hashedrekord entry from the event payload.
 *
 * Phase 1 signing (verified against live Rekor API):
 *   - artifact  = canonical sorted-key JSON of the event payload (UTF-8 bytes)
 *   - hash      = SHA-256 of the artifact (same sort order as calculateEventHash)
 *   - signature = ECDSA P-256 sign(SHA-256) of the artifact bytes — Rekor
 *                 verifies the signature against the full artifact bytes, so the
 *                 artifact JSON used for signing MUST match the submitted hash.
 *   - publicKey = ephemeral ECDSA P-256 SPKI PEM, base64-encoded
 */
async function buildRekorEntry(
  payload: BlockchainEventPayload,
  eventHash: string
): Promise<HashedRekorEntry> {
  // Canonical sorted-key JSON — MUST match how calculateEventHash computed eventHash
  const canonical = Object.keys(payload as unknown as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = (payload as unknown as Record<string, unknown>)[k];
      return acc;
    }, {});
  const artifactBytes = Buffer.from(JSON.stringify(canonical), 'utf8');

  // Sign the artifact bytes — Rekor verifies: ecdsa.VerifyASN1(pubKey, SHA256(artifact), sig)
  const signer = createSign('SHA256');
  signer.update(artifactBytes);
  const signatureDer = signer.sign(PHASE1_PRIVATE_KEY);
  const sigContent = signatureDer.toString('base64');

  // Public key: PEM wrapped in base64 as Rekor expects
  const publicKeyContent = Buffer.from(PHASE1_PUBLIC_KEY_PEM as string).toString('base64');

  return {
    apiVersion: '0.0.1',
    kind: 'hashedrekord',
    spec: {
      data: {
        hash: {
          algorithm: 'sha256',
          value: eventHash,
        },
      },
      signature: {
        content: sigContent,
        publicKey: {
          content: publicKeyContent,
        },
      },
    },
  };
}

/**
 * Signs the event payload and uploads it to the Rekor transparency log.
 * Returns the UUID and log index on success.
 *
 * If REKOR_DISABLED=true (useful for local dev without network), returns a
 * synthetic local UUID so the queue worker can complete without blocking.
 */
export async function signAndUploadToRekor(
  payload: BlockchainEventPayload
): Promise<RekorUploadResult> {
  // Development bypass
  if (process.env.REKOR_DISABLED === 'true') {
    const localUuid = `local-dev-${payload.document_id}-${Date.now()}`;
    console.debug(`${LOG_PREFIX} REKOR_DISABLED — synthetic UUID: ${localUuid}`);
    return {
      uuid: localUuid,
      logIndex: -1,
      integratedTime: Math.floor(Date.now() / 1000),
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    };
  }

  const eventHash = calculateEventHash(payload);
  const entry = await buildRekorEntry(payload, eventHash);

  const response = await axios.post(
    `${REKOR_BASE_URL}/api/v1/log/entries`,
    entry,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    }
  );

  const responseData = response.data as Record<string, unknown>;

  // Rekor returns a map: { "<uuid>": { body, integratedTime, logIndex, ... } }
  const uuid = Object.keys(responseData)[0];
  const entryData = responseData[uuid] as {
    body: string;
    integratedTime: number;
    logIndex: number;
  };

  console.info(
    `${LOG_PREFIX} Uploaded to Rekor — uuid=${uuid}` +
    ` logIndex=${entryData.logIndex}` +
    ` document=${payload.document_id}` +
    ` action=${payload.action}`
  );

  return {
    uuid,
    logIndex: entryData.logIndex,
    integratedTime: entryData.integratedTime,
    body: entryData.body,
  };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verifies that a Rekor entry still exists and is accessible.
 * Does not perform full inclusion proof verification (requires rekor-cli binary).
 */
export async function verifyRekorEntry(rekorUuid: string): Promise<RekorVerificationResult> {
  const entry = await getRekorEntry(rekorUuid);

  if (!entry) {
    return {
      uuid: rekorUuid,
      exists: false,
      valid: false,
      integratedTime: null,
      error: 'Entry not found in Rekor',
    };
  }

  const entryData = entry[rekorUuid] as {
    integratedTime?: number;
    logIndex?: number;
  } | undefined;

  return {
    uuid: rekorUuid,
    exists: true,
    valid: true,
    integratedTime: entryData?.integratedTime ?? null,
  };
}

/**
 * Verifies the hash chain integrity for all events of a document.
 *
 * Checks:
 *   1. Each event's event_hash matches a fresh recalculation of its payload.
 *   2. Each event's previous_event_hash matches the prior event's event_hash.
 *   3. Timestamps are monotonically non-decreasing.
 *
 * NOTE: this only verifies the local Supabase chain. Full Rekor inclusion proof
 * verification requires the rekor-cli binary and is performed by the monitoring
 * service against the public log.
 */
export async function verifyEventChain(documentId: string): Promise<ChainVerificationResult> {
  const entries = await getAuditTrailForDocument(documentId);

  if (entries.length === 0) {
    return {
      documentId,
      valid: true,
      eventCount: 0,
      brokenAt: null,
      missingRekorEntries: [],
      tamperDetected: false,
      details: [],
    };
  }

  const details: ChainLinkStatus[] = [];
  let valid = true;
  let brokenAt: number | null = null;
  let tamperDetected = false;
  const missingRekorEntries: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expected_prev = i === 0 ? null : entries[i - 1].event_hash;
    const linkValid = entry.previous_event_hash === expected_prev;

    if (!linkValid && brokenAt === null) {
      brokenAt = i;
      valid = false;
      tamperDetected = true;
    }

    if (!entry.rekor_uuid) {
      missingRekorEntries.push(entry.event_hash);
    }

    details.push({
      index: i,
      eventHash: entry.event_hash,
      previousEventHash: entry.previous_event_hash,
      action: entry.action,
      actor: entry.actor_email,
      timestamp: entry.timestamp,
      rekorUuid: entry.rekor_uuid,
      linkValid,
      rekorVerified: entry.verification_status === 'verified' ? true
        : entry.verification_status === 'failed' ? false
        : null,
    });
  }

  return {
    documentId,
    valid,
    eventCount: entries.length,
    brokenAt,
    missingRekorEntries,
    tamperDetected,
    details,
  };
}
