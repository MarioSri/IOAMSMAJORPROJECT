import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  Users,
  Circle,
  Phone,
  Video,
  MoreHorizontal,
  ArrowRight,
  Zap
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: string;
  senderRole: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'document' | 'meeting' | 'emergency';
  urgent: boolean;
  read: boolean;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'department' | 'role' | 'project' | 'emergency';
  participants: string[];
  lastMessage: ChatMessage;
  unreadCount: number;
  isActive: boolean;
}

interface ChatWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call to fetch chat rooms based on role
    const fetchChatRooms = async () => {
      setLoading(true);

      // Fetch chat rooms from Supabase
      const rooms: ChatRoom[] = [];
      setTimeout(() => {
        setChatRooms(rooms);
        setLoading(false);
      }, 600);
    };

    fetchChatRooms();
  }, [userRole, user]);

  const totalUnread = chatRooms.reduce((sum, room) => sum + room.unreadCount, 0);
  const emergencyRooms = chatRooms.filter(room => room.type === 'emergency' && room.unreadCount > 0);

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'emergency': return <Zap className="w-4 h-4 text-destructive" />;
      case 'department': return <Users className="w-4 h-4 text-blue-500" />;
      case 'role': return <Users className="w-4 h-4 text-purple-500" />;
      case 'project': return <MessageSquare className="w-4 h-4 text-green-500" />;
      default: return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Real-Time Communication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "shadow-elegant hover:shadow-glow transition-all duration-300",
      isSelected && "border-primary",
      isCustomizing && "cursor-pointer"
    )} onClick={onSelect}>
      <CardHeader className={cn(isMobile && "pb-3")}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <MessageSquare className="w-5 h-5 text-primary" />
            Department Communication Hub
            <div className="flex gap-1">
              {totalUnread > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {totalUnread}
                </Badge>
              )}
              {emergencyRooms.length > 0 && (
                <Badge variant="warning" className="text-xs">
                  {emergencyRooms.length} emergency
                </Badge>
              )}
            </div>
          </CardTitle>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/messages")}
            className={cn(isMobile && "text-xs")}
          >
            <ArrowRight className="w-4 h-4 mr-1" />
            Open Chat
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className={cn(isMobile ? "h-48" : "h-64")}>
          <div className="space-y-2">
            {chatRooms.slice(0, isMobile ? 4 : 6).map((room, index) => (
              <div
                key={room.id}
                className={cn(
                  "p-3 border rounded-lg hover:bg-accent transition-all cursor-pointer animate-fade-in",
                  room.type === 'emergency' && room.unreadCount > 0 && "border-destructive bg-red-50",
                  room.unreadCount > 0 && "border-l-4 border-l-primary"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => setSelectedRoom(room.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getRoomIcon(room.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className={cn(
                        "font-medium line-clamp-1",
                        isMobile ? "text-sm" : "text-base"
                      )}>
                        {room.name}
                      </h5>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          room.isActive ? "bg-success animate-pulse" : "bg-muted-foreground"
                        )} />
                        {room.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {room.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className={cn(
                      "text-muted-foreground line-clamp-2",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      <span className="font-medium">{room.lastMessage.sender}:</span>{' '}
                      {room.lastMessage.message}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {getTimeAgo(room.lastMessage.timestamp)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {room.participants.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency indicator */}
                {room.type === 'emergency' && room.unreadCount > 0 && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-red-100 rounded border border-red-200">
                    <Zap className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Emergency Communication
                    </span>
                  </div>
                )}
              </div>
            ))}

            {chatRooms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className={cn(isMobile ? "text-sm" : "text-base")}>
                  No active conversations
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Message Input */}
        <div className="pt-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Quick message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className={cn("flex-1", isMobile && "h-10")}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newMessage.trim()) {
                  // Handle quick message send
                  setNewMessage('');
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newMessage.trim()}
              className={cn(isMobile && "h-10 w-10 p-0")}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Communication Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className={cn(
              "font-bold text-primary",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {chatRooms.length}
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Rooms
            </p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className={cn(
              "font-bold text-warning",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {totalUnread}
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Unread
            </p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className={cn(
              "font-bold text-success",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {chatRooms.filter(room => room.isActive).length}
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Active
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};