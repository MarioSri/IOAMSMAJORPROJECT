import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupabaseNotifications } from '@/hooks/useSupabaseNotifications';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  AlertTriangle,
  X
} from 'lucide-react';

interface NotificationsWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}



export const NotificationsWidget: React.FC<NotificationsWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const { isMobile } = useResponsive();
  const {
    notifications,
    loading,
    unreadCount,
    urgentCount,
    markAsRead,
    removeNotification
  } = useSupabaseNotifications();
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const getNotificationIcon = (notification: { type: string; title?: string }) => {
    if (notification.type === 'meeting' && notification.title?.includes('LiveMeet+')) {
      return (
        <div className="relative w-4 h-4 flex-shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 bg-green-400 rounded-full"></div>
          <div className="relative w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      );
    }

    switch (notification.type) {
      case 'approval': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'submission': return <FileText className="w-4 h-4 text-primary" />;
      case 'reminder': return <Clock className="w-4 h-4 text-warning" />;
      case 'emergency': return <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />;
      case 'meeting': return <Calendar className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };



  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'urgent':
        return notifications.filter(n => n.urgent || n.type === 'emergency');
      default:
        return notifications;
    }
  };

  const filteredNotifications = getFilteredNotifications();

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

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
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
        <div className={cn(
          "flex justify-between",
          isMobile ? "flex-col gap-3" : "items-center"
        )}>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <Bell className="w-5 h-5 text-primary" />
            Notifications
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {unreadCount}
                </Badge>
              )}
              {urgentCount > 0 && (
                <Badge variant="warning" className="text-xs">
                  {urgentCount} urgent
                </Badge>
              )}
            </div>
          </CardTitle>

          <div className="flex gap-1">
            {(['all', 'unread', 'urgent'] as const).map(filterType => (
              <Button
                key={filterType}
                variant={filter === filterType ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter(filterType)}
                className={cn(isMobile && "text-xs px-2")}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {filteredNotifications.slice(0, 8).map((notification, index) => (
              <div
                key={notification.id}
                className={cn(
                  "p-3 border rounded-lg hover:bg-accent transition-all cursor-pointer",
                  !notification.read && "bg-primary/5 border-l-4 border-l-primary",
                  notification.urgent && "border-warning bg-warning/5",
                  notification.type === 'emergency' && "border-destructive bg-destructive/5"
                )}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className={cn(
                        "font-medium line-clamp-2",
                        !notification.read ? 'text-foreground' : 'text-muted-foreground',
                        isMobile ? "text-sm" : "text-base"
                      )}>
                        {notification.title}
                        {notification.urgent && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Urgent
                          </Badge>
                        )}
                      </h5>
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

                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {getTimeAgo(notification.created_at)}
                      </span>
                      {notification.delivered_via && notification.delivered_via.length > 0 && (
                        <div className="flex gap-1">
                          {notification.delivered_via.map((method) => (
                            <Badge key={method} variant="outline" className="text-xs">
                              {method}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredNotifications.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-base">
                  {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="font-bold text-primary text-xl">
              {notifications.length}
            </p>
            <p className="text-muted-foreground text-sm">
              Total
            </p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="font-bold text-warning text-xl">
              {unreadCount}
            </p>
            <p className="text-muted-foreground text-sm">
              Unread
            </p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className="font-bold text-destructive text-xl">
              {urgentCount}
            </p>
            <p className="text-muted-foreground text-sm">
              Urgent
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};