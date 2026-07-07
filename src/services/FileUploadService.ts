/**
 * FileUploadService
 *
 * A thin wrapper used by workflow modules (Emergency, Bypass, Approval Chain)
 * to pre-upload File objects to Supabase Storage BEFORE calling
 * DocumentService.createDocument.  Returns StorageFileInfo[] compatible with
 * the filesMetadata fast-path, eliminating base64 serialisation and the
 * resulting localStorage quota issues.
 *
 * Usage:
 *   const metadata = await fileUploadService.uploadFilesForDocument(files, documentId);
 *   await documentService.createDocument({ ..., files: [], filesMetadata: metadata });
 */

import { supabaseStorageService, StorageFileInfo } from './SupabaseStorageService';

class FileUploadService {
  private static instance: FileUploadService;

  static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  /**
   * Upload multiple files to Supabase Storage under `documentId/` prefix.
   *
   * @param files      - Array of File objects to upload (max 10, 25 MB each)
   * @param documentId - Supabase document UUID used as the storage path prefix
   * @returns          - Array of StorageFileInfo ready to pass as `filesMetadata`
   */
  async uploadFilesForDocument(files: File[], documentId: string): Promise<StorageFileInfo[]> {
    if (!files || files.length === 0) return [];

    try {
      supabaseStorageService.validateFileList(files);
    } catch (validationError) {
      throw validationError; // Re-throw with original descriptive message
    }

    console.log(
      `[FileUploadService] Pre-uploading ${files.length} file(s) for document ${documentId}…`
    );

    const results = await supabaseStorageService.uploadFiles(files, documentId);

    console.log(`[FileUploadService] ✅ Pre-upload complete for ${results.length} file(s)`);
    return results;
  }

  /**
   * Validate a file list without uploading.
   * Throws on the first invalid file.
   */
  validateFiles(files: File[]): void {
    supabaseStorageService.validateFileList(files);
  }

  /**
   * Fetch a file from a Supabase Storage public URL and return a File object.
   * Used by FileViewer to reconstruct a File from a stored remote URL.
   */
  async fetchFileFromUrl(url: string, fileName?: string): Promise<File> {
    return supabaseStorageService.fetchFileFromUrl(url, fileName);
  }
}

export const fileUploadService = FileUploadService.getInstance();
export type { FileUploadService };
