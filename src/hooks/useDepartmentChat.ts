import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { departmentChatService, DbChatChannel, DbChatMessage } from '@/services/DepartmentChatService';
import type { ChatChannel, ChatMessage } from '@/types/chat';
import { useToast } from './use-toast';
import { safeSetItem } from '@/utils/localStorageCache';
import { useVisibilityRefetch } from './useVisibilityRefetch';

// ---- Mappers: DB types → App types ----

function mapDbChannelToAppChannel(db: DbChatChannel): ChatChannel {
  return {
    id: db.id,
    name: db.name,
    description: db.description ?? '',
    type: (db.type as ChatChannel['type']) || 'general',
    members: db.members,
    admins: db.admins,
    isPrivate: db.is_private,
    createdBy: db.created_by,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
    pinnedMessages: [],
    settings: {
      allowFileUploads: false,
      allowPolls: true,
      allowSignatureRequests: true,
      requireModeration: false,
      autoArchive: false,
      notificationLevel: 'all',
    },
  };
}

function mapDbMessageToAppMessage(db: DbChatMessage): ChatMessage {
  return {
    id: db.id,
    channelId: db.channel_id,
    senderId: db.sender_id,
    type: (db.message_type as ChatMessage['type']) || 'text',
    content: db.content,
    parentMessageId: db.parent_message_id || undefined,
    timestamp: new Date(db.created_at),
    editedAt: db.updated_at !== db.created_at ? new Date(db.updated_at) : undefined,
    status: 'delivered',
    reactions: db.metadata?.reactions || db.reactions || [],
    mentions: db.mentions || [],
    attachments: db.attachments || [],
    metadata: db.metadata || {},
    readBy: [],
  };
}

// ── Synchronous cache read so channels are visible on the very first render ────
function readChannelsCache(userId: string | undefined): DbChatChannel[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`chat_channels_cache_${userId}`);
    if (!raw) return [];
    return JSON.parse(raw) as DbChatChannel[];
  } catch {
    return [];
  }
}

export function useChatChannels(userId: string | undefined, userRole?: string) {
  // Initialise from cache — data is available before the first Supabase response
  const [dbChannels, setDbChannels] = useState<DbChatChannel[]>(() => readChannelsCache(userId));
  // Only show loading spinner when the cache is empty
  const [loading, setLoading] = useState<boolean>(() => readChannelsCache(userId).length === 0);
  const { toast } = useToast();

  const loadChannels = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const data = await departmentChatService.getChannels(userId);
      setDbChannels(data);
      safeSetItem(`chat_channels_cache_${userId}`, JSON.stringify(data.slice(0, 20)));
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Re-fetch whenever returning to the tab
  useVisibilityRefetch(loadChannels, !!userId);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = departmentChatService.subscribeToChannels(
      userId,
      (newChannel) => {
        if (newChannel.members.includes(userId)) {
          setDbChannels((prev) => {
            const updated = [newChannel, ...prev].slice(0, 20);
            safeSetItem(`chat_channels_cache_${userId}`, JSON.stringify(updated));
            return updated;
          });
        }
      },
      (updatedChannel) => {
        setDbChannels((prev) => {
          const updated = prev.map((c) => c.id === updatedChannel.id ? updatedChannel : c);
          safeSetItem(`chat_channels_cache_${userId}`, JSON.stringify(updated.slice(0, 20)));
          return updated;
        });
      },
      (deletedId) => {
        setDbChannels((prev) => {
          const updated = prev.filter((c) => c.id !== deletedId);
          safeSetItem(`chat_channels_cache_${userId}`, JSON.stringify(updated));
          return updated;
        });
      }
    );

    const handleFocus = () => loadChannels();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, loadChannels]);

  const createChannel = useCallback(async (channelData: Omit<DbChatChannel, 'id' | 'created_at' | 'updated_at'>): Promise<DbChatChannel | null> => {
    try {
      const created = await departmentChatService.createChannel(channelData);
      toast({ title: 'Channel Created', description: `${channelData.name} has been created` });
      return created;
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast({ title: 'Error', description: 'Failed to create channel', variant: 'destructive' });
      return null;
    }
  }, [toast]);

  const updateChannel = useCallback(async (id: string, updates: Partial<DbChatChannel>) => {
    try {
      await departmentChatService.updateChannel(id, updates);
    } catch (error) {
      console.error('Failed to update channel:', error);
      toast({ title: 'Error', description: 'Failed to update channel', variant: 'destructive' });
    }
  }, [toast]);

  const deleteChannel = useCallback(async (id: string) => {
    try {
      await departmentChatService.deleteChannel(id);
      toast({ title: 'Channel Deleted', description: 'Channel removed successfully' });
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast({ title: 'Error', description: 'Failed to delete channel', variant: 'destructive' });
    }
  }, [toast]);

  const channels: ChatChannel[] = dbChannels.map(mapDbChannelToAppChannel);

  return { channels, loading, createChannel, updateChannel, deleteChannel };
}

