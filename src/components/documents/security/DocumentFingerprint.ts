/**
 * DocumentFingerprint — SHA-256 integrity layer
 * Uses the Web Crypto API (built-in browser, zero external dependencies).
 *
 * Architecture inspired by tamper-detection patterns in enterprise e-signature platforms.
 */

/**
 * Compute SHA-256 hex digest of a File's bytes.
 */
export async function hashDocument(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a file against a previously stored SHA-256 hash.
 * Returns true if file is untampered.
 */
export async function verifyDocumentIntegrity(
  file: File,
  storedHash: string,
): Promise<boolean> {
  const currentHash = await hashDocument(file);
  return currentHash === storedHash;
}

/**
 * Generate a human-readable document fingerprint summary.
 */
export interface DocumentFingerprint {
  hash: string;
  size: number;
  name: string;
  type: string;
  lastModified: number;
  computedAt: string;
}

export async function generateFingerprint(file: File): Promise<DocumentFingerprint> {
  const hash = await hashDocument(file);
  return {
    hash,
    size: file.size,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    computedAt: new Date().toISOString(),
  };
}
