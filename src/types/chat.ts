export type UserRole =
  | 'principal'
  | 'registrar'
  | 'program-head'
  | 'hod'
  | 'employee'
  | 'dean'
  | 'chairman'
  | 'director'
  | 'controller-examinations'
  | 'asst-dean-iiic'
  | 'head-operations'
  | 'librarian'
  | 'ssg'
  | 'cdc-employee'
  | 'mentor'
  | 'faculty';

export type Department =
  | 'EEE'
  | 'MECH'
  | 'CSE'
  | 'ECE'
  | 'CSM'
  | 'CSO'
  | 'CSD'
  | 'CSC'
  | 'ADMIN'
  | 'LIBRARY'
  | 'OPERATIONS';

export type AcademicYear = 1 | 2 | 3 | 4;

export interface ChatUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: Department;
  academicYear?: AcademicYear;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  status: 'available' | 'busy' | 'away' | 'offline';
  publicKey?: string; // For E2E encryption
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  type: 'role-based' | 'department' | 'document-thread' | 'private' | 'general' | 'document' | 'approval' | 'thread';
  members: string[]; // User IDs
  admins: string[]; // User IDs with admin privileges
  isPrivate: boolean;
  department?: Department;
  academicYear?: AcademicYear;
  targetRoles?: UserRole[];
  documentId?: string; // For document-centric threads
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  pinnedMessages: string[]; // Message IDs
  settings: {
    allowFileUploads: boolean;
    allowPolls: boolean;
    allowSignatureRequests: boolean;
    requireModeration: boolean;
    autoArchive: boolean;
    notificationLevel: 'all' | 'mentions' | 'none';
  };
}

export type MessageType =
  | 'text'
  | 'file'
  | 'image'
  | 'document'
  | 'signature-request'
  | 'poll'
  | 'system'
  | 'thread-reply'
  | 'status-update'
  | 'meeting-request'
  | 'ai-summary'
  | 'approval_request'
  | 'document_share'
  | 'video'
  | 'audio'
  | 'notification';

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type DocumentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'under-review';

export interface DocumentMetadata {
  fileType?: string;
  fileSize?: number;
  fileUrl?: string;
  dueDate?: string;
  version?: string;
  status?: DocumentStatus;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  type: MessageType;
  content: string;
  threadId?: string; // For threaded conversations
  parentMessageId?: string; // For replies
  timestamp: Date;
  editedAt?: Date;
  status: MessageStatus;
  reactions: MessageReaction[];
  mentions: string[]; // User IDs mentioned in message
  attachments: MessageAttachment[];
  metadata: {
    documentId?: string;
    documentStatus?: DocumentStatus;
    signatureRequestId?: string;
    pollId?: string;
    aiGenerated?: boolean;
    poll?: ChatPoll;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    tags?: string[];
    replyToPrivate?: string;
    originalMessageContent?: string;
    callType?: string;
    callEnded?: boolean;
    meetingId?: string;
    initiatedBy?: string;
    duration?: number;
    endedBy?: string;
  };
  encryption?: {
    encrypted: boolean;
    algorithm?: string;
    recipients?: string[]; // Public keys
  };
  readBy: MessageReadStatus[];
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'video' | 'audio' | 'other';
  size: number;
  mimeType: string;
  thumbnail?: string;
  previewUrl?: string;
  driveId?: string; // For Google Drive integration
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
  };
}

export interface MessageReadStatus {
  userId: string;
  readAt: Date;
  action: 'read' | 'skipped' | 'ignored';
}

