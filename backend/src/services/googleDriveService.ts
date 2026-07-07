import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Google Drive Service — Service Account Authentication
// ---------------------------------------------------------------------------

let _drive: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (_drive) return _drive;

  // Option 1: JSON key file path
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  // Option 2: Inline JSON (e.g. from a secret manager / env var)
  const keyJsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let auth: any;

  if (keyFilePath && fs.existsSync(path.resolve(keyFilePath))) {
    auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(keyFilePath),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } else if (keyJsonRaw) {
    const credentials = JSON.parse(keyJsonRaw);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } else {
    console.warn(
      'No Google Service Account credentials found. ' +
      'Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON.'
    );
    // Fall back to API key for backwards compat (limited functionality)
    auth = process.env.GOOGLE_API_KEY;
  }

  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

export interface DriveUploadResult {
  success: boolean;
  data?: { id: string; name: string; url: string; webContentLink?: string; size?: number };
  error?: string;
}

export class GoogleDriveService {
  /**
   * Upload a file buffer to Google Drive.
   */
  static async uploadFile(
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    folderId?: string
  ): Promise<DriveUploadResult> {
    try {
      const drive = getDriveClient();

      const parents = folderId ? [folderId] : FOLDER_ID ? [FOLDER_ID] : undefined;

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          ...(parents && { parents }),
        },
        media: { mimeType, body: Readable.from(fileBuffer) },
        fields: 'id,name,webViewLink,webContentLink,size',
      });

      return {
        success: true,
        data: {
          id: response.data.id!,
          name: response.data.name!,
          url: response.data.webViewLink || '',
          webContentLink: response.data.webContentLink || undefined,
          size: response.data.size ? Number(response.data.size) : undefined,
        },
      };
    } catch (error) {
      console.error('Google Drive upload error:', error);
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Stream file content from Google Drive.
   * Returns a Node Readable stream the caller can pipe to an HTTP response.
   */
  static async getFileStream(
    fileId: string
  ): Promise<{ stream: Readable; mimeType: string; fileName: string } | null> {
    try {
      const drive = getDriveClient();

      // Get metadata first for name + mime
      const meta = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size',
      });

      const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return {
        stream: res.data as unknown as Readable,
        mimeType: meta.data.mimeType || 'application/octet-stream',
        fileName: meta.data.name || 'download',
      };
    } catch (error) {
      console.error('Google Drive stream error:', error);
      return null;
    }
  }

  /**
   * Get file metadata from Google Drive.
   */
  static async getFileMetadata(fileId: string) {
    try {
      const drive = getDriveClient();
      const res = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime',
      });
      return { success: true, data: res.data };
    } catch (error) {
      console.error('Google Drive metadata error:', error);
      return { success: false, error: 'Metadata fetch failed' };
    }
  }

  /**
   * Set file permissions.
   * Makes the file readable by anyone with the link, plus writer access for
   * specific emails (if provided).
   */
  static async setFilePermissions(fileId: string, recipientEmails?: string[]) {
    try {
      const drive = getDriveClient();

      // Anyone with link can read
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      // Per-recipient writer permissions - parallelized for speed
      if (recipientEmails?.length) {
        await Promise.all(recipientEmails.map(async (email) => {
          try {
            await drive.permissions.create({
              fileId,
              requestBody: { role: 'writer', type: 'user', emailAddress: email },
              sendNotificationEmail: false,
            });
          } catch (e) {
            console.warn(`Failed to set permission for ${email}:`, e);
          }
        }));
      }

      return { success: true };
    } catch (error) {
      console.error('Google Drive permissions error:', error);
      return { success: false, error: 'Permission update failed' };
    }
  }

  /**
   * Delete a file from Google Drive.
   */
  static async deleteFile(fileId: string) {
    try {
      const drive = getDriveClient();
      await drive.files.delete({ fileId });
      return { success: true };
    } catch (error) {
      console.error('Google Drive delete error:', error);
      return { success: false, error: 'Delete failed' };
    }
  }
}