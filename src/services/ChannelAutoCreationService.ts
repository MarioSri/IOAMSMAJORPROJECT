import { departmentChatService } from './DepartmentChatService';

interface DocumentSubmission {
  documentId: string;
  documentTitle: string;
  submittedBy: string;
  submittedByName: string;
  recipients: string[];  // role_recipients UUIDs
  recipientNames?: string[];
  source: 'Document Management' | 'Emergency Management' | 'Approval Chain with Bypass';
  submittedAt: Date;
}

interface CreatedChannel {
  id: string;
  name: string;
  members: string[];
  documentId?: string | null;
}

export class ChannelAutoCreationService {
  /**
   * @deprecated Channel creation is now handled exclusively by database triggers.
   * See: supabase/migrations/20260305_chat_realtime_overhaul.sql (create_document_chat_channel function)
   * 
   * This method was removed to prevent race conditions from concurrent channel creation attempts.
   * Database triggers are the single source of truth for channel creation.
   * 
   * Do not call this method. Use getChannelByDocumentId() for read-only verification instead.
   */
  static async createDocumentChannel(submission: DocumentSubmission): Promise<CreatedChannel | null> {
    console.warn(
      '⚠️ DEPRECATED: ChannelAutoCreationService.createDocumentChannel() is deprecated. ' +
      'Channel creation is now handled by database triggers (20260305_chat_realtime_overhaul.sql). ' +
      'This method does nothing and will be removed in a future release.'
    );
    
    // Do not create channels here - rely on DB triggers instead
    // Just verify if one already exists
    const existing = await departmentChatService.getChannelByDocumentId(submission.documentId);
    if (existing) {
      console.log('Channel already exists for document (created by DB trigger):', existing.id);
      return {
        id: existing.id,
        name: existing.name,
        members: existing.members,
        documentId: existing.document_id
      };
    }
    
    return null;
  }

  /**
   * Read-only verification method.
   * Returns the channel for a document if it exists, without creating anything.
   */
  static async getChannelByDocumentId(documentId: string): Promise<CreatedChannel | null> {
    const channel = await departmentChatService.getChannelByDocumentId(documentId);
    if (!channel) return null;
    return { id: channel.id, name: channel.name, members: channel.members, documentId: channel.document_id };
  }
}

export const channelAutoCreationService = ChannelAutoCreationService;
