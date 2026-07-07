import { supabase } from '@/lib/supabase';
import { SupabaseNotification } from '@/hooks/useSupabaseNotifications';

export class SupabaseNotificationService {
  /**
   * Create a notification for a specific user
   */
  static async createNotification(
    userId: string,
    notification: Omit<SupabaseNotification, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<SupabaseNotification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          ...notification
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  /**
   * Create notifications for multiple users
   */
  static async createBulkNotifications(
    userIds: string[],
    notification: Omit<SupabaseNotification, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        ...notification
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to create bulk notifications:', error);
      return false;
    }
  }

  /**
   * Create notification for document approval
   */
  static async notifyDocumentApproval(
    userId: string,
    documentId: string,
    documentTitle: string,
    approved: boolean
  ): Promise<void> {
    await this.createNotification(userId, {
      title: approved ? 'Document Approved' : 'Document Rejected',
      message: `Your document "${documentTitle}" has been ${approved ? 'approved' : 'rejected'}.`,
      type: approved ? 'approval' : 'error',
      urgent: !approved,
      read: false,
      delivered_via: ['in-app'],
      document_id: documentId,
      metadata: {
        action: approved ? 'approved' : 'rejected',
        document_title: documentTitle
      }
    });
  }

  /**
   * Create notification for new document submission
   */
  static async notifyDocumentSubmission(
    recipientIds: string[],
    documentId: string,
    documentTitle: string,
    submitterName: string,
    isEmergency: boolean = false
  ): Promise<void> {
    await this.createBulkNotifications(recipientIds, {
      title: isEmergency ? '🚨 Emergency Document Submitted' : 'New Document Submitted',
      message: `${submitterName} submitted "${documentTitle}" for your review.`,
      type: isEmergency ? 'emergency' : 'submission',
      urgent: isEmergency,
      read: false,
      delivered_via: ['in-app'],
      document_id: documentId,
      metadata: {
        submitter: submitterName,
        document_title: documentTitle,
        is_emergency: isEmergency
      }
    });
  }

  /**
   * Create notification for document status change
   */
  static async notifyDocumentStatusChange(
    userId: string,
    documentId: string,
    documentTitle: string,
    newStatus: string
  ): Promise<void> {
    const typeMap: Record<string, 'info' | 'success' | 'warning' | 'error' | 'emergency'> = {
      'pending': 'info',
      'in-review': 'info',
      'approved': 'success',
      'rejected': 'error',
      'emergency': 'emergency'
    };

    await this.createNotification(userId, {
      title: 'Document Status Updated',
      message: `Document "${documentTitle}" status changed to ${newStatus}.`,
      type: typeMap[newStatus] || 'info',
      urgent: newStatus === 'emergency',
      read: false,
      delivered_via: ['in-app'],
      document_id: documentId,
      metadata: {
        status: newStatus,
        document_title: documentTitle
      }
    });
  }

  /**
   * Create reminder notification
   */
  static async createReminder(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.createNotification(userId, {
      title,
      message,
      type: 'reminder',
      urgent: false,
      read: false,
      delivered_via: ['in-app'],
      metadata
    });
  }

  /**
   * Create meeting notification
   */
  static async notifyMeeting(
    userIds: string[],
    meetingTitle: string,
    meetingTime: string,
    meetingUrl?: string
  ): Promise<void> {
    await this.createBulkNotifications(userIds, {
      title: 'Meeting Scheduled',
      message: `You have a meeting: "${meetingTitle}" at ${meetingTime}`,
      type: 'meeting',
      urgent: false,
      read: false,
      delivered_via: ['in-app'],
      action_url: meetingUrl,
      metadata: {
        meeting_title: meetingTitle,
        meeting_time: meetingTime
      }
    });
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Clean up old read notifications (optional maintenance)
   */
  static async cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<boolean> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .eq('read', true)
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to cleanup old notifications:', error);
      return false;
    }
  }
}
