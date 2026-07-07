import React from 'react';
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback 
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  MessageCircle, 
  Copy, 
  Reply, 
  Edit, 
  Trash2, 
  ThumbsUp, 
  MoreVertical, 
  FileText, 
  Image, 
  Download, 
  PenTool, 
  ChartBar, 
  Check, 
  ChevronRight, 
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ChatMessage, 
  ChatUser, 
  ChatChannel, 
  ChatPoll, 
  MessageAttachment, 
  MessageReaction 
} from '@/types/chat';
import { 
  formatTimestamp, 
  getMessageStatusIcon, 
  getPollResults 
} from './chatUtils';

interface MessageComponentProps {
  message: ChatMessage;
  user: any; // Using any to accommodate different User object structures from auth
  users: ChatUser[];
  messages: ChatMessage[];
  selectedMessages: string[];
  pinnedMessages: string[];
  editingMessage: ChatMessage | null;
  setEditingMessage: (m: ChatMessage | null) => void;
  setReplyingTo: (m: ChatMessage | null) => void;
  handleEditMessage: (id: string, content: string) => void;
  handleDeleteMessage: (id: string) => void;
  handleDownloadFile: (attachment: MessageAttachment) => void;
  handleVoteOnPoll: (message: ChatMessage, optionId: string) => void;
  handleReplyPrivately: (message: ChatMessage) => void;
  handleReactToMessage: (id: string, emoji: string) => void;
  setSelectedPollId: (id: string | null) => void;
  setShowPollVotesModal: (show: boolean) => void;
  handleCopyMessage: (m: ChatMessage) => void;
  activeChannel: ChatChannel | null;
}

