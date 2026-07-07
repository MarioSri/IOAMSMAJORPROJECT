import {
  ChatChannel,
  ChatUser,
  ChatMessage,
  ChatNotification,
  SignatureRequest,
  ChatPoll,
  ChatThread,
  UserRole,
  Department,
  AcademicYear,
  MessageType,
  ChatEvent,
  ChatSearchQuery,
  ChatSearchResult,
  ChatSummary,
  OfflineSync
} from '@/types/chat';

class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }

  off(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export class DecentralizedChatService extends SimpleEventEmitter {
  private channel: RealtimeChannel | null = null;
  private isConnected = false;
  private messageQueue: ChatMessage[] = [];
  private offlineMode = false;

  private static readonly STORAGE_KEYS = {
    CHANNELS: 'chat_channels',
    MESSAGES: 'chat_messages',
    USERS: 'chat_users',
    OFFLINE_QUEUE: 'chat_offline_queue',
    LAST_SYNC: 'chat_last_sync',
    ENCRYPTION_KEYS: 'chat_encryption_keys'
  };

  constructor(private wsUrl: string, private apiUrl: string) {
    super();
    this.initializeConnection();
    this.setupOfflineHandling();
    this.setupEncryption();
  }

  private initializeConnection(): void {
    try {
      this.channel = supabase.channel('chat-events', {
        config: { broadcast: { self: true } }
      });

      this.channel
        .on('broadcast', { event: 'chat:event' }, ({ payload }) => {
          this.handleIncomingEvent(payload as ChatEvent);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Chat service connected (Supabase Realtime)');
            this.isConnected = true;
            this.emit('connected');
            this.syncOfflineData();
            this.processMessageQueue();
          } else if (status === 'CLOSED') {
            console.log('Chat service disconnected');
            this.isConnected = false;
            this.emit('disconnected');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Chat service channel error');
            this.emit('error', new Error('Supabase Realtime channel error'));
            this.handleOfflineMode();
          }
        });
    } catch (error) {
      console.error('Failed to initialize chat connection:', error);
      this.handleOfflineMode();
    }
  }

  private handleOfflineMode(): void {
    this.offlineMode = true;
    this.emit('offline-mode');
  }

  private setupOfflineHandling(): void {
    window.addEventListener('online', () => {
      if (this.offlineMode) {
        console.log('Network restored, attempting to reconnect');
        this.offlineMode = false;
        this.initializeConnection();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network lost, switching to offline mode');
      this.handleOfflineMode();
    });
  }

  async initializeRoleBasedChannels(currentUser: ChatUser): Promise<void> {
    const channels = await this.generateRoleBasedChannels(currentUser);

    for (const channel of channels) {
      await this.createChannel(channel);
    }
  }

  private async generateRoleBasedChannels(user: ChatUser): Promise<Partial<ChatChannel>[]> {
    const channels: Partial<ChatChannel>[] = [];

    if (user.role === 'hod') {
      channels.push({
        name: `HODs - All Departments`,
        description: 'Communication channel for all Heads of Department',
        type: 'role-based',
        targetRoles: ['hod'],
        isPrivate: false,
        settings: {
          allowFileUploads: true,
          allowPolls: true,
          allowSignatureRequests: true,
          requireModeration: false,
          autoArchive: false,
          notificationLevel: 'all'
        }
      });

      if (user.department) {
        channels.push({
          name: `HOD - ${user.department} Department`,
          description: `Department-specific channel for ${user.department} HOD`,
          type: 'department',
          department: user.department,
          targetRoles: ['hod', 'faculty', 'employee'],
          isPrivate: false
        });
      }
    }

    if (user.role === 'program-head') {
      channels.push({
        name: 'Program Department Heads',
        description: 'Communication channel for all Program Department Heads',
        type: 'role-based',
        targetRoles: ['program-head'],
        isPrivate: false
      });

      if (user.department) {
        for (let year = 1; year <= 4; year++) {
          channels.push({
            name: `${user.department} - Year ${year}`,
            description: `Academic year ${year} communication for ${user.department}`,
            type: 'department',
            department: user.department,
            academicYear: year as AcademicYear,
            targetRoles: ['program-head', 'faculty', 'hod'],
            isPrivate: false
          });
        }
      }
    }

    if (['registrar', 'principal', 'dean', 'chairman', 'director'].includes(user.role)) {
      channels.push({
        name: 'Administrative Council',
        description: 'High-level administrative communication',
        type: 'role-based',
        targetRoles: ['registrar', 'principal', 'dean', 'chairman', 'director'],
        isPrivate: true,
        settings: {
          allowFileUploads: true,
          allowPolls: true,
          allowSignatureRequests: true,
          requireModeration: true,
          autoArchive: false,
          notificationLevel: 'all'
        }
      });
    }

    if (['faculty', 'employee', 'mentor'].includes(user.role)) {
      if (user.department) {
        channels.push({
          name: `${user.department} Faculty & Staff`,
          description: `Communication channel for ${user.department} faculty and staff`,
          type: 'department',
          department: user.department,
          targetRoles: ['faculty', 'employee', 'mentor', 'hod'],
          isPrivate: false
        });
      }
    }

    const specialRoles = ['controller-examinations', 'asst-dean-iiic', 'head-operations', 'librarian', 'ssg', 'cdc-employee'];
    if (specialRoles.includes(user.role)) {
      channels.push({
        name: 'Administrative Support',
        description: 'Communication channel for administrative support staff',
        type: 'role-based',
        targetRoles: specialRoles as UserRole[],
        isPrivate: false
      });
    }

    channels.push({
      name: 'General Announcements',
      description: 'Institution-wide announcements and updates',
      type: 'general',
      targetRoles: Object.values(['principal', 'registrar', 'program-head', 'hod', 'employee'] as UserRole[]),
      isPrivate: false,
      settings: {
        allowFileUploads: true,
        allowPolls: true,
        allowSignatureRequests: true,
        requireModeration: true,
        autoArchive: false,
        notificationLevel: 'all'
      }
    });

    return channels;
  }

  async createChannel(channelData: Partial<ChatChannel>): Promise<ChatChannel> {
    const channel: ChatChannel = {
      id: this.generateId(),
      members: [],
      admins: [],
      createdBy: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      pinnedMessages: [],
      settings: {
        allowFileUploads: true,
        allowPolls: true,
        allowSignatureRequests: true,
        requireModeration: false,
        autoArchive: false,
        notificationLevel: 'mentions'
      },
      ...channelData
    } as ChatChannel;

    if (this.isConnected) {
      const response = await this.apiCall('/channels', 'POST', channel);
      if (response.success) {
        this.emit('channel-created', response.data);
        return response.data;
      }
    } else {
      this.storeOfflineData('channels', channel);
    }

    return channel;
  }

  async getChannels(userId: string): Promise<ChatChannel[]> {
    if (this.isConnected) {
      const response = await this.apiCall(`/channels?userId=${userId}`, 'GET');
      return response.data || [];
    } else {
      return this.getOfflineData('channels') || [];
    }
  }

  async joinChannel(channelId: string, userId: string): Promise<boolean> {
    if (this.isConnected) {
      const response = await this.apiCall(`/channels/${channelId}/join`, 'POST', { userId });
      return response.success;
    } else {
      this.queueOfflineAction('join-channel', { channelId, userId });
      return true;
    }
  }

  async sendMessage(message: Partial<ChatMessage>): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
      id: this.generateId(),
      timestamp: new Date(),
      status: 'sent',
      reactions: [],
      mentions: [],
      attachments: [],
      readBy: [],
      metadata: {},
      ...message
    } as ChatMessage;

    if (this.isConnected) {
      this.sendWebSocketMessage({
        type: 'message-sent',
        channelId: fullMessage.channelId,
        userId: fullMessage.senderId,
        data: fullMessage,
        timestamp: new Date()
      });
    } else {
      this.messageQueue.push(fullMessage);
      this.storeOfflineData('messages', fullMessage);
    }

    this.emit('message-sent', fullMessage);
    return fullMessage;
  }

  async getMessages(channelId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    if (this.isConnected) {
      const response = await this.apiCall(`/channels/${channelId}/messages?limit=${limit}&offset=${offset}`, 'GET');
      return response.data || [];
    } else {
      const offlineMessages = this.getOfflineData('messages') || [];
      return offlineMessages.filter((msg: ChatMessage) => msg.channelId === channelId);
    }
  }

  async editMessage(messageId: string, newContent: string): Promise<boolean> {
    if (this.isConnected) {
      const response = await this.apiCall(`/messages/${messageId}`, 'PUT', { content: newContent });
      return response.success;
    } else {
      this.queueOfflineAction('edit-message', { messageId, content: newContent });
      return true;
    }
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    if (this.isConnected) {
      const response = await this.apiCall(`/messages/${messageId}`, 'DELETE');
      return response.success;
    } else {
      this.queueOfflineAction('delete-message', { messageId });
      return true;
    }
  }

  async createDocumentThread(documentId: string, channelId: string, title: string): Promise<ChatThread> {
    const thread: ChatThread = {
      id: this.generateId(),
      channelId,
      parentMessageId: '',
      title,
      participants: [],
      messageCount: 0,
      lastActivity: new Date(),
      createdAt: new Date(),
      archived: false
    };

    if (this.isConnected) {
      const response = await this.apiCall('/threads', 'POST', thread);
      return response.data;
    } else {
      this.storeOfflineData('threads', thread);
      return thread;
    }
  }

  async updateDocumentStatus(documentId: string, status: string): Promise<void> {
    const statusMessage: Partial<ChatMessage> = {
      type: 'status-update',
      content: `Document status updated to: ${status}`,
      metadata: {
        documentId,
        documentStatus: status as any
      }
    };

    const channels = await this.getChannelsByDocument(documentId);
    for (const channel of channels) {
      await this.sendMessage({
        ...statusMessage,
        channelId: channel.id,
        senderId: 'system'
      });
    }
  }

  async uploadFile(file: File, channelId: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channelId', channelId);

    if (this.isConnected) {
      const response = await fetch(`${this.apiUrl}/upload`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      return result.url;
    } else {
      return URL.createObjectURL(file);
    }
  }

  async createSignatureRequest(request: Partial<SignatureRequest>): Promise<SignatureRequest> {
    const fullRequest: SignatureRequest = {
      id: this.generateId(),
      status: 'pending',
      signatures: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...request
    } as SignatureRequest;

    if (this.isConnected) {
      const response = await this.apiCall('/signature-requests', 'POST', fullRequest);
      return response.data;
    } else {
      this.storeOfflineData('signature-requests', fullRequest);
      return fullRequest;
    }
  }

  async createPoll(poll: Partial<ChatPoll>): Promise<ChatPoll> {
    const fullPoll: ChatPoll = {
      id: this.generateId(),
      type: 'single-choice',
      options: [],
      allowAnonymous: false,
      status: 'active',
      results: {
        totalVotes: 0,
        breakdown: []
      },
      createdAt: new Date(),
      ...poll
    } as ChatPoll;

    if (this.isConnected) {
      const response = await this.apiCall('/polls', 'POST', fullPoll);
      return response.data;
    } else {
      this.storeOfflineData('polls', fullPoll);
      return fullPoll;
    }
  }

  async votePoll(pollId: string, optionIds: string[], userId: string): Promise<boolean> {
    if (this.isConnected) {
      const response = await this.apiCall(`/polls/${pollId}/vote`, 'POST', { optionIds, userId });
      return response.success;
    } else {
      this.queueOfflineAction('vote-poll', { pollId, optionIds, userId });
      return true;
    }
  }

  async generateSummary(channelId: string, messageCount: number = 50): Promise<ChatSummary> {
    if (this.isConnected) {
      const response = await this.apiCall(`/ai/summarize`, 'POST', { channelId, messageCount });
      return response.data;
    } else {
      const messages = await this.getMessages(channelId, messageCount);
      return this.generateBasicSummary(messages, channelId);
    }
  }

  private generateBasicSummary(messages: ChatMessage[], channelId: string): ChatSummary {
    const participants = [...new Set(messages.map(m => m.senderId))];
    const keyPoints = messages
      .filter(m => m.type === 'text' && m.content.length > 50)
      .slice(0, 5)
      .map(m => m.content);

    return {
      id: this.generateId(),
      channelId,
      messageRange: {
        startMessageId: messages[0]?.id || '',
        endMessageId: messages[messages.length - 1]?.id || '',
        startTime: messages[0]?.timestamp || new Date(),
        endTime: messages[messages.length - 1]?.timestamp || new Date()
      },
      summary: `Summary of ${messages.length} messages from ${participants.length} participants`,
      keyPoints,
      decisions: [],
      actionItems: [],
      participants,
      generatedBy: 'user',
      generatedAt: new Date()
    };
  }

  async searchMessages(query: ChatSearchQuery): Promise<ChatSearchResult> {
    if (this.isConnected) {
      const response = await this.apiCall('/search', 'POST', query);
      return response.data;
    } else {
      return this.searchOfflineMessages(query);
    }
  }

  private searchOfflineMessages(query: ChatSearchQuery): ChatSearchResult {
    const allMessages = this.getOfflineData('messages') || [];
    const filtered = allMessages.filter((message: ChatMessage) => {
      return message.content.toLowerCase().includes(query.query.toLowerCase());
    });

    return {
      messages: filtered,
      channels: [],
      users: [],
      total: filtered.length,
      highlights: filtered.map((msg: ChatMessage) => ({
        messageId: msg.id,
        snippet: msg.content.substring(0, 100),
        matchedTerms: [query.query]
      }))
    };
  }

  async sendNotification(notification: Partial<ChatNotification>): Promise<void> {
    const fullNotification: ChatNotification = {
      id: this.generateId(),
      priority: 'normal',
      read: false,
      createdAt: new Date(),
      ...notification
    } as ChatNotification;

    if (this.isConnected) {
      await this.apiCall('/notifications', 'POST', fullNotification);
    } else {
      this.storeOfflineData('notifications', fullNotification);
    }

    this.emit('notification', fullNotification);
  }

  private setupEncryption(): void {
    const keys = localStorage.getItem(DecentralizedChatService.STORAGE_KEYS.ENCRYPTION_KEYS);
    if (!keys) {
      this.generateEncryptionKeys();
    }
  }

  private generateEncryptionKeys(): void {
    const keyPair = {
      publicKey: this.generateId(),
      privateKey: this.generateId()
    };

    localStorage.setItem(
      DecentralizedChatService.STORAGE_KEYS.ENCRYPTION_KEYS,
      JSON.stringify(keyPair)
    );
  }

  private encryptMessage(message: string, recipientPublicKey: string): string {
    return btoa(message);
  }

  private decryptMessage(encryptedMessage: string, senderPublicKey: string): string {
    return atob(encryptedMessage);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async apiCall(endpoint: string, method: string, data?: any): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: data ? JSON.stringify(data) : undefined
      });

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      return { success: false, error: error.message };
    }
  }

  private getAuthToken(): string {
    return localStorage.getItem('auth_token') || '';
  }

  public sendWebSocketMessage(event: ChatEvent): void {
    if (this.channel && this.isConnected) {
      this.channel.send({
        type: 'broadcast',
        event: 'chat:event',
        payload: event
      });
    }
  }

  private handleIncomingEvent(event: ChatEvent): void {
    switch (event.type) {
      case 'message-sent':
        this.emit('message-received', event.data);
        break;
      case 'user-typing':
        this.emit('user-typing', event.data);
        break;
      case 'user-status-changed':
        this.emit('user-status-changed', event.data);
        break;
      case 'notification-sent':
        this.emit('notification', event.data);
        break;
      default:
        this.emit('event', event);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private async syncOfflineData(): Promise<void> {
    const syncData = this.getOfflineData('sync');
    const offlineSync: OfflineSync = (Array.isArray(syncData) ? syncData[0] : syncData) || {
      userId: '',
      lastSyncTime: new Date(0),
      pendingMessages: [],
      pendingNotifications: [],
      syncStatus: 'pending',
      conflictResolution: 'server-wins'
    };

    if (offlineSync.pendingMessages.length > 0) {
      for (const message of offlineSync.pendingMessages) {
        await this.sendMessage(message);
      }
      offlineSync.pendingMessages = [];
    }

    offlineSync.lastSyncTime = new Date();
    offlineSync.syncStatus = 'synced';
    this.storeOfflineData('sync', offlineSync);
  }

  private storeOfflineData(key: string, data: any): void {
    const existingData = JSON.parse(localStorage.getItem(`${DecentralizedChatService.STORAGE_KEYS.MESSAGES}_${key}`) || '[]');
    existingData.push(data);
    localStorage.setItem(`${DecentralizedChatService.STORAGE_KEYS.MESSAGES}_${key}`, JSON.stringify(existingData));
  }

  private getOfflineData(key: string): any[] {
    return JSON.parse(localStorage.getItem(`${DecentralizedChatService.STORAGE_KEYS.MESSAGES}_${key}`) || '[]');
  }

  private queueOfflineAction(action: string, data: any): void {
    const actions = this.getOfflineData('actions');
    actions.push({ action, data, timestamp: new Date() });
    this.storeOfflineData('actions', { action, data, timestamp: new Date() });
  }

  private async getChannelsByDocument(documentId: string): Promise<ChatChannel[]> {
    const channels = await this.getChannels('');
    return channels.filter(channel => channel.documentId === documentId);
  }

  public disconnect(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }

  public isOnline(): boolean {
    return this.isConnected && !this.offlineMode;
  }

  public getConnectionStatus(): string {
    if (this.isConnected) return 'connected';
    if (this.offlineMode) return 'offline';
    return 'connecting';
  }
}
