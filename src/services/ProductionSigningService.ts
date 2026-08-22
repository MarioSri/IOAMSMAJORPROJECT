import { supabase } from '@/lib/supabase';
import type { SignatureMetadata } from '@/components/documents/signature/useSignatureEngine';
import type { SignedFile } from '@/components/documents/rendering/SignatureMerger';

export interface SigningIntent {
  transactionId: string;
  documentVersion: number;
  expiresAt: string;
}

export interface CompletedSigning {
  documentId: string;
  transactionId: string;
  signedArtifactHash: string;
  signatureCount: number;
  signedFileCount: number;
  completedAt: string;
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
  return session.access_token;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; data?: T };
  if (!response.ok) throw new Error(payload.error ?? `Signing request failed (${response.status})`);
  return (payload.data ?? payload) as T;
}

function signedFileToBlob(file: SignedFile): Blob {
  const separator = file.data.indexOf(',');
  if (separator < 0) throw new Error(`Signed file ${file.name} is not a valid data URL`);
  const metadata = file.data.slice(0, separator);
  const encoded = file.data.slice(separator + 1);
  const mimeMatch = metadata.match(/^data:([^;]+);base64$/i);
  const mimeType = mimeMatch?.[1] ?? file.type ?? 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export async function createSigningIntent(documentId: string): Promise<SigningIntent> {
  return postJson<SigningIntent>('/api/signing/intents', { documentId });
}

export async function recordSigningAuthProof(input: {
  transactionId: string;
  documentId: string;
  requestId: string;
  authMethod: 'passkey' | 'backup_code';
}): Promise<void> {
  await postJson('/api/signing/auth-proof', input);
}

export async function completeProtectedSigning(input: {
  documentId: string;
  transactionId: string;
  requestId: string;
  signatures: SignatureMetadata[];
  signedFiles: SignedFile[];
}): Promise<CompletedSigning> {
  if (input.signedFiles.length === 0) throw new Error('No signed artifacts were produced.');
  const token = await getAccessToken();
  const form = new FormData();
  form.append('documentId', input.documentId);
  form.append('transactionId', input.transactionId);
  form.append('requestId', input.requestId);
  form.append('signatures', JSON.stringify(input.signatures));

  input.signedFiles.forEach((file) => {
    form.append('signedFiles', signedFileToBlob(file), file.name);
  });

  const response = await fetch('/api/signing/complete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; data?: CompletedSigning };
  if (!response.ok || !payload.data) throw new Error(payload.error ?? `Signing completion failed (${response.status})`);
  return payload.data;
}