export const MessageComponent: React.FC<MessageComponentProps> = ({ 
  message, 
  user, 
  users, 
  messages,
  selectedMessages,
  pinnedMessages,
  editingMessage,
  setEditingMessage,
  setReplyingTo,
  handleEditMessage,
  handleDeleteMessage,
  handleDownloadFile,
  handleVoteOnPoll,
  handleReplyPrivately,
  handleReactToMessage,
  setSelectedPollId,
  setShowPollVotesModal,
  handleCopyMessage,
  activeChannel
}) => {
  const isOwnMessage = message.senderId === user?.id;
  const isSystemMessage = message.senderId === 'system';
  const sender = users.find(u => u.id === message.senderId);

  return (
    <div className={cn(
      "flex gap-2 sm:gap-3 p-1.5 sm:p-2 hover:bg-muted/50 group",
      isOwnMessage && "flex-row-reverse",
      isSystemMessage && "justify-center",
      selectedMessages.includes(message.id) && "bg-blue-50 border-l-4 border-l-blue-500",
      pinnedMessages.includes(message.id) && "bg-yellow-50 border border-yellow-200"
    )}>
      {!isSystemMessage && (
        <Avatar className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
          <AvatarImage src={sender?.avatar} />
          <AvatarFallback className="bg-muted flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn(
        "flex-1 min-w-0",
        isOwnMessage && "text-right",
        isSystemMessage && "text-center"
      )}>
        {!isSystemMessage && (
          <div className={cn("flex items-center gap-1.5 sm:gap-2 mb-1", isOwnMessage && "justify-end")}>
            <span className="text-xs sm:text-sm font-medium">
              {isOwnMessage ? 'You' : sender?.fullName || 'User'}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              {formatTimestamp(message.timestamp)}
            </span>
            {message.editedAt && (
              <span className="text-[10px] sm:text-xs text-muted-foreground">(edited)</span>
            )}
            {getMessageStatusIcon(message.status)}
          </div>
        )}

        {message.parentMessageId && (() => {
          const parentMsg = messages.find(m => m.id === message.parentMessageId);
          const parentSender = users.find(u => u.id === parentMsg?.senderId);
          return (
            <div className={cn(
              "text-xs mb-2 p-2 bg-muted/60 border-l-2 border-l-primary rounded-r-md truncate max-w-[90%]",
              isOwnMessage ? "ml-auto" : ""
            )}>
              <span className="font-semibold block mb-0.5 text-[10px] text-primary uppercase tracking-tighter">
                {parentSender?.fullName || 'User'}
              </span>
              <span className="italic opacity-80 text-[11px]">
                {parentMsg?.content || 'Message unavailable'}
              </span>
            </div>
          );
        })()}

        {message.metadata?.replyToPrivate && (
          <div className="text-xs text-purple-600 mb-2 p-2 bg-purple-50 border border-purple-200 rounded flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span className="font-medium">Private Reply</span>
            <span className="text-purple-500">
              • Re: "{message.metadata.originalMessageContent}"
            </span>
          </div>
        )}

        {editingMessage?.id === message.id ? (
          <div className={cn(
            "inline-block p-3 rounded-lg w-full",
            message.metadata.pollId ? "max-w-full" : "max-w-[80%]",
            isOwnMessage
              ? "bg-gray-200 text-gray-900"
              : "bg-muted"
          )}>
            <div className="space-y-2">
              <Textarea
                value={editingMessage.content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingMessage({ ...editingMessage, content: e.target.value })}
                className="min-h-[60px] w-full resize-none text-base sm:text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setEditingMessage(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleEditMessage(message.id, editingMessage.content)}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn(
            "inline-block p-2.5 sm:p-3 rounded-lg shadow-sm border sm:border-none",
            message.metadata?.pollId ? "max-w-full" : "max-w-[85%] sm:max-w-[80%]",
            isSystemMessage
              ? "bg-blue-50 text-blue-800 border-blue-200 text-xs sm:text-sm"
              : isOwnMessage
                ? "bg-primary/10 sm:bg-gray-200 text-foreground sm:text-gray-900 border-primary/20"
                : "bg-muted text-foreground border-muted-foreground/10"
          )}>
            <p className={cn(
              "whitespace-pre-wrap",
              isSystemMessage ? "text-sm font-medium" : "text-sm"
            )}>
              {message.content}
            </p>

            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.attachments.map((attachment: MessageAttachment) => (
                  <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded hover:bg-muted/70 transition-colors">
                    {attachment.type === 'image' ? (
                      <Image className="w-4 h-4 text-blue-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-green-500" />
                    )}
                    <span
                      className="text-sm cursor-pointer hover:underline flex-1"
                      onClick={() => handleDownloadFile(attachment)}
                      title={`Click to download ${attachment.name}`}
                    >
                      {attachment.name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadFile(attachment)}
                      title={`Download ${attachment.name}`}
                      className="hover:bg-primary/10"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {message.metadata.signatureRequestId && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border text-left">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  <span className="text-sm font-medium">Signature Request</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Please review and sign the attached document
                </p>
                <Button size="sm" className="mt-2">
                  View & Sign
                </Button>
              </div>
            )}

            {message.type === 'poll' && message.metadata.poll && (() => {
              const poll = message.metadata.poll as ChatPoll;
              const pollResults = getPollResults(poll);
              const userVotedOptions = poll.options.filter(opt => opt.votes.some(v => v.userId === user?.id));

              return (
                <div className="mt-2 p-3.5 sm:p-5 bg-background border rounded-xl shadow-sm max-w-[340px] sm:max-w-md md:max-w-lg w-full text-left">
                  <div className="space-y-4">
                    {/* Poll Header */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <ChartBar className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base leading-tight">{poll.title}</h4>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {poll.type === 'multiple-choice' ? 'Select one or more' : 'Select one'}
                        </p>
                      </div>
                    </div>

                    {/* Poll Options */}
                    <div className="space-y-3">
                      {pollResults.options.map((option) => {
                        const isSelected = userVotedOptions.some(opt => opt.id === option.id);

                        return (
                          <div key={option.id} className="relative group">
                            <button
                              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all relative z-10 
                                ${isSelected ? 'bg-green-500/10' : 'hover:bg-muted/50'}`}
                              onClick={() => handleVoteOnPoll(message, option.id)}
                            >
                              {/* Selection Marker */}
                              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                                ${isSelected ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                              </div>

                              <div className="flex-1 text-left">
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`text-sm sm:text-[15px] font-medium transition-colors ${isSelected ? 'text-green-700 dark:text-green-400' : ''}`}>
                                    {option.text}
                                  </span>
                                  {option.votes.length > 0 && (
                                    <span className="text-[11px] font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                      {option.votes.length}
                                    </span>
                                  )}
                                </div>

                                {/* Progress Bar Container */}
                                <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden relative">
                                  <div
                                    className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-full
                                      ${isSelected ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
                                    style={{ width: `${option.percentage}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Poll Footer */}
                    <div className="pt-2 border-t flex items-center justify-between">
                      <div className="flex -space-x-1.5 px-1">
                        {/* Mini avatars of voters */}
                        {poll.options.flatMap(o => o.votes).slice(0, 3).map((vote, i) => (
                          <Avatar key={`${vote.userId}-${i}`} className="w-5 h-5 border-2 border-background">
                            <AvatarFallback className="text-[8px] bg-muted-foreground/20">
                              {vote.userId.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {pollResults.uniqueVotersCount > 3 && (
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] text-muted-foreground border-2 border-background">
                            +{pollResults.uniqueVotersCount - 3}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs font-semibold text-primary hover:bg-primary/5 flex items-center gap-1.5"
                        onClick={() => {
                          setSelectedPollId(message.id);
                          setShowPollVotesModal(true);
                        }}
                      >
                        View Votes
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <div className={cn("flex gap-1 mt-1", isOwnMessage ? "justify-end" : "justify-start")}>
            {message.reactions.map((reaction: MessageReaction) => (
              <Button
                key={reaction.emoji}
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => handleReactToMessage(message.id, reaction.emoji)}
              >
                {reaction.emoji} {reaction.count}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!isSystemMessage && (
        <div className="opacity-100 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 self-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleCopyMessage(message)}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </DropdownMenuItem>
              {!isOwnMessage && activeChannel && !(activeChannel.isPrivate && activeChannel.name.includes('-private-')) && (
                <DropdownMenuItem onClick={() => {
                  handleReplyPrivately(message);
                }}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Reply Privately
                </DropdownMenuItem>
              )}
              {isOwnMessage && (
                <>
                  <DropdownMenuItem onClick={() => setEditingMessage(message)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteMessage(message.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => {
                handleReactToMessage(message.id, '👍');
              }}>
                <ThumbsUp className="w-4 h-4 mr-2" />
                React
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};
