import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MessageReaction } from '@/types/chat';

export interface DbChatChannel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_private: boolean;
  created_by: string;
  members: string[];
  admins: string[];
  document_id?: string | null;
  workflow_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy aliases kept for backwards compatibility
export type ChatChannel = DbChatChannel;

export interface DbChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  parent_message_id?: string | null;
  metadata?: any;
  attachments?: any[];
  reactions?: MessageReaction[];
  mentions?: string[];
  created_at: string;
  updated_at: string;
}

// Legacy alias kept for backwards compatibility
export type ChatMessage = DbChatMessage;

class DepartmentChatService {
  private channelsChannel: RealtimeChannel | null = null;
  private messagesChannel: RealtimeChannel | null = null;

  async getChannels(userId: string): Promise<DbChatChannel[]> {
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .contains('members', [userId])
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createChannel(channel: Omit<DbChatChannel, 'id' | 'created_at' | 'updated_at'>): Promise<DbChatChannel> {
    const { data, error } = await supabase
      .from('chat_channels')
      .insert([channel])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateChannel(id: string, updates: Partial<DbChatChannel>): Promise<DbChatChannel> {
    const { data, error } = await supabase
      .from('chat_channels')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteChannel(id: string): Promise<void> {
    const { error } = await supabase
      .from('chat_channels')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getMessages(channelId: string): Promise<DbChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async sendMessage(message: Omit<DbChatMessage, 'id' | 'created_at' | 'updated_at'>): Promise<DbChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([message])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMessage(id: string, content: string): Promise<DbChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMessageMetadata(id: string, metadata: any): Promise<DbChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMessage(id: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  subscribeToChannels(
    userId: string,
    onInsert: (channel: DbChatChannel) => void,
    onUpdate: (channel: DbChatChannel) => void,
    onDelete: (id: string) => void
  ): () => void {
    this.channelsChannel = supabase
      .channel(`chat_channels:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_channels'
        },
        (payload) => onInsert(payload.new as DbChatChannel)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_channels'
        },
        (payload) => onUpdate(payload.new as DbChatChannel)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_channels'
        },
        (payload) => onDelete((payload.old as DbChatChannel).id)
      )
      .subscribe();

    return () => {
      this.channelsChannel?.unsubscribe();
      this.channelsChannel = null;
    };
  }

  subscribeToMessages(
    channelId: string,
    onInsert: (message: DbChatMessage) => void,
    onUpdate: (message: DbChatMessage) => void,
    onDelete: (id: string) => void
  ): () => void {
    this.messagesChannel = supabase
      .channel(`chat_messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => onInsert(payload.new as DbChatMessage)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => onUpdate(payload.new as DbChatMessage)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => onDelete((payload.old as DbChatMessage).id)
      )
      .subscribe();

    return () => {
      this.messagesChannel?.unsubscribe();
      this.messagesChannel = null;
    };
  }

  /**
   * Resolve role_recipients UUIDs (from recipient_ids[]) to Supabase auth UIDs.
   * Returns only entries where supabase_uid is populated.
   */
  async resolveRecipientIdsToAuthIds(recipientIds: string[]): Promise<string[]> {
    if (!recipientIds.length) return [];
    const { data, error } = await supabase
      .from('role_recipients')
      .select('supabase_uid')
      .in('id', recipientIds)
      .not('supabase_uid', 'is', null);

    if (error) {
      console.error('[DepartmentChatService] resolveRecipientIdsToAuthIds error:', error);
      return [];
    }
    return (data || []).map((r) => r.supabase_uid as string).filter(Boolean);
  }

  /**
   * Resolve recipient display names to Supabase auth UIDs.
   * Used for emergency documents where recipients are stored as names.
   */
  async resolveRecipientNamesToAuthIds(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const { data, error } = await supabase
      .from('role_recipients')
      .select('supabase_uid')
      .in('name', names)
      .not('supabase_uid', 'is', null);

    if (error) {
      console.error('[DepartmentChatService] resolveRecipientNamesToAuthIds error:', error);
      return [];
    }
    return (data || []).map((r) => r.supabase_uid as string).filter(Boolean);
  }

  /**
   * Find an existing channel for a given document_id, or null if none exists.
   */
  async getChannelByDocumentId(documentId: string): Promise<DbChatChannel | null> {
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('document_id', documentId)
      .maybeSingle();

    if (error) {
      console.error('[DepartmentChatService] getChannelByDocumentId error:', error);
      return null;
    }
    return data;
  }
}

export const departmentChatService = new DepartmentChatService();
