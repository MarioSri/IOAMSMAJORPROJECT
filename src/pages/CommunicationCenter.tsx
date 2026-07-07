import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { PollManager } from '@/components/chat/PollManager';
import { SignatureManager } from '@/components/signature/SignatureManager';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DecentralizedChatService } from '@/services/DecentralizedChatService';
import { ChatNotification } from '@/types/chat';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Users,
  BarChart3,
  PenTool,
  Bell,
  BellOff,
  Settings,
  Shield,
  Zap,
  TrendingUp,
  FileText,
  Send,
  Vote,
  Brain,
  Hash,
  Lock
} from 'lucide-react';

export default function CommunicationCenter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('chat');
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [chatService] = useState(() => new DecentralizedChatService(
    import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
    import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
  ));
  const [stats, setStats] = useState({
    unreadMessages: 0,
    pendingSignatures: 0,
    activePolls: 0,
    onlineUsers: 0,
    totalChannels: 0,
    documentsShared: 0
  });

  useEffect(() => {
    if (!user) return;


    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    loadStats();
    loadNotifications();

    chatService.on('notification', (notification: ChatNotification) => {
      setNotifications(prev => [notification, ...prev]);
      if (notificationsEnabled && (notification.priority === 'high' || notification.priority === 'urgent')) {
        showSystemNotification(notification);
      }
    });

    return () => {
      chatService.disconnect();
    };
  }, [user]);

  function loadStats() {
    setStats({
      unreadMessages: 0,
      pendingSignatures: 0,
      activePolls: 0,
      onlineUsers: 0,
      totalChannels: 0,
      documentsShared: 0
    });
  }

  function loadNotifications() {
    setNotifications([]);
  }

  function showSystemNotification(notification: ChatNotification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }
  }

  function toggleNotifications() {
    setNotificationsEnabled(!notificationsEnabled);
    toast({
      title: notificationsEnabled ? 'Notifications Disabled' : 'Notifications Enabled',
      description: notificationsEnabled
        ? 'You will no longer receive push notifications'
        : 'You will now receive push notifications',
      variant: 'default'
    });
  }

  const features = [
    {
      icon: MessageSquare,
      title: 'Real-time Chat',
      description: 'Instant messaging with role-based channels and private conversations',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      icon: Shield,
      title: 'End-to-End Encryption',
      description: 'Secure private conversations with enterprise-grade encryption',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      icon: FileText,
      title: 'Document Integration',
      description: 'Share, preview, and discuss documents directly in chat',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    },
    {
      icon: PenTool,
      title: 'Digital Signatures',
      description: 'Request and collect legally binding digital signatures',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      icon: BarChart3,
      title: 'Polls & Voting',
      description: 'Create polls and collect team feedback with live results',
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      icon: Brain,
      title: 'AI Assistant',
      description: 'Smart summaries, decision extraction, and response suggestions',
      color: 'text-pink-500',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20'
    }
  ];

  const quickActions = [
    {
      icon: Send,
      label: 'New Message',
      action: () => setActiveTab('chat'),
      color: 'bg-blue-500'
    },
    {
      icon: PenTool,
      label: 'Request Signature',
      action: () => setActiveTab('signatures'),
      color: 'bg-purple-500'
    },
    {
      icon: Vote,
      label: 'Create Poll',
      action: () => setActiveTab('polls'),
      color: 'bg-green-500'
    },
    {
      icon: FileText,
      label: 'Share Document',
      action: () => setActiveTab('chat'),
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Communication Center</h1>
          <p className="text-muted-foreground mt-2">
            Secure, decentralized chat & collaboration platform for IAOMS
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleNotifications}
            className="flex items-center gap-2"
          >
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            Notifications
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-muted-foreground">Online</span>
            </div>
            {notifications.filter(n => !n.read).length > 0 && (
              <Badge variant="destructive">
                {notifications.filter(n => !n.read).length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold">{stats.unreadMessages}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Signatures</p>
                <p className="text-2xl font-bold">{stats.pendingSignatures}</p>
              </div>
              <PenTool className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Polls</p>
                <p className="text-2xl font-bold">{stats.activePolls}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold">{stats.onlineUsers}</p>
              </div>
              <Users className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Channels</p>
                <p className="text-2xl font-bold">{stats.totalChannels}</p>
              </div>
              <Hash className="w-8 h-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{stats.documentsShared}</p>
              </div>
              <FileText className="w-8 h-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-16 flex flex-col items-center gap-2"
                onClick={action.action}
              >
                <div className={cn("p-2 rounded-full text-white", action.color)}>
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-sm">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className={cn("flex-shrink-0 p-3 rounded-lg", feature.bgColor)}>
                  <feature.icon className={cn("w-6 h-6", feature.color)} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[600px]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <CardHeader className="pb-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat
                {stats.unreadMessages > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {stats.unreadMessages}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="polls" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Polls
                {stats.activePolls > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {stats.activePolls}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="signatures" className="flex items-center gap-2">
                <PenTool className="w-4 h-4" />
                Signatures
                {stats.pendingSignatures > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {stats.pendingSignatures}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="workflow" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Workflow
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="flex-1 p-0">
            <TabsContent value="chat" className="h-full mt-0">
              <div className="h-[600px]">
                <ChatInterface />
              </div>
            </TabsContent>

            <TabsContent value="polls" className="h-full mt-0 p-6">
              <PollManager
                chatService={chatService}
                channelId="general"
                userId={user?.id || ''}
              />
            </TabsContent>

            <TabsContent value="signatures" className="h-full mt-0 p-6">
              <SignatureManager
                chatService={chatService}
                channelId="general"
                userId={user?.id || ''}
              />
            </TabsContent>

            <TabsContent value="workflow" className="h-full mt-0 p-6">
              <WorkflowBuilder />
            </TabsContent>

            <TabsContent value="analytics" className="h-full mt-0 p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Message Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Today</span>
                          <span className="font-medium">0 messages</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>This week</span>
                          <span className="font-medium">0 messages</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Average response time</span>
                          <span className="font-medium">0 minutes</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Top Channels</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span># general</span>
                          <span className="font-medium">0 messages</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span># hod-channel</span>
                          <span className="font-medium">0 messages</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span># cse-dept</span>
                          <span className="font-medium">0 messages</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">File Sharing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Documents shared</span>
                          <span className="font-medium">0 files</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Images shared</span>
                          <span className="font-medium">0 images</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total storage</span>
                          <span className="font-medium">0 GB</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          0%
                        </div>
                        <div className="text-sm text-muted-foreground">Active Users</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          0%
                        </div>
                        <div className="text-sm text-muted-foreground">Message Read Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          0
                        </div>
                        <div className="text-sm text-muted-foreground">Avg. Polls/Week</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          0%
                        </div>
                        <div className="text-sm text-muted-foreground">Signature Completion</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.slice(0, 5).map(notification => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    notification.read ? "bg-muted/20" : "bg-background"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-2",
                    notification.priority === 'urgent' ? "bg-red-500" :
                      notification.priority === 'high' ? "bg-orange-500" :
                        "bg-blue-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.createdAt.toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <Badge variant="secondary" className="text-xs">
                      New
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
