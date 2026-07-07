import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { recipientService } from '@/services/RecipientService';
import { departmentChatService } from '@/services/DepartmentChatService';
import { useChatChannels, useChatMessages } from '@/hooks/useDepartmentChat';
import { ChatPushService } from '@/services/ChatPushService';
import {
  ChatChannel,
  ChatMessage,
  ChatUser,
  MessageType,
  ChatNotification,
  SignatureRequest,
  ChatPoll,
  MessageAttachment,
  UserRole,
  MessageReaction
} from '@/types/chat';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import { MessageComponent } from './MessageComponent';
import { 
  formatTimestamp, 
  getMessageStatusIcon, 
  getPollResults 
} from './chatUtils';

import {
  Check,
  ChevronRight,
  Send,
  SendHorizontal,
  Smile,

  Settings,
  Search,
  Hash,
  Lock,
  Users,
  Bell,
  BellOff,
  Pin,
  MoreVertical,
  Reply,
  Edit,
  Trash2,
  FileText,
  Image,
  Download,
  Eye,
  ThumbsUp,
  MessageCircle,
  PenTool,
  BarChart3,
  ChartBar,
  Zap,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Menu,
  PanelRightOpen,
  PanelLeftOpen,
  X,
  Plus,
  UserPlus,
  UserRoundPlus,
  Copy,
  CheckSquare,
  Clock
} from 'lucide-react';

import EmojiPicker, { Theme } from 'emoji-picker-react';

