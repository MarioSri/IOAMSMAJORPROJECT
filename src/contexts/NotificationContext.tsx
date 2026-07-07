import React, { createContext, useContext, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseNotifications, SupabaseNotification } from '@/hooks/useSupabaseNotifications';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'emergency';
  timestamp: Date;
  read: boolean;
  urgent: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { toast } = useToast();
  const {
    notifications: supabaseNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    createNotification
  } = useSupabaseNotifications();

  // Convert Supabase notifications to context format
  const notifications: Notification[] = supabaseNotifications.map(n => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type as any,
    timestamp: new Date(n.created_at),
    read: n.read,
    urgent: n.urgent,
    actionUrl: n.action_url,
    metadata: n.metadata
  }));

  async function addNotification(notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    // Create in Supabase
    await createNotification({
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      urgent: notificationData.urgent,
      delivered_via: [],
      action_url: notificationData.actionUrl,
      metadata: notificationData.metadata,
      read: false
    });

    // Show toast for urgent notifications
    if (notificationData.urgent || notificationData.type === 'emergency') {
      toast({
        title: notificationData.title,
        description: notificationData.message,
        variant: notificationData.type === 'error' || notificationData.type === 'emergency' ? 'destructive' : 'default',
        duration: notificationData.type === 'emergency' ? 10000 : 5000,
      });
    }

    // Browser notification for urgent items
    if (notificationData.urgent && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/favicon.ico'
      });
    }
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
