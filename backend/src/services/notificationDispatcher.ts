/**
 * Notification Dispatcher Service
 * 
 * High-level orchestration layer that connects workflow events to push notification templates.
 * This service provides typed, context-aware notification functions for all major workflows.
 */

import * as PushService from './pushService';
import { supabaseAdmin } from '../config/supabase';

// ── Emergency Notifications ──────────────────────────────────────────────────

/**
 * Broadcast emergency alert to all active users in the system.
 */
export async function notifyEmergency(params: {
  title: string;
  urgency: string;
  description: string;
}) {
  // Get all active users
  const { data: users } = await supabaseAdmin
    .from('role_recipients')
    .select('supabase_uid')
    .eq('is_active', true)
    .not('supabase_uid', 'is', null);

  if (!users?.length) {
    console.warn('[NotifyEmergency] No active users found');
    return { sent: 0, failed: 0 };
  }

  const push = PushService.buildEmergencyPush(params);
  
  const results = await Promise.allSettled(
    users.map(u => PushService.sendPushToUser(u.supabase_uid, push))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.info(`[NotifyEmergency] Sent to ${sent}/${users.length} users`);
  return { sent, failed };
}

// ── Approval Workflow Notifications ──────────────────────────────────────────

/**
 * Notify submitter that their document was fully approved.
 */
export async function notifyDocumentApproved(params: {
  submitterId: string;
  docTitle: string;
}) {
  const push = PushService.buildApprovedPush({ docTitle: params.docTitle });
  return PushService.sendPushToUser(params.submitterId, push);
}

/**
 * Notify assignee that a document requires their review.
 */
export async function notifyReviewNeeded(params: {
  assigneeId: string;
  docTitle: string;
}) {
  const push = PushService.buildReviewNeededPush({ docTitle: params.docTitle });
  return PushService.sendPushToUser(params.assigneeId, push);
}

/**
 * Notify submitter that their document was returned for revision.
 */
export async function notifyDocumentRejected(params: {
  submitterId: string;
  docTitle: string;
}) {
  const push = PushService.buildRejectedPush({ docTitle: params.docTitle });
  return PushService.sendPushToUser(params.submitterId, push);
}

// ── LiveMeet+ Notifications ───────────────────────────────────────────────────

/**
 * Notify selected recipients of a new LiveMeet+ request.
 */
export async function notifyLiveMeetRequest(params: {
  recipientIds: string[];
  requesterName: string;
  docTitle: string;
  format: string;
  urgency: string;
}) {
  const push = PushService.buildLiveMeetRequestPush({
    requesterName: params.requesterName,
    docTitle: params.docTitle,
    format: params.format,
    urgency: params.urgency,
  });

  const results = await Promise.allSettled(
    params.recipientIds.map(id => PushService.sendPushToUser(id, push))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { sent, failed };
}

/**
 * Notify requester that their LiveMeet+ request was accepted.
 */
export async function notifyLiveMeetAccepted(params: {
  requesterId: string;
  responderName: string;
  docTitle: string;
}) {
  const push = PushService.buildLiveMeetAcceptedPush({
    responderName: params.responderName,
    docTitle: params.docTitle,
  });

  return PushService.sendPushToUser(params.requesterId, push);
}

/**
 * Notify requester that their LiveMeet+ request was declined.
 */
export async function notifyLiveMeetDeclined(params: {
  requesterId: string;
  responderName: string;
}) {
  const push = PushService.buildLiveMeetDeclinedPush({
    responderName: params.responderName,
  });

  return PushService.sendPushToUser(params.requesterId, push);
}

// ── Chat Notifications ────────────────────────────────────────────────────────

/**
 * Notify recipients of a new chat message.
 * Automatically selects the correct template based on message context.
 */
export async function notifyChatMessage(message: PushService.ChatMessage) {
  return PushService.notifyMessageRecipients(message);
}

/**
 * Notify user of a direct message.
 */
export async function notifyDirectMessage(params: {
  recipientId: string;
  senderName: string;
  message: string;
  threadId: string;
}) {
  const push = PushService.buildDirectMessagePush({
    senderName: params.senderName,
    message: params.message,
    threadId: params.threadId,
  });

  return PushService.sendPushToUser(params.recipientId, push);
}

/**
 * Notify channel members of a new message.
 */
export async function notifyChannelMessage(params: {
  recipientIds: string[];
  senderName: string;
  channelHandle: string;
  message: string;
  excludeSenderId?: string;
}) {
  const recipients = params.excludeSenderId
    ? params.recipientIds.filter(id => id !== params.excludeSenderId)
    : params.recipientIds;

  const push = PushService.buildChannelMessagePush({
    senderName: params.senderName,
    channelHandle: params.channelHandle,
    message: params.message,
  });

  const results = await Promise.allSettled(
    recipients.map(id => PushService.sendPushToUser(id, push))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { sent, failed };
}

/**
 * Notify user of a file attachment.
 */
export async function notifyAttachment(params: {
  recipientId: string;
  senderName: string;
  fileName: string;
  threadId: string;
}) {
  const push = PushService.buildAttachmentMessagePush({
    senderName: params.senderName,
    fileName: params.fileName,
    threadId: params.threadId,
  });

  return PushService.sendPushToUser(params.recipientId, push);
}

// ── Generic Notification (Fallback) ──────────────────────────────────────────

/**
 * Send a generic notification when no specific template matches.
 * Use this sparingly — prefer typed templates above.
 */
export async function notifyGeneric(params: {
  userId: string;
  title: string;
  body: string;
  actionUrl?: string;
  urgency?: 'normal' | 'high' | 'critical';
}) {
  return PushService.sendPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    actionUrl: params.actionUrl,
    urgency: params.urgency ?? 'normal',
  });
}
