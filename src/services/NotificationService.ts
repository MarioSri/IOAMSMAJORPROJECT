interface Notification {
  id: string;
  title: string;
  message: string;
  type: "approval" | "submission" | "reminder" | "emergency" | "meeting";
  timestamp: string;
  read: boolean;
  urgent: boolean;
  documentId?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private listeners: ((notifications: Notification[]) => void)[] = [];

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: 'Just now',
      read: false
    };

    const existingNotifications = this.getNotifications();
    const updatedNotifications = [newNotification, ...existingNotifications];
    
    localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    this.notifyListeners(updatedNotifications);
  }

  getNotifications(): Notification[] {
    const stored = localStorage.getItem('notifications');
    return stored ? JSON.parse(stored) : [];
  }

  subscribe(callback: (notifications: Notification[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners(notifications: Notification[]) {
    this.listeners.forEach(listener => listener(notifications));
  }
}

export const notificationService = NotificationService.getInstance();
export type { Notification };