interface ChatInterfaceProps {
  className?: string;
  channelMessageCounts?: { [key: string]: number };
  onChannelRead?: (channelId: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ className, channelMessageCounts = {}, onChannelRead }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useResponsive();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // fileInputRef removed — file uploads are disabled
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);

  // Supabase integration
  const { channels: supabaseChannels, loading: channelsLoading, createChannel: createSupabaseChannel } = useChatChannels(user?.id, user?.role);
  const { messages: supabaseMessages, loading: messagesLoading, sendMessage: sendSupabaseMessage } = useChatMessages(activeChannel?.id, user?.role);

  // All channels and messages come from Supabase
  const channels = supabaseChannels;
  const messages = supabaseMessages;
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<ChatUser[]>([]);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [connectionStatus] = useState<string>('connected');
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  useEffect(() => {
    if (isMobile) {
      setShowSidebar(false);
    }
  }, [isMobile]);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelRecipients, setNewChannelRecipients] = useState<string[]>([]);
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);
  const [showAddRecipientsModal, setShowAddRecipientsModal] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedChannelsToDelete, setSelectedChannelsToDelete] = useState<string[]>([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const [showChannelMembersModal, setShowChannelMembersModal] = useState(false);
  const [selectedChannelForMembers, setSelectedChannelForMembers] = useState<ChatChannel | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);
  const [showPollVotesModal, setShowPollVotesModal] = useState(false);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [privateReplyTo, setPrivateReplyTo] = useState<ChatMessage | null>(null);
  const [showPrivateReplyModal, setShowPrivateReplyModal] = useState(false);
  const [privateReplyMessage, setPrivateReplyMessage] = useState('');

  // Resolved display names for private channels (keyed by channel.id)
  const [channelDisplayNames, setChannelDisplayNames] = useState<Record<string, string>>({});
  const resolvedChannelIds = useRef<Set<string>>(new Set());

  // Resolved member names (keyed by Supabase auth UID) for the members modal and inline panel
  const [memberNamesCache, setMemberNamesCache] = useState<Record<string, { name: string; role: string }>>({});
  const resolvedMemberUids = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const filteredMessages = useMemo(() => {
    if (!activeChannel) return [];
    return messages.filter(message =>
      !searchQuery ||
      message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (users.find(u => u.id === message.senderId)?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery, users, activeChannel]);

  const defaultChannels = useMemo(() => {
    return [];
  }, []);

  const defaultUsers = useMemo(() => {
    return [];
  }, []);



  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const loadSupabaseRecipients = async () => {
      setRecipientsLoading(true);
      setRecipientsError(null);
      try {
        const recipients = await recipientService.fetchRecipients();
        if (cancelled) return;

        const chatUsers: ChatUser[] = recipients.map(r => ({
          id: r.id,
          username: r.email.split('@')[0],
          email: r.email,
          fullName: r.name,
          role: r.role as UserRole,
          department: r.department as any,
          isOnline: false,
          lastSeen: new Date(),
          status: 'available' as const,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.name}`
        }));

        const currentUserInList = chatUsers.find(u => u.email === user.email || u.id === user.id);
        if (!currentUserInList) {
          chatUsers.unshift({
            id: user.id,
            username: user.email.split('@')[0],
            email: user.email,
            fullName: user.name || 'You',
            role: user.role as UserRole,
            isOnline: true,
            lastSeen: new Date(),
            status: 'available' as const,
            avatar: ''
          });
        }

        setAvailableRecipients(chatUsers);
        setUsers(chatUsers);
      } catch (error) {
        if (cancelled) return;
        console.error('[ChatInterface] Failed to load recipients from Supabase:', error);
        setRecipientsError('Failed to load recipients from database');
        const selfUser: ChatUser = {
          id: user.id,
          username: user.email.split('@')[0],
          email: user.email,
          fullName: user.name || 'You',
          role: user.role as UserRole,
          isOnline: true,
          lastSeen: new Date(),
          status: 'available' as const,
          avatar: ''
        };
        setAvailableRecipients([selfUser]);
        setUsers([selfUser]);
      } finally {
        if (!cancelled) setRecipientsLoading(false);
      }
    };

    loadSupabaseRecipients();
    return () => { cancelled = true; };
  }, [user]);

  // Resolve display names for private channels (UUID-named) using RecipientService
  useEffect(() => {
    if (!user || !channels.length) return;

    const pending = channels.filter(
      ch => ch.isPrivate && ch.name.includes('-private-') && !resolvedChannelIds.current.has(ch.id)
    );
    if (!pending.length) return;

    let cancelled = false;
    const resolveNames = async () => {
      const updates: Record<string, string> = {};
      for (const ch of pending) {
        if (cancelled) break;
        resolvedChannelIds.current.add(ch.id);
        const parts = ch.name.split('-private-');
        const otherUid = parts[0] === user.id ? parts[1] : parts[0];
        const inList = users.find(u => u.id === otherUid);
        if (inList?.fullName) {
          updates[ch.id] = inList.fullName;
          continue;
        }
        try {
          const recipient = await recipientService.getRecipientBySupabaseUid(otherUid);
          updates[ch.id] = recipient?.name ?? 'Private Chat';
        } catch {
          updates[ch.id] = 'Private Chat';
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setChannelDisplayNames(prev => ({ ...prev, ...updates }));
      }
    };

    resolveNames();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, users, user?.id]);

  // Resolve Supabase auth UIDs → { name, role } for channel members displayed in modal/panel
  useEffect(() => {
    const pollVoterIds = messages
      .filter(m => m.type === 'poll' && m.metadata?.poll)
      .flatMap(m => (m.metadata.poll as ChatPoll).options.flatMap(o => o.votes.map(v => v.userId)));

    const memberIds = [
      ...(selectedChannelForMembers?.members ?? []),
      ...(showMembers && activeChannel ? activeChannel.members : []),
      ...pollVoterIds
    ].filter((id, i, arr) => arr.indexOf(id) === i); // dedupe

    if (!memberIds.length || !user) return;

    const pending = memberIds.filter(
      id => id !== user.id && !resolvedMemberUids.current.has(id)
    );
    if (!pending.length) return;

    let cancelled = false;
    const resolveMembers = async () => {
      const updates: Record<string, { name: string; role: string }> = {};
      for (const uid of pending) {
        if (cancelled) break;
        resolvedMemberUids.current.add(uid);
        try {
          const recipient = await recipientService.getRecipientBySupabaseUid(uid);
          updates[uid] = recipient
            ? { name: recipient.name, role: recipient.role }
            : { name: 'Unknown User', role: 'Member' };
        } catch {
          updates[uid] = { name: 'Unknown User', role: 'Member' };
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setMemberNamesCache(prev => ({ ...prev, ...updates }));
      }
    };

    resolveMembers();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannelForMembers, showMembers, activeChannel?.id, user?.id]);

  // Auto-clear unread count for the active channel as soon as it becomes active or new message arrives
  useEffect(() => {
    if (activeChannel?.id) {
      onChannelRead?.(activeChannel.id);
    }
  }, [activeChannel?.id, onChannelRead, messages.length]);

  // Supabase Realtime is the transport — no Socket.IO connection needed
  useEffect(() => {
    if (!user) return;
    // No-op: connection status is permanently 'connected' via Supabase Realtime
  }, [user]);

  // Returns the human-readable display name for a channel.
  // For private channels stored as "uid1-private-uid2", resolves the other participant's name.
  const getChannelDisplayName = useCallback((channel: ChatChannel): string => {
    if (channel.isPrivate && channel.name.includes('-private-')) {
      return channelDisplayNames[channel.id] ?? channel.name;
    }
    return channel.name;
  }, [channelDisplayNames]);

  // Wraps setActiveChannel so the parent can clear the unread badge for that channel
  const handleSelectChannel = useCallback((channel: ChatChannel) => {
    setActiveChannel(channel);
    onChannelRead?.(channel.id);
  }, [onChannelRead]);

  const scrollToBottom = useCallback((force = false) => {
    if (force) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }
  }, []);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeChannel || !user) return;

    try {
      await sendSupabaseMessage({
        channel_id: activeChannel.id,
        sender_id: user.id,
        content: messageInput.trim(),
        message_type: 'text',
        parent_message_id: replyingTo?.id || null
      });
      // Notify other channel members via FCM push
      ChatPushService.dispatch({
        channel_id: activeChannel.id,
        exclude_user_id: user.id,
        title: `#${getChannelDisplayName(activeChannel)}`,
        body: messageInput.trim().slice(0, 120),
        action_url: `${window.location.origin}/messages`,
      }).catch(err => console.error('[ChatPush] message push failed:', err));
      setMessageInput('');
      setReplyingTo(null);
      scrollToBottom(true);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message: ' + String(error),
        variant: 'destructive'
      });
    }
  };

  // File uploads are paused in the current phase — Google Drive integration is planned for a future release
  const handleFileUpload = (_event: React.ChangeEvent<HTMLInputElement>) => {
    toast({
      title: 'File Upload Unavailable',
      description: 'File uploading will be available in a future release.',
      variant: 'default'
    });
  };

  // Removed inline utility functions - now imported from chatUtils.tsx
  // getFileType moved if needed, but only used here.
  const getFileType = (file: File): MessageType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.includes('pdf') || file.type.includes('document')) return 'document';
    return 'file' as MessageType;
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await departmentChatService.updateMessage(messageId, newContent);
      setEditingMessage(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to edit message',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await departmentChatService.deleteMessage(messageId);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive'
      });
    }
  };

  const handleCreateSignatureRequest = async () => {
    if (!activeChannel || !user) return;

    try {
      await sendSupabaseMessage({
        channel_id: activeChannel.id,
        sender_id: user.id,
        content: '🖊️ Signature request created. Please review and sign the document.',
        message_type: 'signature-request'
      });
      ChatPushService.dispatch({
        channel_id: activeChannel.id,
        exclude_user_id: user.id,
        title: `Signature Request in #${getChannelDisplayName(activeChannel)}`,
        body: 'A signature request has been created. Please review and sign the document.',
        action_url: `${window.location.origin}/messages`,
      }).catch(err => console.error('[ChatPush] signature push failed:', err));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create signature request',
        variant: 'destructive'
      });
    }
  };

  const handleCreatePoll = async (title: string, options: string[]) => {
    if (!activeChannel || !user) return;

    const pollId = `poll-${Date.now()}`;
    const poll: ChatPoll = {
      id: pollId,
      messageId: '', // Will be updated after sending message
      channelId: activeChannel.id,
      createdBy: user.id,
      title,
      options: options.map((option, index) => ({
        id: `option-${index}`,
        text: option,
        votes: []
      })),
      type: allowMultipleAnswers ? 'multiple-choice' : 'single-choice',
      allowAnonymous: false,
      status: 'active',
      results: { totalVotes: 0, breakdown: [] },
      createdAt: new Date()
    };

    try {
      await sendSupabaseMessage({
        channel_id: activeChannel.id,
        sender_id: user.id,
        content: `📊 Poll: ${title}`,
        message_type: 'poll',
        metadata: {
          pollId,
          poll
        }
      });

      ChatPushService.dispatch({
        channel_id: activeChannel.id,
        exclude_user_id: user.id,
        title: `New Poll in #${getChannelDisplayName(activeChannel)}`,
        body: `Poll: ${title}`,
        action_url: `${window.location.origin}/messages`,
      }).catch(err => console.error('[ChatPush] poll push failed:', err));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create poll',
        variant: 'destructive'
      });
    }
  };

  const handleVoteOnPoll = async (message: ChatMessage, optionId: string) => {
    if (!user || message.type !== 'poll' || !message.metadata.poll) return;

    const poll = message.metadata.poll as ChatPoll;
    const isMultiple = poll.type === 'multiple-choice';

    const updatedOptions = poll.options.map(option => {
      const isTargetOption = option.id === optionId;
      const hasVotedThisOption = option.votes.some(v => v.userId === user.id);

      if (isTargetOption) {
        return {
          ...option,
          votes: hasVotedThisOption
            ? option.votes.filter(v => v.userId !== user.id)
            : [...option.votes, { userId: user.id, optionId, timestamp: new Date().toISOString() }]
        };
      } else if (!isMultiple) {
        // If single choice, remove user's vote from all other options
        return {
          ...option,
          votes: option.votes.filter(v => v.userId !== user.id)
        };
      }
      return option;
    });

    const updatedPoll = {
      ...poll,
      options: updatedOptions
    };

    try {
      await departmentChatService.updateMessageMetadata(message.id, {
        ...message.metadata,
        poll: updatedPoll
      });
    } catch (error) {
      toast({
        title: 'Voting Error',
        description: 'Failed to record your vote.',
        variant: 'destructive'
      });
    }
  };

  // getPollResults removed - now imported from chatUtils.tsx

  const showNotification = (notification: Partial<ChatNotification>) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title || 'New Message', {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  };

  const handleDownloadFile = async (attachment: any) => {
    try {
      if (!attachment.url || attachment.url.includes('placeholder')) {
        toast({
          title: "Download Error",
          description: "This file is not available for download",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error('File not found');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: `Downloaded ${attachment.name}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Unable to download file',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteChannels = async () => {
    if (selectedChannelsToDelete.length === 0 || !user) return;

    try {
      await Promise.all(selectedChannelsToDelete.map(id => departmentChatService.deleteChannel(id)));

      if (activeChannel && selectedChannelsToDelete.includes(activeChannel.id)) {
        const remainingChannels = channels.filter(channel => !selectedChannelsToDelete.includes(channel.id));
        setActiveChannel(remainingChannels.length > 0 ? remainingChannels[0] : null);
      }

      toast({
        title: 'Channels Deleted',
        description: `${selectedChannelsToDelete.length} channel(s) deleted successfully`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete channels',
        variant: 'destructive'
      });
    }

    setSelectedChannelsToDelete([]);
    setDeleteMode(false);
    setShowDeleteConfirmation(false);
  };

  // getMessageStatusIcon removed - now imported from chatUtils.tsx

  // formatTimestamp removed - now imported from chatUtils.tsx

  const handleCopyMessage = (message: ChatMessage) => {
    navigator.clipboard.writeText(message.content);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard',
      variant: 'default'
    });
  };

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessages(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  };

  const handlePinMessage = (messageId: string) => {
    setPinnedMessages(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
    const isPinned = pinnedMessages.includes(messageId);
    toast({
      title: isPinned ? 'Unpinned' : 'Pinned',
      description: `Message ${isPinned ? 'unpinned' : 'pinned'} successfully`,
      variant: 'default'
    });
  };

  const handleReplyPrivately = (message: ChatMessage) => {
    setPrivateReplyTo(message);
    setShowPrivateReplyModal(true);

    toast({
      title: 'Private Reply',
      description: `Starting private conversation with ${users.find(u => u.id === message.senderId)?.fullName || 'user'}`,
      variant: 'default'
    });
  };

  const handleSendPrivateReply = async () => {
    if (!privateReplyTo || !privateReplyMessage.trim() || !user) return;

    try {
      // Create or find private channel with the sender
      const recipientId = privateReplyTo.senderId;
      const recipient = users.find(u => u.id === recipientId);

      if (!recipient) {
        toast({
          title: 'Error',
          description: 'Could not find the recipient user',
          variant: 'destructive'
        });
        return;
      }

      // Create a private channel name that's consistent regardless of who creates it
      const channelName = [user.id, recipientId].sort().join('-private-');

      // Check if private channel already exists
      let privateChannel = channels.find(ch => ch.name === channelName && ch.isPrivate);

      if (!privateChannel) {
        // Create new private channel via Supabase directly
        const dbChannel = await departmentChatService.createChannel({
          name: channelName,
          description: `Private chat between ${user.name || 'You'} and ${recipient.fullName}`,
          type: 'private',
          is_private: true,
          members: [user.id, recipientId],
          admins: [user.id, recipientId],
          created_by: user.id
        });
        // Map DbChatChannel to ChatChannel shape expected by setActiveChannel
        privateChannel = channels.find(ch => ch.id === dbChannel.id) ?? ({
          ...dbChannel,
          isPrivate: true,
          createdBy: dbChannel.created_by,
          createdAt: new Date(dbChannel.created_at),
          updatedAt: new Date(dbChannel.updated_at),
          pinnedMessages: [],
          settings: { allowFileUploads: false, allowPolls: false, allowSignatureRequests: true, requireModeration: false, autoArchive: false, notificationLevel: 'all' }
        } as ChatChannel);
      }

      // Send the private reply with reference to original message
      await sendSupabaseMessage({
        channel_id: privateChannel.id,
        sender_id: user.id,
        content: privateReplyMessage,
        message_type: 'text'
      });

      // Switch to the private channel
      handleSelectChannel(privateChannel);

      // Clear the private reply state
      setPrivateReplyMessage('');
      setPrivateReplyTo(null);
      setShowPrivateReplyModal(false);

      toast({
        title: 'Private Reply Sent',
        description: `Your private message was sent to ${recipient.fullName}`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Failed to send private reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to send private reply',
        variant: 'destructive'
      });
    }
  };



  const handleReactToMessage = async (messageId: string, emoji: string = '👍') => {
    if (!user) return;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = [...(message.reactions || [])];
    const reactionIndex = currentReactions.findIndex(r => r.emoji === emoji);

    let updatedReactions: MessageReaction[];

    if (reactionIndex > -1) {
      const reaction = currentReactions[reactionIndex];
      const userIndex = reaction.userIds.indexOf(user.id);
      if (userIndex > -1) {
        // Remove reaction
        const newUserIds = reaction.userIds.filter(id => id !== user.id);
        if (newUserIds.length === 0) {
          updatedReactions = currentReactions.filter(r => r.emoji !== emoji);
        } else {
          updatedReactions = currentReactions.map(r => r.emoji === emoji 
            ? { ...r, userIds: newUserIds, count: newUserIds.length }
            : r
          );
        }
      } else {
        // Add user to existing reaction
        updatedReactions = currentReactions.map(r => r.emoji === emoji 
          ? { ...r, userIds: [...r.userIds, user.id], count: r.userIds.length + 1 }
          : r
        );
      }
    } else {
      // Add new reaction type
      updatedReactions = [...currentReactions, { emoji, userIds: [user.id], count: 1 }];
    }

    try {
      // Optimistically we could update state, but useChatMessages hook listens for changes
      await departmentChatService.updateMessageMetadata(message.id, {
        ...message.metadata,
        reactions: updatedReactions // We'll store it in metadata if 'reactions' column is tricky
      });
      
      // Update: Since I added reactions to DbChatMessage, let's try to update the reactions directly
      // However the service updateMessageMetadata is generic. Let's see if we can add updateReactions.
      // For now, let's stick to metadata as it's safe.
    } catch (error) {
      console.error('Error reacting to message:', error);
      toast({
        title: 'Error',
        description: 'Failed to add reaction',
        variant: 'destructive'
      });
    }
  };

  // MessageComponent extracted to standalone file.

  const ChannelSidebar: React.FC = () => (
    <>
      {/* Mobile Overlay */}
      {showSidebar && (
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 sm:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
      <div className={cn(
        "border-r bg-background flex flex-col transition-all duration-300 ease-in-out",
        "absolute inset-y-0 left-0 z-30 h-full sm:relative",
        showSidebar ? "w-[85vw] sm:w-64 translate-x-0 shadow-xl sm:shadow-none" : "-translate-x-full w-0 sm:w-0 sm:translate-x-0 overflow-hidden"
      )}>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <h3 className="font-semibold flex-shrink-0 text-sm">Channels</h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 sm:hidden"
                onClick={() => setShowSidebar(false)}
              >
                <X className="w-4 h-4" />
              </Button>
              {deleteMode ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDeleteMode(false);
                      setSelectedChannelsToDelete([]);
                    }}
                    className="whitespace-nowrap h-8 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirmation(true)}
                    disabled={selectedChannelsToDelete.length === 0}
                    className="whitespace-nowrap h-8 px-2 text-xs"
                  >
                    Delete ({selectedChannelsToDelete.length})
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteMode(true)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="mt-2 p-2 bg-yellow-500/10 rounded-md border border-yellow-500/20">
            <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Auto-delete: Channels after 7 days</span>
            </p>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {recipientsLoading && (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Loading channels...</p>
              </div>
            )}
            {recipientsError && (
              <div className="p-3 text-center">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{recipientsError}</p>
              </div>
            )}
            {channels.length === 0 && !recipientsLoading && (
              <div className="p-4 text-center">
                <MessageCircle className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No Channels Yet</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Create A New Channel To Start Chatting</p>
              </div>
            )}
            {channels.map(channel => (
              <div key={channel.id} className="flex items-center gap-1">
                {deleteMode && (
                  <input
                    type="checkbox"
                    checked={selectedChannelsToDelete.includes(channel.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChannelsToDelete(prev => [...prev, channel.id]);
                      } else {
                        setSelectedChannelsToDelete(prev => prev.filter(id => id !== channel.id));
                      }
                    }}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                )}
                <Button
                  variant={activeChannel?.id === channel.id ? "secondary" : "ghost"}
                  className="flex-1 justify-start min-w-0"
                  onClick={() => {
                    if (!deleteMode) {
                      handleSelectChannel(channel);
                      if (isMobile) setShowSidebar(false); // Close sidebar on mobile
                    }
                  }}
                  disabled={deleteMode}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{getChannelDisplayName(channel)}</span>
                    {channelMessageCounts[channel.id] > 0 && (
                      <Badge variant="destructive" className="ml-auto px-1 py-0 text-xs flex-shrink-0">
                        {channelMessageCounts[channel.id]}
                      </Badge>
                    )}
                  </div>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => {
                    setSelectedChannelForMembers(channel);
                    setShowChannelMembersModal(true);
                  }}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-center"
            onClick={() => setShowSidebar(false)}
          >
            <PanelLeftOpen className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className={cn("flex h-[88vh] sm:h-full bg-background relative overflow-hidden", className)}>
      <ChannelSidebar />

      <div className="flex-1 flex flex-col">
        {/* Members Panel */}
        {showMembers && activeChannel && (
          <div className="p-4 border-b bg-muted/20">
            <h3 className="font-semibold mb-3">Channel Members ({activeChannel.members.length})</h3>
            <div className="flex flex-wrap gap-2">
              {activeChannel.members.map(memberId => {
                const isMe = memberId === user?.id;
                const name = isMe
                  ? (user?.name || 'You')
                  : (memberNamesCache[memberId]?.name ?? '…');
                const role = isMe
                  ? (user?.role || 'member')
                  : (memberNamesCache[memberId]?.role ?? 'Member');
                return (
                  <div key={memberId} className="flex items-center gap-2 p-2 bg-background rounded border">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">
                        {name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{name}</span>
                    <Badge variant="outline" className="text-xs">{role}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Channel Header */}
        <div className="p-3 sm:p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!showSidebar && (
                <Button size="sm" variant="ghost" onClick={() => setShowSidebar(true)}>
                  <PanelRightOpen className="w-5 h-5" />
                </Button>
              )}
              {activeChannel ? (
                <>
                  <Lock className="w-5 h-5" />
                  <div>
                    <h2 className="font-semibold">{getChannelDisplayName(activeChannel)}</h2>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {activeChannel.members.length} members
                      </p>
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20 px-1 sm:px-2 h-5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="hidden xs:inline">Auto-delete: 24h</span>
                      </Badge>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 text-blue-500" />
                  <div>
                    <h2 className="font-semibold">Communication Hub</h2>
                    <p className="text-xs text-muted-foreground">Select a channel to begin communicating</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowSearch(!showSearch)} className="h-8 w-8 p-0" title="Search Messages">
                <Search className="w-4 h-4" />
              </Button>

              <div className="hidden sm:flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setShowNewChannelModal(true)} className="h-8 w-8 p-0" title="New Channel">
                  <Lock className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddRecipientsModal(true)} className="h-8 w-8 p-0" title="Add Recipient">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>

              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowNewChannelModal(true)}>
                      <Lock className="w-4 h-4 mr-2" /> New Channel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowAddRecipientsModal(true)}>
                      <UserPlus className="w-4 h-4 mr-2" /> Add Recipient
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="p-2 sm:p-4 border-b bg-muted/20">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 sm:h-10 text-base sm:text-sm"
            />
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-2 sm:p-4">
          <div className="space-y-1.5 sm:space-y-2">
            {activeChannel ? (
              <>
                {filteredMessages.map(message => (
                  <MessageComponent 
                    key={message.id} 
                    message={message}
                    user={user}
                    users={users}
                    messages={messages}
                    selectedMessages={selectedMessages}
                    pinnedMessages={pinnedMessages}
                    editingMessage={editingMessage}
                    setEditingMessage={setEditingMessage}
                    setReplyingTo={setReplyingTo}
                    handleEditMessage={handleEditMessage}
                    handleDeleteMessage={handleDeleteMessage}
                    handleDownloadFile={handleDownloadFile}
                    handleVoteOnPoll={handleVoteOnPoll}
                    handleReplyPrivately={handleReplyPrivately}
                    handleReactToMessage={handleReactToMessage}
                    setSelectedPollId={setSelectedPollId}
                    setShowPollVotesModal={setShowPollVotesModal}
                    handleCopyMessage={handleCopyMessage}
                    activeChannel={activeChannel}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="h-[65vh] sm:h-[500px] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Welcome To Your Chat Hub</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Start A New Conversation To Begin.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => setShowNewChannelModal(true)} className="gap-2">
                    <Lock className="w-4 h-4" /> New Channel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddRecipientsModal(true)} className="gap-2">
                    <UserPlus className="w-4 h-4" /> Start DM
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Reply Bar */}
        {replyingTo && (
          <div className="p-2 bg-muted/50 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Reply className="w-4 h-4" />
              <span className="text-sm">Replying to {replyingTo.content}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
              ×
            </Button>
          </div>
        )}

        {/* Message Input */}
        <div className="p-2 sm:p-4 border-t bg-background">
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Actions: Desktop View */}
            <div className="hidden sm:flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPollModal(true)}
                className="h-9 w-9 p-0"
                title="Create poll"
              >
                <ChartBar className="w-4 h-4 text-green-600" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="h-9 w-9 p-0"
                title="Emojis"
              >
                <Smile className="w-4 h-4" />
              </Button>
            </div>

            {/* Actions: Mobile View */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                    <ChartBar className="w-4 h-4 text-green-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-48">
                  <DropdownMenuItem onClick={() => setShowPollModal(true)}>
                    <ChartBar className="w-4 h-4 mr-2 text-green-600" /> Create Poll
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    <Smile className="w-4 h-4 mr-2" /> Emojis
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 relative">
              <Textarea
                placeholder={`Message ${activeChannel?.name || 'channel'}...`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="min-h-[40px] max-h-[120px] resize-none pr-10 text-base sm:text-sm"
              />

              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="fixed bottom-[80px] left-[4vw] right-[4vw] z-[100] sm:absolute sm:bottom-full sm:left-0 sm:right-auto sm:mb-4 sm:translate-x-0 w-auto sm:w-[350px] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                >
                  <style>{`
                    .EmojiPickerReact.epr-main {
                      border: none !important;
                      --epr-search-input-padding-left: 40px;
                    }
                    .EmojiPickerReact .epr-search-container {
                      padding: 12px !important;
                    }
                    .EmojiPickerReact .epr-category-nav {
                      padding: 10px 0 !important;
                      margin-bottom: 0 !important;
                    }
                    @media (max-width: 640px) {
                      .EmojiPickerReact .epr-body {
                        padding-top: 0 !important;
                      }
                    }
                  `}</style>
                  <div className="bg-background rounded-2xl border-2 border-muted overflow-hidden shadow-2xl">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setMessageInput(prev => prev + emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                      autoFocusSearch={false}
                      theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                      searchPlaceholder="Search emojis..."
                      width="100%"
                      height={isMobile ? 380 : 400}
                      lazyLoadEmojis={true}
                      skinTonesDisabled={true}
                      previewConfig={{
                        showPreview: false
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
            >
              <SendHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* New Channel Modal */}
      <Dialog open={showNewChannelModal} onOpenChange={setShowNewChannelModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-yellow-500" />
                Create New Channel
              </DialogTitle>
              <DialogDescription>
                Create a new chat channel and add recipients.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Channel Name</Label>
                <Input
                  placeholder="Enter channel name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="px-3 py-2 text-base sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Add Recipients</Label>
                <ScrollArea className="h-64 border rounded-md p-2">
                  {recipientsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Loading recipients...</p>
                      </div>
                    </div>
                  ) : availableRecipients.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Users className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No recipients available</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Recipients are not configured in the database
                        </p>
                      </div>
                    </div>
                  ) : (
                    availableRecipients.map((person) => (
                      <div key={person.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {(person.fullName || person.username).split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{person.fullName || person.username}</p>
                            <p className="text-xs text-muted-foreground">{person.role}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (newChannelRecipients.includes(person.id)) {
                              setNewChannelRecipients(newChannelRecipients.filter(id => id !== person.id));
                            } else {
                              setNewChannelRecipients([...newChannelRecipients, person.id]);
                            }
                          }}
                        >
                          {newChannelRecipients.includes(person.id) ? 'Remove' : 'Add'}
                        </Button>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
              {newChannelRecipients.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Selected Recipients ({newChannelRecipients.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {newChannelRecipients.map(id => (
                      <div key={id} className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full">
                        <UserRoundPlus className="w-4 h-4" />
                        <span className="text-sm font-medium">{availableRecipients.find(r => r.id === id)?.fullName || availableRecipients.find(r => r.id === id)?.username || id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => {
                setShowNewChannelModal(false);
                setNewChannelName('');
                setNewChannelRecipients([]);
                setIsPrivateChannel(false);
              }} className="w-full sm:w-auto">Cancel</Button>
              <Button
                onClick={async () => {
                  if (newChannelName.trim() && newChannelRecipients.length > 0 && user) {
                    try {
                      const resolvedRecipientIds = await departmentChatService.resolveRecipientIdsToAuthIds(newChannelRecipients);
                      if (resolvedRecipientIds.length < newChannelRecipients.length) {
                        const unlinked = newChannelRecipients.length - resolvedRecipientIds.length;
                        toast({ title: 'Warning', description: `${unlinked} recipient(s) could not be added — their accounts are not yet linked.`, variant: 'default' });
                      }
                      console.log('Creating channel:', { name: newChannelName, members: [user.id, ...resolvedRecipientIds] });
                      const createdChannel = await createSupabaseChannel({
                        name: newChannelName.trim(),
                        description: '',
                        type: 'general',
                        is_private: true,
                        created_by: user.id,
                        members: [user.id, ...resolvedRecipientIds],
                        admins: [user.id]
                      });
                      console.log('Channel created successfully');

                      // Notify invited members via FCM push
                      if (createdChannel) {
                        ChatPushService.dispatch({
                          channel_id: createdChannel.id,
                          exclude_user_id: user.id,
                          title: `Added to channel: ${newChannelName.trim()}`,
                          body: `${user.name ?? 'Someone'} added you to a new chat channel.`,
                          action_url: `${window.location.origin}/messages`,
                        }).catch(err => console.error('[ChatPush] new channel push failed:', err));
                      }

                      setNewChannelName('');
                      setNewChannelRecipients([]);
                      setIsPrivateChannel(false);
                      setShowNewChannelModal(false);
                    } catch (error) {
                      console.error('Failed to create channel:', error);
                      toast({ title: 'Error', description: String(error), variant: 'destructive' });
                    }
                  }
                }}
                disabled={!newChannelName.trim() || newChannelRecipients.length === 0}
                className="w-full sm:w-auto"
              >
                Create Channel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Votes Modal */}
      <Dialog open={showPollVotesModal} onOpenChange={setShowPollVotesModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Poll Results
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown of votes for each option.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              {(() => {
                const message = messages.find(m => m.id === selectedPollId);
                const poll = message?.metadata.poll as ChatPoll;
                if (!poll) return null;

                return poll.options.map((option) => (
                  <div key={option.id} className="space-y-3">
                    <div className="flex justify-between items-center bg-muted/20 p-2 rounded-lg">
                      <span className="font-semibold text-[15px]">{option.text}</span>
                      <Badge variant="secondary" className="px-2 py-0.5">
                        {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <div className="pl-2 space-y-2">
                      {option.votes.length > 0 ? (
                        option.votes.map((vote) => {
                          const voterInfo = vote.userId === user?.id
                            ? { name: user?.name || 'You', role: user?.role || 'User' }
                            : memberNamesCache[vote.userId] || { name: 'Unknown User', role: 'Member' };

                          return (
                            <div key={vote.userId} className="flex items-center gap-3 py-1">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-[10px] bg-muted-foreground/10 uppercase">
                                  {voterInfo.name.substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {voterInfo.name}
                                  {vote.userId === user?.id && <span className="ml-1 text-[10px] text-muted-foreground font-normal">(You)</span>}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{voterInfo.role}</span>
                                  <span className="text-[10px] text-muted-foreground/40">•</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(vote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground italic pl-2">No votes yet</p>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
            <DialogFooter className="mt-6">
              <Button onClick={() => setShowPollVotesModal(false)}>Close</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Recipients Modal */}
      <Dialog open={showAddRecipientsModal} onOpenChange={setShowAddRecipientsModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Add Recipients
              </DialogTitle>
              <DialogDescription>
                Select recipients to start a direct chat.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Available Staff</Label>
                <ScrollArea className="h-64 border rounded-md p-2">
                  {recipientsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Loading staff...</p>
                      </div>
                    </div>
                  ) : availableRecipients.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Users className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No staff available</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Staff data is not configured in the database
                        </p>
                      </div>
                    </div>
                  ) : (
                    availableRecipients.map((person) => (
                      <div key={person.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {(person.fullName || person.username).split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{person.fullName || person.username}</p>
                            <p className="text-xs text-muted-foreground">{person.role}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedRecipients.includes(person.id)) {
                              setSelectedRecipients(selectedRecipients.filter(id => id !== person.id));
                            } else {
                              setSelectedRecipients([...selectedRecipients, person.id]);
                            }
                          }}
                        >
                          {selectedRecipients.includes(person.id) ? 'Remove' : 'Add'}
                        </Button>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
              {selectedRecipients.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Selected Recipients ({selectedRecipients.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipients.map(id => (
                      <div key={id} className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full">
                        <UserRoundPlus className="w-4 h-4" />
                        <span className="text-sm font-medium">{availableRecipients.find(r => r.id === id)?.fullName || availableRecipients.find(r => r.id === id)?.username || id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => {
                setShowAddRecipientsModal(false);
                setSelectedRecipients([]);
              }} className="w-full sm:w-auto">Cancel</Button>
              <Button
                onClick={async () => {
                  if (selectedRecipients.length > 0 && user) {
                    try {
                      const resolvedDirectIds = await departmentChatService.resolveRecipientIdsToAuthIds(selectedRecipients);
                      if (resolvedDirectIds.length < selectedRecipients.length) {
                        const unlinked = selectedRecipients.length - resolvedDirectIds.length;
                        toast({ title: 'Warning', description: `${unlinked} recipient(s) could not be added — their accounts are not yet linked.`, variant: 'default' });
                      }
                      const channelName = selectedRecipients
                        .map(id => availableRecipients.find(r => r.id === id)?.fullName || availableRecipients.find(r => r.id === id)?.username || id)
                        .join(', ');
                      await createSupabaseChannel({
                        name: channelName,
                        description: 'Direct Message Group',
                        type: 'private',
                        is_private: true,
                        created_by: user.id,
                        members: [user.id, ...resolvedDirectIds],
                        admins: [user.id]
                      });

                      setSelectedRecipients([]);
                      setShowAddRecipientsModal(false);
                    } catch (error) {
                      console.error('Failed to start chat:', error);
                    }
                  }
                }}
                disabled={selectedRecipients.length === 0}
                className="w-full sm:w-auto"
              >
                Start Chat
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Poll Creation Modal */}
      <Dialog open={showPollModal} onOpenChange={setShowPollModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChartBar className="w-5 h-5 text-green-600" />
                Create Poll
              </DialogTitle>
              <DialogDescription>
                Create a poll for the channel members to vote on.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Poll Question</Label>
                <Input
                  placeholder="What's your question?"
                  value={pollTitle}
                  onChange={(e) => setPollTitle(e.target.value)}
                  className="px-3 py-2 text-base sm:text-sm"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Allow multiple answers</Label>
                  <p className="text-xs text-muted-foreground">Members can vote for more than one option</p>
                </div>
                <Switch
                  checked={allowMultipleAnswers}
                  onCheckedChange={setAllowMultipleAnswers}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Options</Label>
                <div className="space-y-3">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollOptions];
                          newOptions[index] = e.target.value;
                          setPollOptions(newOptions);
                        }}
                        className="text-base sm:text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="mt-2 text-primary hover:text-primary/80"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Option
                </Button>
              </div>
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => {
                setShowPollModal(false);
                setPollTitle('');
                setPollOptions(['', '']);
              }} className="w-full sm:w-auto">Cancel</Button>
              <Button
                onClick={() => {
                  const validOptions = pollOptions.filter(opt => opt.trim());
                  if (pollTitle.trim() && validOptions.length >= 2) {
                    handleCreatePoll(pollTitle.trim(), validOptions);
                    setPollTitle('');
                    setPollOptions(['', '']);
                    setAllowMultipleAnswers(false);
                    setShowPollModal(false);
                  }
                }}
                disabled={!pollTitle.trim() || pollOptions.filter(opt => opt.trim()).length < 2}
                className="w-full sm:w-auto"
              >
                Create Poll
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channels</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedChannelsToDelete.length} channel(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannels}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Channel Members Modal */}
      <Dialog open={showChannelMembersModal} onOpenChange={setShowChannelMembersModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              View Members in Channel Group
            </DialogTitle>
            <DialogDescription>
              {selectedChannelForMembers ? getChannelDisplayName(selectedChannelForMembers) : ''} • Total Members: {selectedChannelForMembers?.members?.length || 0}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Channel Group Members</label>
              <ScrollArea className="h-64 border rounded-md p-2">
                {selectedChannelForMembers?.members?.map((memberId) => {
                  // Resolve display info: current user first, then async cache, then placeholder
                  const getMemberInfo = (id: string) => {
                    if (id === user?.id) {
                      return { fullName: user?.name || 'You', role: user?.role || 'User' };
                    }
                    const cached = memberNamesCache[id];
                    if (cached) {
                      return { fullName: cached.name, role: cached.role };
                    }
                    return { fullName: '…', role: 'Member' };
                  };

                  const memberInfo = getMemberInfo(memberId);
                  const isCurrentUser = memberId === user?.id || memberId === user?.name;
                  const isAdmin = selectedChannelForMembers?.admins?.includes(memberId);

                  return (
                    <div key={memberId} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {memberInfo.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {memberInfo.fullName}
                            {isCurrentUser && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {memberInfo.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        )}
                        {selectedChannelForMembers?.createdBy === memberId && (
                          <Badge variant="secondary" className="text-xs">
                            Creator
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>




      {/* Private Reply Modal */}
      <Dialog open={showPrivateReplyModal} onOpenChange={setShowPrivateReplyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply Privately</DialogTitle>
            <DialogDescription>
              Send a private message to {privateReplyTo ? users.find(u => u.id === privateReplyTo.senderId)?.fullName || 'user' : 'user'}
            </DialogDescription>
          </DialogHeader>

          {/* Original message reference */}
          {privateReplyTo && (
            <div className="bg-muted/50 rounded-lg p-3 border-l-4 border-blue-500 mb-4">
              <div className="text-sm text-muted-foreground mb-1">
                Original message from {users.find(u => u.id === privateReplyTo.senderId)?.fullName || 'user'}:
              </div>
              <div className="text-sm">
                {privateReplyTo.content.length > 150
                  ? privateReplyTo.content.substring(0, 150) + '...'
                  : privateReplyTo.content
                }
              </div>
            </div>
          )}

          {/* Private reply input */}
          <div className="space-y-4">
            <Textarea
              placeholder="Type your private reply..."
              value={privateReplyMessage}
              onChange={(e) => setPrivateReplyMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && privateReplyMessage.trim()) {
                  e.preventDefault();
                  handleSendPrivateReply();
                }
              }}
              className="min-h-[120px] text-base sm:text-sm"
            />
            <div className="text-xs text-muted-foreground">
              Press Ctrl+Enter to send
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPrivateReplyModal(false);
                setPrivateReplyMessage('');
                setPrivateReplyTo(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendPrivateReply}
              disabled={!privateReplyMessage.trim()}
            >
              Send Private Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
