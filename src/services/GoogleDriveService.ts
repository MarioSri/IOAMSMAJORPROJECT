/**
 * @deprecated GoogleDriveService has been replaced by SupabaseStorageService.
 *
 * This file is intentionally kept as a no-op shim to avoid breaking any
 * remaining import references during the transition. All methods log a
 * deprecation warning and return safe default values.
 *
 * DO NOT add new logic here. Use `SupabaseStorageService` instead.
 */

class GoogleDriveService {
  private warn(method: string) {
    console.warn(
      `[GoogleDriveService] ⚠️ DEPRECATED: ${method}() is a no-op. ` +
        'File storage has been migrated to Supabase Storage (SupabaseStorageService).'
    );
  }

  async uploadFile(_file: File): Promise<any> {
    this.warn('uploadFile');
    return { id: '', name: '', mimeType: '', webViewLink: '', size: 0 };
  }

  async setFilePermissions(_fileId: string, _emails: string[]): Promise<void> {
    this.warn('setFilePermissions');
  }

  async deleteFile(_fileId: string): Promise<void> {
    this.warn('deleteFile');
  }

  async getFileMetadata(_fileId: string): Promise<any> {
    this.warn('getFileMetadata');
    return null;
  }

  async listFiles(_query?: string): Promise<any[]> {
    this.warn('listFiles');
    return [];
  }
}

export const googleDriveService = new GoogleDriveService();
