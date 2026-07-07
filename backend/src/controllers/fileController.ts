import { Request, Response } from 'express';
import { GoogleDriveService } from '../services/googleDriveService';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { writeAuditLog } from '../lib/supabaseAuditLogger';
import { ApiResponse, AuthRequest } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SourceType = 'document' | 'emergency' | 'bypass';

function parentColumn(sourceType: SourceType): string {
  switch (sourceType) {
    case 'document':
      return 'document_id';
    case 'emergency':
      return 'emergency_document_id';
    case 'bypass':
      return 'bypass_document_id';
  }
}

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
}

// ---------------------------------------------------------------------------
// POST /api/files/upload  (multipart — supports single or multi-file)
// ---------------------------------------------------------------------------
export async function uploadFiles(req: AuthRequest, res: Response) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;

    const filesToProcess = files?.length ? files : singleFile ? [singleFile] : [];

    if (filesToProcess.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' } as ApiResponse);
    }

    const { sourceType, parentId, userId, userRole, recipientEmails } = req.body;

    if (!sourceType || !parentId) {
      return res.status(400).json({
        success: false,
        error: 'sourceType and parentId are required',
      } as ApiResponse);
    }

    if (!['document', 'emergency', 'bypass'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'sourceType must be one of: document, emergency, bypass',
      } as ApiResponse);
    }

    const effectiveUserId = userId || (req as any).user?.id || 'unknown';
    const effectiveRole = userRole || (req as any).user?.role || 'user';

    // Parallelize file processing
    const results = await Promise.all(filesToProcess.map(async (file) => {
      try {
        // 1. Upload to Google Drive
        const driveResult = await GoogleDriveService.uploadFile(
          file.originalname,
          file.buffer,
          file.mimetype
        );

        if (!driveResult.success || !driveResult.data) {
          return {
            fileName: file.originalname,
            success: false,
            error: driveResult.error || 'Drive upload failed',
          };
        }

        // 2. Set permissions (if recipient emails provided)
        let emails: string[] = [];
        try {
          emails = recipientEmails ? JSON.parse(recipientEmails) : [];
        } catch { /* ignore parse errors */ }

        if (emails.length > 0) {
          await GoogleDriveService.setFilePermissions(driveResult.data.id, emails);
        }

        // 3. Insert metadata into Supabase document_files table
        let dbRecord: any = null;

        if (isSupabaseConfigured()) {
          const row: Record<string, any> = {
            file_name: file.originalname,
            file_type: file.mimetype,
            file_size: file.size,
            google_drive_id: driveResult.data.id,
            google_drive_url: driveResult.data.url,
            source_type: sourceType as SourceType,
            uploaded_by: effectiveUserId,
            uploaded_by_role: effectiveRole,
            [parentColumn(sourceType as SourceType)]: parentId,
          };

          const { data, error } = await supabaseAdmin
            .from('document_files')
            .insert(row)
            .select()
            .single();

          if (error) {
            console.error('[files] Supabase insert error:', error.message);
          } else {
            dbRecord = data;
          }
        }

        // 4. Audit log
        await writeAuditLog({
          user_id: effectiveUserId,
          user_role: effectiveRole,
          action: 'file.upload',
          resource_type: 'file',
          resource_id: driveResult.data.id,
          metadata: {
            file_name: file.originalname,
            file_type: file.mimetype,
            file_size: file.size,
            source_type: sourceType,
            parent_id: parentId,
          },
          ip_address: getClientIp(req),
        });

        return {
          fileName: file.originalname,
          success: true,
          data: {
            id: dbRecord?.id || null,
            googleDriveId: driveResult.data.id,
            googleDriveUrl: driveResult.data.url,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            sourceType,
            parentId,
            uploadedBy: effectiveUserId,
            uploadedByRole: effectiveRole,
            uploadedAt: dbRecord?.uploaded_at || new Date().toISOString(),
          },
        };
      } catch (err: any) {
        console.error(`[files] Failed to process ${file.originalname}:`, err);
        return {
          fileName: file.originalname,
          success: false,
          error: err.message || 'File processing failed',
        };
      }
    }));

    const allSucceeded = results.every((r) => r.success);

    return res.status(allSucceeded ? 200 : 207).json({
      success: allSucceeded,
      data: results,
    } as ApiResponse);
  } catch (error) {
    console.error('[files] upload error:', error);
    return res.status(500).json({ success: false, error: 'File upload failed' } as ApiResponse);
  }
}