export interface SignatureRequest {
  id: string;
  messageId: string;
  documentId: string;
  requestedBy: string;
  targetUsers: string[];
  title: string;
  description: string;
  deadline?: Date;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  signatures: DigitalSignature[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DigitalSignature {
  id: string;
  userId: string;
  signatureData: string; // Base64 encoded signature
  signedAt: Date;
  ipAddress: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  verified: boolean;
}

export interface ChatPoll {
  id: string;
  messageId: string;
  channelId: string;
  createdBy: string;
  title: string;
  description?: string;
  type: 'single-choice' | 'multiple-choice' | 'yes-no' | 'likert-scale';
  options: PollOption[];
  allowAnonymous: boolean;
  deadline?: Date;
  status: 'active' | 'closed' | 'expired';
  results: PollResults;
  createdAt: Date;
}

export interface PollOption {
  id: string;
  text: string;
  value?: number; // For Likert scale
  votes: PollVote[];
}

export interface PollVote {
  userId: string;
  optionId: string;
  timestamp: Date;
  anonymous?: boolean;
}

export interface PollResults {
  totalVotes: number;
  breakdown: {
    optionId: string;
    count: number;
    percentage: number;
  }[];
  demographics?: {
    byRole: Record<UserRole, number>;
    byDepartment: Record<Department, number>;
  };
}

export interface ChatNotification {
  id: string;
  userId: string;
  type: 'mention' | 'direct-message' | 'document-update' | 'signature-request' | 'poll-created' | 'system';
  title: string;
  message: string;
  channelId?: string;
  messageId?: string;
  documentId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ChatThread {
  id: string;
  channelId: string;
  parentMessageId: string;
  title?: string;
  participants: string[];
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  archived: boolean;
}

export interface ChatAudit {
  id: string;
  channelId?: string;
  messageId?: string;
  userId: string;
  action: 'message-sent' | 'message-edited' | 'message-deleted' | 'user-joined' | 'user-left' | 'permission-changed' | 'channel-created' | 'channel-deleted';
  details: string;
  timestamp: Date;
  ipAddress: string;
  metadata?: Record<string, any>;
}

export interface AIAssistant {
  id: string;
  name: string;
  type: 'summarizer' | 'decision-extractor' | 'task-manager' | 'response-suggester';
  status: 'active' | 'inactive';
  settings: {
    autoSummarize: boolean;
    summaryThreshold: number; // Number of messages before auto-summary
    extractDecisions: boolean;
    suggestResponses: boolean;
    languages: string[];
  };
}

export interface ChatSummary {
  id: string;
  channelId: string;
  messageRange: {
    startMessageId: string;
    endMessageId: string;
    startTime: Date;
    endTime: Date;
  };
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: string[];
  participants: string[];
  generatedBy: 'ai' | 'user';
  generatedAt: Date;
  metadata?: {
    aiModel?: string;
    confidence?: number;
    wordCount?: number;
  };
}

export interface OfflineSync {
  userId: string;
  lastSyncTime: Date;
  pendingMessages: ChatMessage[];
  pendingNotifications: ChatNotification[];
  syncStatus: 'synced' | 'pending' | 'error';
  conflictResolution: 'server-wins' | 'client-wins' | 'merge';
}

export interface ChatAnalytics {
  channelId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalMessages: number;
    activeUsers: number;
    averageResponseTime: number; // in minutes
    messageTypes: Record<MessageType, number>;
    engagementRate: number;
    topContributors: {
      userId: string;
      messageCount: number;
    }[];
    peakActivityHours: number[];
    documentInteractions: number;
    signatureRequests: number;
    pollsCreated: number;
  };
}

export interface ChatApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type ChatEventType =
  | 'message-sent'
  | 'message-edited'
  | 'message-deleted'
  | 'user-joined'
  | 'user-left'
  | 'user-typing'
  | 'user-status-changed'
  | 'channel-created'
  | 'channel-updated'
  | 'notification-sent'
  | 'document-status-changed'
  | 'signature-requested'
  | 'poll-created'
  | 'ai-summary-generated';

export interface ChatEvent {
  type: ChatEventType;
  channelId?: string;
  userId?: string;
  data: any;
  timestamp: Date;
}

export interface ChatSearchQuery {
  query: string;
  channelIds?: string[];
  userIds?: string[];
  messageTypes?: MessageType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  hasAttachments?: boolean;
  documentStatus?: DocumentStatus[];
  priority?: ('low' | 'normal' | 'high' | 'urgent')[];
  limit?: number;
  offset?: number;
}

export interface ChatSearchResult {
  messages: ChatMessage[];
  channels: ChatChannel[];
  users: ChatUser[];
  total: number;
  highlights: {
    messageId: string;
    snippet: string;
    matchedTerms: string[];
  }[];
}
