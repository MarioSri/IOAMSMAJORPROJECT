import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

class SocketChatService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private globalChannel: RealtimeChannel | null = null;
  private _isConnected = false;

  async connect(_userRole?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('[SocketChatService] No auth token available');
      return;
    }

    this.globalChannel = supabase.channel('chat-global');
    this.globalChannel.subscribe((status) => {
      this._isConnected = status === 'SUBSCRIBED';
      if (status === 'SUBSCRIBED') {
        console.log('[SocketChatService] Supabase Realtime connected');
      }
    });
  }

  joinChannel(channelId: string) {
    if (this.channels.has(channelId)) return;
    const ch = supabase.channel(`chat:${channelId}`);
    ch.subscribe();
    this.channels.set(channelId, ch);
  }

  leaveChannel(channelId: string) {
    const ch = this.channels.get(channelId);
    if (ch) {
      ch.unsubscribe();
      this.channels.delete(channelId);
    }
  }

  async sendMessage(channelId: string, content: string, messageType: string = 'text') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('chat_messages').insert({
      channel_id: channelId,
      sender_id: session.user.id,
      content,
      message_type: messageType
    });
  }

  async sendTyping(channelId: string) {
    const ch = this.channels.get(channelId) || supabase.channel(`chat:${channelId}`);
    await ch.send({ type: 'broadcast', event: 'typing', payload: {} });
  }

  onNewMessage(channelId: string, callback: (message: any) => void): () => void {
    const ch = this.channels.get(channelId);
    if (!ch) return () => {};
    const sub = supabase
      .channel(`new-msg:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`
      }, (payload) => callback(payload.new))
      .subscribe();
    return () => sub.unsubscribe();
  }

  onUserTyping(channelId: string, callback: (data: any) => void): () => void {
    const sub = supabase
      .channel(`typing:${channelId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => callback(payload))
      .subscribe();
    return () => sub.unsubscribe();
  }

  onError(callback: (error: any) => void) {
    // Errors are surfaced via supabase client; no-op for API compatibility
  }

  disconnect() {
    this.channels.forEach((ch) => ch.unsubscribe());
    this.channels.clear();
    this.globalChannel?.unsubscribe();
    this.globalChannel = null;
    this._isConnected = false;
  }

  isConnected() {
    return this._isConnected;
  }
}

export const socketChatService = new SocketChatService();
