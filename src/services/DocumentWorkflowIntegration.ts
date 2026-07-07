import { departmentChatService } from './DepartmentChatService';
import { ChatMessage, ChatChannel, DocumentMetadata } from '@/types/chat';

export interface DocumentWorkflowEvent {
  id: string;
  type: 'document_created' | 'approval_requested' | 'approval_completed' | 'document_shared' | 'comment_added';
  documentId: string;
  documentType: 'letter' | 'circular' | 'report' | 'form' | 'approval';
  title: string;
  description?: string;
  userId: string;
  recipientIds?: string[];
  channelId?: string;
  metadata: DocumentMetadata;
  createdAt: Date;
}

export interface WorkflowNotification {
  id: string;
  type: 'approval_request' | 'approval_completed' | 'document_update' | 'deadline_reminder';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId: string;
  documentId?: string;
  actionRequired: boolean;
  actionUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export class DocumentWorkflowIntegration {
  private workflowEventHandlers: Map<string, (event: DocumentWorkflowEvent) => void> = new Map();

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.workflowEventHandlers.set('document_created', this.handleDocumentCreated.bind(this));
    this.workflowEventHandlers.set('approval_requested', this.handleApprovalRequested.bind(this));
    this.workflowEventHandlers.set('approval_completed', this.handleApprovalCompleted.bind(this));
    this.workflowEventHandlers.set('document_shared', this.handleDocumentShared.bind(this));
  }

  async processWorkflowEvent(event: DocumentWorkflowEvent): Promise<void> {
    const handler = this.workflowEventHandlers.get(event.type);
    if (handler) {
      await handler(event);
    }
  }

  private async handleDocumentCreated(event: DocumentWorkflowEvent): Promise<void> {
    const channelName = `doc-${event.documentType}-${event.documentId.slice(0, 8)}`;
    const channelDescription = `Discussion thread for: ${event.title}`;

    const memberAuthIds = await departmentChatService.resolveRecipientIdsToAuthIds(event.recipientIds || []);
    const members = Array.from(new Set([event.userId, ...memberAuthIds]));

    const channel = await departmentChatService.createChannel({
      name: channelName,
      description: channelDescription,
      type: 'document',
      is_private: true,
      document_id: event.documentId,
      created_by: event.userId,
      members,
      admins: [event.userId]
    });

    await departmentChatService.sendMessage({
      channel_id: channel.id,
      content: `📄 Document "${event.title}" has been created and is ready for discussion.`,
      sender_id: event.userId,
      message_type: 'system'
    });

    await departmentChatService.sendMessage({
      channel_id: channel.id,
      content: `**Document Details:**
📋 Type: ${event.documentType.toUpperCase()}
📝 Title: ${event.title}
${event.description ? `📄 Description: ${event.description}` : ''}
🕒 Created: ${event.createdAt.toLocaleString()}

Use this channel to discuss, ask questions, or provide feedback on this document.`,
      sender_id: event.userId,
      message_type: 'system'
    });
  }

  private async handleApprovalRequested(event: DocumentWorkflowEvent): Promise<void> {
    if (!event.recipientIds?.length) return;

    const channelName = `approval-${event.documentId.slice(0, 8)}`;

    const memberAuthIds = await departmentChatService.resolveRecipientIdsToAuthIds(event.recipientIds);
    const members = Array.from(new Set([event.userId, ...memberAuthIds]));

    const channel = await departmentChatService.createChannel({
      name: channelName,
      description: `Approval workflow for: ${event.title}`,
      type: 'private',
      is_private: true,
      document_id: event.documentId,
      created_by: event.userId,
      members,
      admins: [event.userId]
    });

    const approverMentions = event.recipientIds.map(id => `@${id}`).join(' ');
    await departmentChatService.sendMessage({
      channel_id: channel.id,
      content: `🔔 **Approval Required**

${approverMentions} - Your approval is requested for the following document:

📋 **${event.title}**
📄 Type: ${event.documentType.toUpperCase()}
${event.description ? `📝 Description: ${event.description}` : ''}

Please review and provide your approval or feedback.`,
      sender_id: event.userId,
      message_type: 'approval_request'
    });

    // Send a signature-request notification message
    await departmentChatService.sendMessage({
      channel_id: channel.id,
      content: `Approval requested for: ${event.title}`,
      sender_id: event.userId,
      message_type: 'signature-request'
    });
  }

  private async handleApprovalCompleted(event: DocumentWorkflowEvent): Promise<void> {
    // Log approval completion — event.documentId is safe (UUID), event.title is user-controlled so omitted
    console.log('Approval completed for document:', event.documentId);
  }

  private async handleDocumentShared(event: DocumentWorkflowEvent): Promise<void> {
    if (!event.channelId || !event.recipientIds?.length) return;

    await departmentChatService.sendMessage({
      channel_id: event.channelId,
      content: `📤 **Document Shared**

@channel A document has been shared with this group:

📋 **${event.title}**
📄 Type: ${event.documentType.toUpperCase()}
${event.description ? `📝 Description: ${event.description}` : ''}
👤 Shared by: <@${event.userId}>

Click to view and download the document.`,
      sender_id: event.userId,
      message_type: 'document_share'
    });
  }

  private async sendWorkflowNotification(notification: WorkflowNotification): Promise<void> {
    // Intentional no-op stub: notification routing handled by external services
    void notification;
  }

  async createDocumentThread(
    documentId: string,
    sectionId: string,
    title: string,
    initiatorId: string,
    participantIds: string[]
  ): Promise<{ id: string }> {
    const threadName = `thread-${documentId.slice(0, 8)}-${sectionId}`;
    const memberAuthIds = await departmentChatService.resolveRecipientIdsToAuthIds(participantIds);
    const members = Array.from(new Set([initiatorId, ...memberAuthIds]));

    return await departmentChatService.createChannel({
      name: threadName,
      description: `Discussion thread: ${title}`,
      type: 'document-thread',
      is_private: true,
      document_id: documentId,
      created_by: initiatorId,
      members,
      admins: [initiatorId]
    });
  }

  async generateDocumentDiscussionSummary(documentId: string): Promise<string> {
    return `Summary of discussions for document ${documentId}: 
    
Key points discussed:
- Document review completed
- Minor revisions suggested
- Approval process initiated
- All stakeholders notified

Action items:
- Implement suggested changes
- Schedule follow-up review
- Finalize approval workflow`;
  }

  async exportWorkflowAuditTrail(documentId: string): Promise<{
    documentId: string;
    timeline: Array<{
      timestamp: Date;
      event: string;
      actor: string;
      details: string;
      channelId?: string;
      messageId?: string;
    }>;
    discussions: Array<{
      channelName: string;
      messageCount: number;
      participantCount: number;
      keyTopics: string[];
    }>;
    approvals: Array<{
      approver: string;
      status: 'pending' | 'approved' | 'rejected';
      timestamp?: Date;
      comments?: string;
    }>;
  }> {
    return {
      documentId,
      timeline: [
        {
          timestamp: new Date(),
          event: 'Document Created',
          actor: 'System',
          details: 'Document workflow initiated'
        }
      ],
      discussions: [
        {
          channelName: `doc-${documentId.slice(0, 8)}`,
          messageCount: 0,
          participantCount: 0,
          keyTopics: []
        }
      ],
      approvals: []
    };
  }
}

export default DocumentWorkflowIntegration;
