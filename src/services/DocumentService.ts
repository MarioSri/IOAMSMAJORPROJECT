import { supabase } from '@/lib/supabase';
import { supabaseStorageService, StorageFileInfo } from './SupabaseStorageService';
import { sanitizeForLog } from '@/utils/sanitize';

interface CreateDocumentData {
  title: string;
  description: string;
  type: string;
  priority: string;
  submitter_id: string;
  submitter_name: string;
  submitter_department?: string;
  submitter_designation?: string;
  is_emergency?: boolean;
  files: File[];
  /**
   * Pre-serialized StorageFileInfo objects (storage_path, storage_url, etc.).
   * When provided, real-time upload is skipped — used by Emergency and Bypass
   * workflows that pre-upload files via SupabaseStorageService before calling
   * this service.
   */
  filesMetadata?: Array<StorageFileInfo & { [key: string]: any }>;
  recipients: string[]; // Display names for UI
  recipient_ids?: string[]; // role_recipients UUIDs for matching
  /** Identifies the originating workflow module */
  source?: string;
  /** Per-recipient file assignments: { [recipientId]: [fileName, ...] } */
  file_assignments?: Record<string, string[]>;
}

interface Document {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  submitter_id: string;
  submitter_name: string;
  submitter_department?: string;
  submitter_designation?: string;
  submitted_date: string;
  is_emergency: boolean;
  files?: DocumentFile[];
}

export interface DocumentFile {
  id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  storage_url: string;
}

class DocumentService {
  async createDocument(data: CreateDocumentData): Promise<Document> {
    // Create document record in Supabase
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        submitter_id: data.submitter_id,
        submitter_name: data.submitter_name,
        submitter_department: data.submitter_department,
        submitter_designation: data.submitter_designation,
        is_emergency: data.is_emergency ?? false,
        status: 'pending',
        recipients: data.recipients,
        recipient_ids: data.recipient_ids ?? [],
        source: data.source ?? 'document-management',
        file_assignments: data.file_assignments ?? {},
      })
      .select()
      .single();

    if (docError) throw docError;

    // Handle file storage
    const filesJsonb: DocumentFile[] = [];

    if (data.filesMetadata?.length) {
      console.log(`[DocumentService] Using pre-uploaded filesMetadata (${data.filesMetadata.length} file(s)).`);
      filesJsonb.push(...(data.filesMetadata as DocumentFile[]));
    } else if (data.files?.length) {
      console.log(`[DocumentService] Uploading ${data.files.length} file(s) to Supabase Storage…`);
      for (const file of data.files) {
        try {
          const info = await supabaseStorageService.uploadFile(file, document.id);
          filesJsonb.push(info);
          console.log(`[DocumentService] ✅ Uploaded: ${sanitizeForLog(file.name)}`);
        } catch (uploadError) {
          console.warn(
            `[DocumentService] ⚠️ Upload failed for ${sanitizeForLog(file.name)}, storing metadata only:`,
            uploadError
          );
          filesJsonb.push({
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: '',
            storage_url: '',
          });
        }
      }
    }

    // Persist file metadata if any
    if (filesJsonb.length) {
      const { error: fileUpdateError } = await supabase
        .from('documents')
        .update({ files: filesJsonb })
        .eq('id', document.id);

      if (fileUpdateError) {
        throw new Error(`Failed to save file metadata: ${fileUpdateError.message}`);
      }
    }

    return { ...document, files: filesJsonb };
  }

  async getDocumentById(id: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching document:', sanitizeForLog(error));
      return null;
    }
    return data;
  }

  async getDocumentsBySubmitter(submitterId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('submitter_id', submitterId)
      .order('submitted_date', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', sanitizeForLog(error));
      return [];
    }
    return data ?? [];
  }

  async updateDocumentStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteDocument(id: string): Promise<void> {
    // Delete files from Supabase Storage before removing the DB record
    try {
      await supabaseStorageService.deleteDocumentFiles(id);
    } catch (storageError) {
      // Non-fatal — the DB record should still be deleted
      console.warn('[DocumentService] Could not delete storage files for document:', id, storageError);
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const documentService = new DocumentService();
