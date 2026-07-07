import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bell, X, CircleCheck, FileText, Calendar, TriangleAlert, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSupabaseNotifications } from '@/hooks/useSupabaseNotifications';
import { supabase } from '@/lib/supabase';

const API_BASE = '/api';

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    clearAll,
    removeNotification
  } = useSupabaseNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendEmail = async (notificationId: string) => {
    try {
      setResendingId(notificationId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`${API_BASE}/notifications/${notificationId}/resend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
    } catch (err) {
      console.error('[NotificationCenter] Resend failed:', err);
    } finally {
      setResendingId(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return (
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full"></div>
            <div className="absolute inset-1 w-2 h-2 bg-red-500 rounded-full"></div>
          </div>
        );
      case 'approval': return <CircleCheck className="w-4 h-4 text-success" />;
      case 'submission': return <FileText className="w-4 h-4 text-primary" />;
      case 'reminder': return <Calendar className="w-4 h-4 text-info" />;
      case 'emergency': return <TriangleAlert className="w-4 h-4 text-destructive" />;
      default: return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diff = now.getTime() - notificationTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="rounded-lg bg-card text-card-foreground border-0 shadow-none">
          <div className="flex flex-col space-y-1.5 p-6 pb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold tracking-tight text-lg">Notifications</h3>
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{notifications.length} total notifications</span>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
          </div>
          <div className="p-0">
            <ScrollArea className="h-96">
              <div className="space-y-1">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification, index) => (
                    <div key={notification.id}>
                      <div className={`p-4 hover:bg-muted/50 cursor-pointer ${!notification.read ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {notification.title}
                                {notification.urgent && (
                                  <Badge variant="destructive" className="ml-2 text-xs">
                                    Urgent
                                  </Badge>
                                )}
                              </h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {getTimeAgo(notification.created_at)}
                        </span>
                        <div className="flex items-center gap-1">
                          {notification.email_failed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              title="Email failed — click to resend"
                              disabled={resendingId === notification.id}
                              onClick={(e) => { e.stopPropagation(); handleResendEmail(notification.id); }}
                            >
                              <RefreshCw className={`w-3 h-3 text-orange-500 ${resendingId === notification.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          {notification.document_id && (
                            <Badge variant="outline" className="text-xs">
                              Doc: {notification.document_id.slice(0, 8)}
                            </Badge>
                          )}
                        </div>
                      </div>
                          </div>
                        </div>
                      </div>
                      {index < notifications.length - 1 && <Separator />}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};