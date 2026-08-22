import { createHash, randomUUID } from 'crypto';
import type { Express } from 'express';
import { supabaseAdmin } from '../config/supabase';
import type { User } from '../types';

const BUCKET_NAME = 'BCXN';
const MAX_SIGNED_FILES = 10;
const MAX_SIGNED_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SIGNATURES = 100;
const MAX_SIGNATURE_IMAGE_CHARS = 2_000_000;
const SIGNING_INTENT_TTL_MS = 10 * 60 * 1000;

const ALLOWED_SIGNED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

export interface SigningDocument {
  id: string;
  submitter_id: string | null;
  recipient_ids: string[] | null;
  recipients: string[] | null;
  status: string | null;
  workflow_state: string | null;
  signing_version: number | null;
  files: unknown;
  signature_metadata: unknown;
  signed_file_urls: unknown;
  signed_by: string[] | null;
}

export interface NormalizedSignature {
  id: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  rotation: number;
  data: string;
  docWidth?: number;
  docHeight?: number;
  pageNumber: number;
  fileIndex: number;
  signedBy: string;
  signedAt: string;
  location: {
    fileIndex: number;
    pageNumber: number;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
}

export interface SignedUploadResult {
  name: string;
  type: string;
  size: number;
  storage_path: string;
  storage_url: string;
}

export interface SigningIntentResult {
  transactionId: string;
  documentVersion: number;
  expiresAt: string;
}

export interface CompleteSigningResult {
  documentId: string;
  transactionId: string;
  signedArtifactHash: string;
  signatureCount: number;
  signedFileCount: number;
  completedAt: string;
}

export function createArtifactHash(files: Array<{ name: string; mimetype: string; buffer: Buffer }>): string {
  const hash = createHash('sha256');
  files.forEach((file, index) => {
    hash.update(`${index}\0${file.name}\0${file.mimetype}\0${file.buffer.length}\0`);
    hash.update(file.buffer);
  });
  return hash.digest('hex');
}

async function loadOriginalFileBytes(document: SigningDocument): Promise<Array<{ name: string; mimetype: string; buffer: Buffer }>> {
  const fileEntries = asArray<Record<string, unknown>>(document.files);
  const loaded: Array<{ name: string; mimetype: string; buffer: Buffer }> = [];

  for (const entry of fileEntries) {
    const name = typeof entry.file_name === 'string'
      ? entry.file_name
      : typeof entry.name === 'string' ? entry.name : 'document';
    const mimetype = typeof entry.file_type === 'string'
      ? entry.file_type
      : typeof entry.type === 'string' ? entry.type : 'application/octet-stream';
    const storagePath = typeof entry.storage_path === 'string' ? entry.storage_path : '';
    const base64Data = typeof entry.data === 'string' ? entry.data : '';

    try {
      if (storagePath) {
        const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(storagePath);
        if (!error && data) loaded.push({ name, mimetype, buffer: Buffer.from(await data.arrayBuffer()) });
      } else if (base64Data.startsWith('data:')) {
        const separator = base64Data.indexOf(',');
        if (separator > 0) loaded.push({ name, mimetype, buffer: Buffer.from(base64Data.slice(separator + 1), 'base64') });
      }
    } catch {
      // Missing legacy source bytes do not invalidate the signed artifact hash.
    }
  }

  return loaded;
}

function finiteNormalizedCoordinate(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be a finite normalized number between 0 and 1`);
  }
  return value;
}

function positiveInteger(value: unknown, field: string, fallback = 1): number {
  const result = value === undefined || value === null ? fallback : value;
  if (typeof result !== 'number' || !Number.isInteger(result) || result < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return result;
}

function nonNegativeInteger(value: unknown, field: string, fallback = 0): number {
  const result = value === undefined || value === null ? fallback : value;
  if (typeof result !== 'number' || !Number.isInteger(result) || result < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return result;
}

function normalizedRotation(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

export function normalizeSignatureMetadata(input: unknown, fallbackSigner: string): NormalizedSignature[] {
  if (!Array.isArray(input)) throw new Error('signatures must be an array');
  if (input.length === 0) throw new Error('At least one signature is required');
  if (input.length > MAX_SIGNATURES) throw new Error(`A document may contain at most ${MAX_SIGNATURES} signatures`);

  const ids = new Set<string>();
  return input.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Signature ${index + 1} is invalid`);
    const value = raw as Record<string, unknown>;
    const id = typeof value.id === 'string' && value.id.length <= 128 ? value.id : '';
    if (!id || ids.has(id)) throw new Error(`Signature ${index + 1} has a missing or duplicate id`);
    ids.add(id);