// ---------------------------------------------------------------------------
// GET /api/files/:fileId  — stream/download file content from Google Drive
// ---------------------------------------------------------------------------
export async function downloadFile(req: AuthRequest, res: Response) {
  try {
    const { fileId } = req.params;

    const result = await GoogleDriveService.getFileStream(fileId);

    if (!result) {
      return res.status(404).json({ success: false, error: 'File not found' } as ApiResponse);
    }

    // Audit log
    const effectiveUserId = (req as any).user?.id || 'unknown';
    await writeAuditLog({
      user_id: effectiveUserId,
      user_role: (req as any).user?.role,
      action: 'file.download',
      resource_type: 'file',
      resource_id: fileId,
      ip_address: getClientIp(req),
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(result.fileName)}"`
    );

    result.stream.pipe(res);
    return;
  } catch (error) {
    console.error('[files] download error:', error);
    return res.status(500).json({ success: false, error: 'Download failed' } as ApiResponse);
  }
}

// ---------------------------------------------------------------------------
// GET /api/files/:fileId/metadata
// ---------------------------------------------------------------------------
export async function getFileMetadata(req: AuthRequest, res: Response) {
  try {
    const { fileId } = req.params;

    // Try Supabase first
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('document_files')
        .select('*')
        .eq('google_drive_id', fileId)
        .single();

      if (!error && data) {
        return res.json({ success: true, data } as ApiResponse);
      }
    }

    // Fall back to Drive API
    const result = await GoogleDriveService.getFileMetadata(fileId);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'File not found' } as ApiResponse);
    }

    return res.json({ success: true, data: result.data } as ApiResponse);
  } catch (error) {
    console.error('[files] metadata error:', error);
    return res.status(500).json({ success: false, error: 'Metadata fetch failed' } as ApiResponse);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/files/:fileId
// ---------------------------------------------------------------------------
export async function deleteFile(req: AuthRequest, res: Response) {
  try {
    const { fileId } = req.params;
    const effectiveUserId = (req as any).user?.id || 'unknown';

    // Delete from Google Drive
    const driveResult = await GoogleDriveService.deleteFile(fileId);

    // Delete metadata from Supabase
    if (isSupabaseConfigured()) {
      await supabaseAdmin
        .from('document_files')
        .delete()
        .eq('google_drive_id', fileId);
    }

    // Audit log
    await writeAuditLog({
      user_id: effectiveUserId,
      user_role: (req as any).user?.role,
      action: 'file.delete',
      resource_type: 'file',
      resource_id: fileId,
      ip_address: getClientIp(req),
    });

    if (!driveResult.success) {
      return res.status(500).json({ success: false, error: driveResult.error } as ApiResponse);
    }

    return res.json({ success: true } as ApiResponse);
  } catch (error) {
    console.error('[files] delete error:', error);
    return res.status(500).json({ success: false, error: 'Delete failed' } as ApiResponse);
  }
}

// ---------------------------------------------------------------------------
// GET /api/files/by-parent/:sourceType/:parentId
// ---------------------------------------------------------------------------
export async function getFilesByParent(req: AuthRequest, res: Response) {
  try {
    const { sourceType, parentId } = req.params;

    if (!['document', 'emergency', 'bypass'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'sourceType must be one of: document, emergency, bypass',
      } as ApiResponse);
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured',
      } as ApiResponse);
    }

    const column = parentColumn(sourceType as SourceType);
    const { data, error } = await supabaseAdmin
      .from('document_files')
      .select('*')
      .eq(column, parentId)
      .order('uploaded_at', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }

    return res.json({ success: true, data: data || [] } as ApiResponse);
  } catch (error) {
    console.error('[files] getByParent error:', error);
    return res.status(500).json({ success: false, error: 'Query failed' } as ApiResponse);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/files/:fileId/permissions
// ---------------------------------------------------------------------------
export async function updateFilePermissions(req: AuthRequest, res: Response) {
  try {
    const { fileId } = req.params;
    const { recipientEmails } = req.body;

    if (!Array.isArray(recipientEmails)) {
      return res.status(400).json({
        success: false,
        error: 'recipientEmails must be an array',
      } as ApiResponse);
    }

    const result = await GoogleDriveService.setFilePermissions(fileId, recipientEmails);

    // Audit log
    const effectiveUserId = (req as any).user?.id || 'unknown';
    await writeAuditLog({
      user_id: effectiveUserId,
      user_role: (req as any).user?.role,
      action: 'file.permissions_update',
      resource_type: 'file',
      resource_id: fileId,
      metadata: { recipientEmails },
      ip_address: getClientIp(req),
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error } as ApiResponse);
    }

    return res.json({ success: true } as ApiResponse);
  } catch (error) {
    console.error('[files] permissions error:', error);
    return res.status(500).json({ success: false, error: 'Permission update failed' } as ApiResponse);
  }
}