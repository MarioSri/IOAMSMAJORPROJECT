import { supabaseAdmin as supabase } from '../config/supabase';

/**
 * Service for triggering Supabase Realtime events from the backend.
 *
 * This service provides methods to trigger real-time updates by inserting/updating
 * records in Supabase tables. Frontend clients subscribe to these changes via
 * Supabase Realtime's postgres_changes subscriptions.
 *
 * Usage:
 *   const realtimeService = new SupabaseRealtimeService();
 *   await realtimeService.notifyUser(userId, notification);
 */
export class SupabaseRealtimeService {
  /**
   * Notify a user with a new notification.
   * Triggers real-time update for clients subscribed to notifications table.
   *
   * @param userId - The user ID to notify
   * @param notification - Notification data
   */
  async notifyUser(userId: string, notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'emergency' | 'approval' | 'submission' | 'reminder' | 'meeting';
    urgent?: boolean;
    metadata?: any;
  }) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          urgent: notification.urgent || false,
          metadata: notification.metadata,
          read: false,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Failed to create notification:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Error in notifyUser:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Trigger a document update event.
   * Updates document record, triggering real-time updates for subscribers.
   *
   * @param documentId - Document ID to update
   * @param update - Document fields to update
   */
  async notifyDocumentUpdate(documentId: string, update: {
    status?: 'draft' | 'pending' | 'in_progress' | 'approved' | 'rejected' | 'completed';
    metadata?: any;
  }) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({
          ...update,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update document:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Error in notifyDocumentUpdate:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Trigger an approval update event.
   * Updates approval record, triggering real-time updates for subscribers.
   *
   * @param approvalId - Approval ID to update
   * @param update - Approval fields to update
   */
  async notifyApprovalUpdate(approvalId: string, update: {
    status?: 'pending' | 'approved' | 'rejected' | 'bypassed';
    approver_id?: string;
    comments?: string;
    approved_at?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('document_approvals')
        .update({
          ...update,
          updated_at: new Date().toISOString()
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update approval:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Error in notifyApprovalUpdate:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Broadcast a system-wide announcement.
   * Creates a notification for all users.
   *
   * @param message - Announcement message
   * @param type - Notification type
   */
  async broadcastAnnouncement(message: string, type: 'info' | 'warning' | 'emergency' = 'info') {
    try {
      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('role_recipients')
        .select('id') as { data: { id: string }[] | null; error: any };

      if (usersError || !users) {
        console.error('Failed to fetch users:', usersError);
        return { success: false, error: usersError };
      }

      // Create notification for each user
      const notifications = users.map(user => ({
        user_id: user.id,
        title: 'System Announcement',
        message,
        type,
        urgent: type === 'emergency',
        read: false,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) {
        console.error('Failed to broadcast announcement:', error);
        return { success: false, error };
      }

      return { success: true, data, count: notifications.length };
    } catch (err) {
      console.error('Error in broadcastAnnouncement:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Create a chat message.
   * Inserts message into chat_messages, triggering real-time updates.
   *
   * @param channelId - Chat channel ID
   * @param senderId - Sender user ID
   * @param content - Message content
   * @param messageType - Message type (text, image, file, etc.)
   */
  async createChatMessage(
    channelId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' | 'system' = 'text'
  ) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          channel_id: channelId,
          sender_id: senderId,
          content,
          message_type: messageType,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Failed to create chat message:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Error in createChatMessage:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Create a LiveMeet+ request.
   * Inserts request into live_meeting_requests, triggering real-time updates.
   *
   * @param requesterId - User ID creating the request
   * @param recipientId - Target user ID
   * @param urgencyLevel - Urgency level (low, medium, high, urgent)
   * @param meetingType - Meeting type (video, audio, chat)
   */
  async createLiveMeetRequest(
    requesterId: string,
    recipientId: string,
    urgencyLevel: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    meetingType: 'video' | 'audio' | 'chat' = 'video'
  ) {
    try {
      const { data, error } = await supabase
        .from('live_meeting_requests')
        .insert([{
          requester_id: requesterId,
          recipient_id: recipientId,
          urgency_level: urgencyLevel,
          meeting_type: meetingType,
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Failed to create LiveMeet+ request:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Error in createLiveMeetRequest:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Update workflow step status.
   * Triggers real-time updates for workflow tracking.
   *
   * @param stepId - Workflow step ID
   * @param status - New status
   */
  async updateWorkflowStep(
    stepId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  ) {
    try {
      const { data, error } = await supabase
        .from('workflow_steps')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update workflow step:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Error in updateWorkflowStep:', err);
      return { success: false, error: err };
    }
  }
}

// Export singleton instance
export const realtimeService = new SupabaseRealtimeService();
