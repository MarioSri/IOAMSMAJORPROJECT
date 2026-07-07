import { supabase } from '@/lib/supabase';

// ─── Constants ─────────────────────────────────────────────────────────────────

const BUCKET_NAME = 'BCXN';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FILES_PER_REQUEST = 10;

/**
 * Full MIME type allowlist — mirrors the bucket policy and FileViewer capabilities.
 * If file.type is missing/octet-stream, we fall back to extension matching.
 */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx',
  'ppt', 'pptx',
  'txt', 'csv',
  'jpg', 'jpeg',
  'png', 'gif',
  'webp', 'bmp', 'svg',
]);

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface StorageFileInfo {
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  storage_url: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Service ───────────────────────────────────────────────────────────────────

class SupabaseStorageService {
  private static instance: SupabaseStorageService;

  static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  /**
   * Validate file count, size, and MIME type.
   * Throws a descriptive error if any check fails.
   */
  validateFile(file: File): void {
    const ext = getExtension(file.name);
    const mimeType = file.type?.toLowerCase();

    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File "${file.name}" exceeds the 25 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`
      );
    }

    // MIME type check — primary
    if (ALLOWED_MIME_TYPES.has(mimeType)) return;

    // Extension fallback — catches application/octet-stream cases
    if (!mimeType || mimeType === 'application/octet-stream' || mimeType === '') {
      if (ALLOWED_EXTENSIONS.has(ext)) return;
    }

    throw new Error(
      `File "${file.name}" has an unsupported type (${mimeType || ext}). ` +
        'Supported: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, PNG, GIF, WEBP, BMP, SVG.'
    );
  }

  validateFileList(files: File[]): void {
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new Error(`You can upload a maximum of ${MAX_FILES_PER_REQUEST} files at once.`);
    }
    for (const file of files) {
      this.validateFile(file);
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  /**
   * Upload a single file to the BCXN bucket under `<documentId>/<timestamp>-<filename>`.
   * Retries up to 3 times with exponential back-off on network errors.
   */
  async uploadFile(file: File, documentId: string): Promise<StorageFileInfo> {
    this.validateFile(file);

    // Sanitise filename — remove potentially dangerous characters
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
    const storagePath = `${documentId}/${Date.now()}-${safeName}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `[SupabaseStorage] Uploading "${file.name}" → ${BUCKET_NAME}/${storagePath} (attempt ${attempt})`
        );

        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (error) throw new Error(error.message);

        const storageUrl = this.getPublicUrl(storagePath);

        console.log(`[SupabaseStorage] ✅ Upload successful: ${storagePath}`);

        return {
          file_name: file.name,
          file_type: file.type || `application/${getExtension(file.name)}`,
          file_size: file.size,
          storage_path: storagePath,
          storage_url: storageUrl,
        };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[SupabaseStorage] Upload attempt ${attempt} failed:`, lastError.message);

        if (attempt < 3) {
          await sleep(500 * attempt); // 500 ms, 1000 ms back-off
        }
      }
    }

    throw lastError ?? new Error(`Failed to upload "${file.name}" after 3 attempts.`);
  }

  /**
   * Upload multiple files for a given document.
   * Returns an array of StorageFileInfo in the same order as the input array.
   */
  async uploadFiles(files: File[], documentId: string): Promise<StorageFileInfo[]> {
    this.validateFileList(files);
    const results: StorageFileInfo[] = [];
    for (const file of files) {
      const info = await this.uploadFile(file, documentId);
      results.push(info);
    }
    return results;
  }

  // ── Public URL ──────────────────────────────────────────────────────────────

  /**
   * Returns the public URL for a storage path.
   * Uses anon/public access — no auth header required for read.
   */
  getPublicUrl(storagePath: string): string {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  // ── Download ────────────────────────────────────────────────────────────────

  /**
   * Fetch a file from Supabase Storage and return it as a Blob.
   * Used by FileViewer and download handlers.
   */
  async downloadFile(storagePath: string): Promise<Blob> {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storagePath);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    if (!data) {
      throw new Error('Download returned no data.');
    }

    return data;
  }

  /**
   * Fetch a file directly from its public URL (used when only the URL is stored, not the path).
   * Falls back to a standard fetch → Blob.
   */
  async fetchFileFromUrl(url: string, fileName?: string): Promise<File> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const blob = await response.blob();
    const name = fileName || url.split('/').pop()?.split('?')[0] || 'file';

    // Infer MIME type from response headers if blob.type is generic
    const mimeType =
      blob.type && blob.type !== 'application/octet-stream'
        ? blob.type
        : this.inferMimeFromName(name);

    return new File([blob], name, { type: mimeType });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  /**
   * Delete a single file from storage.
   */
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);

    if (error) {
      throw new Error(`Failed to delete file "${storagePath}": ${error.message}`);
    }

    console.log(`[SupabaseStorage] 🗑️ Deleted: ${storagePath}`);
  }

  /**
   * Delete all files under a document's folder (prefix = documentId/).
   * Used when a document is deleted.
   */
  async deleteDocumentFiles(documentId: string): Promise<void> {
    try {
      // List all files under the document folder
      const { data: fileList, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(documentId);

      if (listError) {
        console.warn(`[SupabaseStorage] Could not list files for document ${documentId}:`, listError.message);
        return;
      }

      if (!fileList || fileList.length === 0) {
        console.log(`[SupabaseStorage] No files found for document ${documentId}`);
        return;
      }

      const paths = fileList.map((f) => `${documentId}/${f.name}`);

      const { error: removeError } = await supabase.storage.from(BUCKET_NAME).remove(paths);

      if (removeError) {
        console.warn(`[SupabaseStorage] Could not delete files for document ${documentId}:`, removeError.message);
      } else {
        console.log(`[SupabaseStorage] 🗑️ Deleted ${paths.length} file(s) for document ${documentId}`);
      }
    } catch (err) {
      console.warn(`[SupabaseStorage] deleteDocumentFiles error for ${documentId}:`, err);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private inferMimeFromName(fileName: string): string {
    const ext = getExtension(fileName);
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
    };
    return mimeMap[ext] ?? 'application/octet-stream';
  }
}

export const supabaseStorageService = SupabaseStorageService.getInstance();
export type { SupabaseStorageService };