    const data = typeof value.data === 'string' ? value.data : '';
    if (!data || data.length > MAX_SIGNATURE_IMAGE_CHARS) {
      throw new Error(`Signature ${index + 1} image data is missing or too large`);
    }

    const fileIndex = nonNegativeInteger(value.fileIndex, `Signature ${index + 1} fileIndex`);
    const pageNumber = positiveInteger(value.pageNumber, `Signature ${index + 1} pageNumber`);
    const xPercent = finiteNormalizedCoordinate(value.xPercent, `Signature ${index + 1} xPercent`);
    const yPercent = finiteNormalizedCoordinate(value.yPercent, `Signature ${index + 1} yPercent`);
    const widthPercent = finiteNormalizedCoordinate(value.widthPercent, `Signature ${index + 1} widthPercent`);
    const heightPercent = finiteNormalizedCoordinate(value.heightPercent, `Signature ${index + 1} heightPercent`);

    if (widthPercent <= 0 || heightPercent <= 0 || xPercent + widthPercent > 1.000001 || yPercent + heightPercent > 1.000001) {
      throw new Error(`Signature ${index + 1} must remain inside its document surface`);
    }

    const signedAt = typeof value.signedAt === 'string' && !Number.isNaN(Date.parse(value.signedAt))
      ? value.signedAt
      : new Date().toISOString();

    return {
      id,
      xPercent,
      yPercent,
      widthPercent,
      heightPercent,
      rotation: normalizedRotation(value.rotation),
      data,
      docWidth: typeof value.docWidth === 'number' ? value.docWidth : undefined,
      docHeight: typeof value.docHeight === 'number' ? value.docHeight : undefined,
      pageNumber,
      fileIndex,
      signedBy: fallbackSigner,
      signedAt,
      location: { fileIndex, pageNumber, xPercent, yPercent, widthPercent, heightPercent },
    };
  });
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180);
  return base || 'signed-document';
}

export function publicSigningFileUrl(documentId: string, storagePath: string): string {
  return `/api/signing/files/${encodeURIComponent(documentId)}?path=${encodeURIComponent(storagePath)}`;
}

export async function getSigningDocument(
  documentId: string,
  user: User,
  options: { requireActiveSigner?: boolean } = {},
): Promise<SigningDocument> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, submitter_id, recipient_ids, recipients, status, workflow_state, signing_version, files, signature_metadata, signed_file_urls, signed_by')
    .eq('id', documentId)
    .single();

  if (error || !data) throw Object.assign(new Error('Document not found'), { status: 404 });

  const document = data as SigningDocument;
  const userId = user.id.toLowerCase();
  const email = user.email.toLowerCase();
  const submitter = String(document.submitter_id ?? '').toLowerCase();
  const recipientIds = asArray<string>(document.recipient_ids).map(String).map((item) => item.toLowerCase());
  const recipientEmails = asArray<string>(document.recipients).map(String).map((item) => item.toLowerCase());

  const isSubmitter = submitter === userId || submitter === email;
  const isAdmin = user.role === 'admin' || Boolean((await supabaseAdmin
    .from('role_recipients')
    .select('id')
    .eq('supabase_uid', user.id)
    .ilike('role', 'admin')
    .eq('is_active', true)
    .maybeSingle()).data);
  const roleRecipient = (await supabaseAdmin
    .from('role_recipients')
    .select('id')
    .eq('supabase_uid', user.id)
    .eq('is_active', true)
    .maybeSingle()).data;
  const roleRecipientId = roleRecipient ? String(roleRecipient.id).toLowerCase() : '';
  const identityCandidates = new Set([userId, email, roleRecipientId].filter(Boolean));
  let participant = isSubmitter || isAdmin || recipientIds.some((id) => identityCandidates.has(id)) || recipientEmails.includes(email);

  if (options.requireActiveSigner !== false && participant && !isSubmitter && !isAdmin) {
    const { data: workflow } = await supabaseAdmin
      .from('document_workflows')
      .select('id, routing_type, is_parallel')
      .eq('document_id', documentId)
      .limit(1)
      .maybeSingle();

    if (workflow) {
      const { data: steps } = await supabaseAdmin
        .from('workflow_steps')
        .select('assignee_id, status, step_order')
        .eq('workflow_id', workflow.id)
        .order('step_order', { ascending: true });
      const allSteps = Array.isArray(steps) ? steps : [];
      const matchingSteps = allSteps.filter((step) => identityCandidates.has(String(step.assignee_id ?? '').toLowerCase()));
      const openSteps = allSteps.filter((step) => !['completed', 'rejected', 'bypassed', 'cancelled'].includes(String(step.status).toLowerCase()));
      const currentOrder = openSteps.length ? Math.min(...openSteps.map((step) => Number(step.step_order ?? 0))) : null;
      const isParallel = Boolean(workflow.is_parallel) || ['parallel', 'bidirectional'].includes(String(workflow.routing_type ?? '').toLowerCase());
      const activeMatch = isParallel
        ? matchingSteps.some((step) => String(step.status).toLowerCase() === 'current')
        : matchingSteps.some((step) => Number(step.step_order ?? 0) === currentOrder && ['current', 'pending'].includes(String(step.status).toLowerCase()));
      participant = matchingSteps.length > 0 && activeMatch;
    }
  }

  if (!participant) throw Object.assign(new Error('You are not authorized to sign this document'), { status: 403 });
  if (document.status === 'rejected' || document.workflow_state === 'archived') {
    throw Object.assign(new Error('This document is no longer signable'), { status: 409 });
  }

  return document;
}