// ── Synchronous cache read for messages ───────────────────────────────────────
function readMessagesCache(channelId: string | undefined): DbChatMessage[] {
  if (!channelId) return [];
  try {
    const raw = localStorage.getItem(`chat_messages_cache_${channelId}`);
    if (!raw) return [];
    return JSON.parse(raw) as DbChatMessage[];
  } catch {
    return [];
  }
}

export function useChatMessages(channelId: string | undefined, userRole?: string) {
  // Initialise from cache — messages are visible before the first Supabase response
  const [dbMessages, setDbMessages] = useState<DbChatMessage[]>(() => readMessagesCache(channelId));
  // Only show loading spinner when the cache is empty
  const [loading, setLoading] = useState<boolean>(() => readMessagesCache(channelId).length === 0);
  const { toast } = useToast();

  const loadMessages = useCallback(async () => {
    if (!channelId) {
      setLoading(false);
      return;
    }

    try {
      const data = await departmentChatService.getMessages(channelId);
      setDbMessages(data);
      safeSetItem(`chat_messages_cache_${channelId}`, JSON.stringify(data.slice(-100)));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Re-fetch whenever returning to tab
  useVisibilityRefetch(loadMessages, !!channelId);

  useEffect(() => {
    if (!channelId) return;

    const unsubscribe = departmentChatService.subscribeToMessages(
      channelId,
      (newMessage) => {
        setDbMessages((prev) => {
          const updated = [...prev, newMessage].slice(-100);
          safeSetItem(`chat_messages_cache_${channelId}`, JSON.stringify(updated));
          return updated;
        });
      },
      (updatedMessage) => {
        setDbMessages((prev) => {
          const updated = prev.map((m) => m.id === updatedMessage.id ? updatedMessage : m);
          safeSetItem(`chat_messages_cache_${channelId}`, JSON.stringify(updated.slice(-100)));
          return updated;
        });
      },
      (deletedId) => {
        setDbMessages((prev) => {
          const updated = prev.filter((m) => m.id !== deletedId);
          safeSetItem(`chat_messages_cache_${channelId}`, JSON.stringify(updated));
          return updated;
        });
      }
    );

    const handleFocus = () => loadMessages();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [channelId, loadMessages]);

  const sendMessage = useCallback(async (messageData: Omit<DbChatMessage, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await departmentChatService.sendMessage(messageData);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({ 
        title: 'Error', 
        description: `Failed to send message: ${error.message || 'Unknown error'}`, 
        variant: 'destructive' 
      });
      throw error;
    }
  }, [toast]);

  const updateMessage = useCallback(async (id: string, content: string) => {
    try {
      await departmentChatService.updateMessage(id, content);
    } catch (error) {
      console.error('Failed to update message:', error);
      toast({ title: 'Error', description: 'Failed to update message', variant: 'destructive' });
    }
  }, [toast]);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      await departmentChatService.deleteMessage(id);
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  }, [toast]);

  const updateMessageMetadata = useCallback(async (id: string, metadata: any) => {
    try {
      await departmentChatService.updateMessageMetadata(id, metadata);
    } catch (error) {
      console.error('Failed to update message metadata:', error);
      toast({ title: 'Error', description: 'Failed to update message metadata', variant: 'destructive' });
    }
  }, [toast]);

  const messages: ChatMessage[] = dbMessages.map(mapDbMessageToAppMessage);

  return { messages, loading, sendMessage, updateMessage, deleteMessage, updateMessageMetadata };
}

export function useChatStats(userId: string | undefined) {
  const [totalChannels, setTotalChannels] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const loadInitialData = useCallback(async () => {
    if (!userId) return;

    const { count, error } = await supabase
      .from('chat_channels')
      .select('*', { count: 'exact', head: true })
      .contains('members', [userId]);

    if (!error && count !== null) setTotalChannels(count);
  }, [userId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useVisibilityRefetch(loadInitialData, !!userId);

  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel(`stats_channels_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_channels' },
        (payload) => {
          const next = payload.new as DbChatChannel;
          if (Array.isArray(next.members) && next.members.includes(userId)) {
            setTotalChannels(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_channels' },
        () => setTotalChannels(prev => Math.max(0, prev - 1))
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') loadInitialData();
      });

    const presenceCh = supabase.channel('presence_chat', {
      config: { presence: { key: userId } },
    });

    presenceCh
      .on('presence', { event: 'sync' }, () => {
        const state = presenceCh.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceCh.track({ userId, online_at: new Date().toISOString() });
        } else if (status === 'CHANNEL_ERROR') {
          // No action needed specifically for presence error, handled by global refresh
        }
      });

    const msgSub = supabase
      .channel(`stats_messages_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as DbChatMessage;
          if (msg && msg.sender_id !== userId) {
            setUnreadCounts((prev) => {
              const currentCount = prev[msg.channel_id] || 0;
              return { ...prev, [msg.channel_id]: currentCount + 1 };
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') loadInitialData();
      });

    const handleFocus = () => loadInitialData();
    window.addEventListener('focus', handleFocus);

    return () => {
      ch.unsubscribe();
      presenceCh.unsubscribe();
      msgSub.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, loadInitialData]);

  const clearUnread = useCallback((channelId: string) => {
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
  }, []);

  return { totalChannels, onlineUsers, unreadCounts, clearUnread };
}