export async function createSigningIntent(documentId: string, user: User): Promise<SigningIntentResult> {
  const document = await getSigningDocument(documentId, user);
  const expiresAt = new Date(Date.now() + SIGNING_INTENT_TTL_MS).toISOString();

  await supabaseAdmin
    .from('signing_transactions')
    .update({ status: 'expired' })
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  const { data, error } = await supabaseAdmin
    .from('signing_transactions')
    .insert({
      document_id: documentId,
      user_id: user.id,
      document_version: document.signing_version ?? 0,
      status: 'pending',
      auth_method: 'session',
      auth_verified_at: null,
      expires_at: expiresAt,
    })
    .select('id, document_version, expires_at')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create signing transaction');
  return {
    transactionId: String(data.id),
    documentVersion: Number(data.document_version ?? 0),
    expiresAt: String(data.expires_at),
  };
}

export async function markSigningAuthentication(
  transactionId: string,
  documentId: string,
  userId: string,
  authRequestId: string,
  authMethod: 'passkey' | 'backup_code',
): Promise<void> {
  const { data: tx, error: txError } = await supabaseAdmin
    .from('signing_transactions')
    .select('id, status, expires_at, document_id, user_id')
    .eq('id', transactionId)
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .single();
  if (txError || !tx) throw Object.assign(new Error('Signing transaction not found'), { status: 404 });
  if (tx.status !== 'pending' || new Date(String(tx.expires_at)) <= new Date()) {
    throw Object.assign(new Error('Signing transaction is no longer valid'), { status: 409 });
  }

  const { data: proof, error: proofError } = await supabaseAdmin
    .from('webauthn_audit_log')
    .select('id, event_type, user_id, document_id, signing_transaction_id, auth_method, created_at')
    .eq('request_id', authRequestId)
    .eq('event_type', 'document_signing')
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .eq('signing_transaction_id', transactionId)
    .eq('auth_method', authMethod)
    .maybeSingle();
  if (proofError || !proof || Date.now() - Date.parse(String(proof.created_at)) > SIGNING_INTENT_TTL_MS) {
    throw Object.assign(new Error('Authentication proof is invalid or expired'), { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('signing_transactions')
    .update({ auth_method: authMethod, auth_request_id: authRequestId, auth_verified_at: new Date().toISOString() })
    .eq('id', transactionId)
    .eq('status', 'pending');
  if (error) throw new Error(`Could not record signing authentication: ${error.message}`);
}

export async function completeSigning(
  documentId: string,
  transactionId: string,
  authRequestId: string,
  user: User,
  signaturesInput: unknown,
  files: Express.Multer.File[],
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<CompleteSigningResult> {
  if (!authRequestId || !/^[0-9a-f-]{36}$/i.test(authRequestId)) {
    throw Object.assign(new Error('A verified signing authentication proof is required'), { status: 401 });
  }
  if (!files.length || files.length > MAX_SIGNED_FILES) throw new Error(`Between 1 and ${MAX_SIGNED_FILES} signed files are required`);
  files.forEach((file) => {
    if (file.size <= 0 || file.size > MAX_SIGNED_FILE_BYTES) throw new Error(`Signed file ${file.originalname} exceeds the 25 MB limit`);
    if (!ALLOWED_SIGNED_MIME_TYPES.has(file.mimetype)) throw new Error(`Signed file ${file.originalname} has an unsupported output type`);
  });

  const document = await getSigningDocument(documentId, user);
  const originalFiles = await loadOriginalFileBytes(document);
  const originalDocumentHash = originalFiles.length > 0 ? createArtifactHash(originalFiles) : null;
  const { data: proof, error: proofError } = await supabaseAdmin
    .from('webauthn_audit_log')
    .select('id, event_type, user_id, document_id, signing_transaction_id, auth_method, created_at')
    .eq('request_id', authRequestId)
    .eq('event_type', 'document_signing')
    .eq('user_id', user.id)
    .eq('document_id', documentId)
    .eq('signing_transaction_id', transactionId)
    .maybeSingle();

  if (proofError || !proof || Date.now() - Date.parse(String(proof.created_at)) > SIGNING_INTENT_TTL_MS) {
    throw Object.assign(new Error('Signing authentication proof is invalid or expired'), { status: 401 });
  }

  const signer = user.email || user.id;
  const signatures = normalizeSignatureMetadata(signaturesInput, signer);
  const existingSignatures = asArray<Record<string, unknown>>(document.signature_metadata);
  const signaturesById = new Map<string, Record<string, unknown>>();
  existingSignatures.forEach((item) => {
    if (typeof item.id === 'string') signaturesById.set(item.id, item);
  });
  signatures.forEach((item) => signaturesById.set(item.id, item as unknown as Record<string, unknown>));
  const mergedSignatures = Array.from(signaturesById.values());

  const existingSignedFiles = asArray<Record<string, unknown>>(document.signed_file_urls);
  const uploadedPaths: SignedUploadResult[] = [];
  const artifactHash = createArtifactHash(files.map((file) => ({
    name: file.originalname,
    mimetype: file.mimetype,
    buffer: file.buffer,
  })));

  try {
    for (const file of files) {
      const storagePath = `${documentId}/signed/${randomUUID()}-${safeFileName(file.originalname)}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
      if (error) throw new Error(`Signed artifact upload failed: ${error.message}`);
      uploadedPaths.push({
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        storage_path: storagePath,
        storage_url: publicSigningFileUrl(documentId, storagePath),
      });
    }

    const newNames = new Set(uploadedPaths.map((file) => file.name));
    const mergedSignedFiles = [
      ...existingSignedFiles.filter((file) => typeof file.name !== 'string' || !newNames.has(file.name)),
      ...uploadedPaths,
    ];
    const existingSignedBy = asArray<string>(document.signed_by).map(String);
    const signedBy = Array.from(new Set([...existingSignedBy, signer]));

    const { data, error } = await supabaseAdmin.rpc('complete_document_signing', {
      p_document_id: documentId,
      p_transaction_id: transactionId,
      p_signer_id: user.id,
      p_signer_name: signer,
      p_signature_metadata: mergedSignatures,
      p_signed_file_urls: mergedSignedFiles,
      p_signed_by: signedBy,
      p_signature_count: mergedSignatures.length,
      p_original_document_hash: originalDocumentHash,
      p_signed_artifact_hash: artifactHash,
      p_signed_file_count: mergedSignedFiles.length,
      p_ip_address: ipAddress ?? null,
      p_user_agent: userAgent ?? null,
      p_audit_metadata: {
        signatureCount: signatures.length,
        signedFileCount: uploadedPaths.length,
        artifactNames: uploadedPaths.map((file) => file.name),
      },
    });

    if (error || !data) throw new Error(error?.message ?? 'Could not complete signing transaction');
    return data as CompleteSigningResult;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(uploadedPaths.map((file) => file.storage_path));
    }
    throw error;
  }
}

export async function createSignedArtifactUrl(documentId: string, storagePath: string, user: User): Promise<string> {
  const document = await getSigningDocument(documentId, user, { requireActiveSigner: false });
  if (!storagePath.startsWith(`${document.id}/`)) throw Object.assign(new Error('Invalid storage path'), { status: 400 });
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw Object.assign(new Error('Signed artifact unavailable'), { status: 404 });
  return data.signedUrl;
}
