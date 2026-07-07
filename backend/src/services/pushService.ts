import webpush from 'web-push';
import { supabaseAdmin } from '../config/supabase';

// Initialize VAPID details for the web-push library
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:noreply@iaoms.dev',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('[WebPush] VAPID configured successfully');
  } catch (error) {
    console.error('[WebPush] Failed to configure VAPID:', error);
  }
} else {
  console.warn('[WebPush] VAPID keys not found in environment variables');
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
  /** Visual urgency tier — controls the accent and badge rendered by the SW */
  urgency?: 'normal' | 'high' | 'critical';
}

/** Interface for raw database device row */
interface DeviceRow {
  id: string;
  user_id: string;
  fcm_token: string; // repurposed: stores Web Push endpoint URL
  push_keys: { p256dh: string; auth: string } | null;
  email?: string | null;
}

/** Interface for chat message context used in notifications */
export interface ChatMessage {
  senderId: string;
  senderName: string;
  recipientIds: string[];
  body: string;
  threadId: string;
  channelHandle?: string;
  linkedDocTitle?: string;
}

// ── Core Sender ──────────────────────────────────────────────────────────────

/**
 * Send a push notification to all unique subscriptions for a given User ID.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const { data: devices, error } = await supabaseAdmin
    .from('user_devices')
    .select('id, user_id, fcm_token, push_keys')
    .eq('user_id', userId);

  if (error || !devices) {
    console.error('[Push] Failed to fetch devices for user:', userId, error);
    return { sent: 0, failed: 0 };
  }

  return sendToDevices(devices as DeviceRow[], payload);
}

/**
 * Send a push notification to devices matching a specific email.
 * This is useful for targeting users by email when their ID is unknown or for testing.
 */
export async function sendPushToEmailDirect(
  email: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const { data: devices, error } = await supabaseAdmin
    .from('user_devices')
    .select('id, user_id, fcm_token, push_keys')
    .eq('email', email);

  if (error || !devices) {
    console.error('[Push] Failed to fetch devices for email:', email, error);
    return { sent: 0, failed: 0 };
  }

  return sendToDevices(devices as DeviceRow[], payload);
}

/**
 * Core implementation that delivers notifications to a list of device rows.
 */
export async function sendToDevices(
  devices: DeviceRow[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!devices.length) return { sent: 0, failed: 0 };

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/favicon.ico',
    badge: '/security-logo-transparent.png',
    urgency: payload.urgency ?? 'normal',
    data: {
      ...payload.data,
      url: payload.actionUrl ?? (payload.data?.url as string) ?? '/dashboard',
      timestamp: Date.now(),
    },
  });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    devices.map(async (device) => {
      if (!device.push_keys?.p256dh || !device.push_keys?.auth) {
        staleIds.push(device.id);
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: device.fcm_token,
            keys: {
              p256dh: device.push_keys.p256dh,
              auth: device.push_keys.auth,
            },
          },
          notification
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          staleIds.push(device.id);
        }
        failed++;
      }
    })
  );

  if (staleIds.length > 0) {
    try {
      await supabaseAdmin.from('user_devices').delete().in('id', staleIds);
    } catch {
      // Ignore pruning errors
    }
  }

  return { sent, failed };
}

// ── Shared Helper ────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length <= max ? str : `${str.slice(0, max).trimEnd()}…`;
}

// ── Typed Notification Templates ─────────────────────────────────────────────

/** 🚨 Emergency — Sent to all system users */
export function buildEmergencyPush(params: {
  title: string;
  urgency: string;
  description: string;
}): PushPayload {
  return {
    title: `🚨 Emergency — ${params.title}`,
    body: `Urgency: ${params.urgency} · ${params.description}`,
    actionUrl: '/emergency',
    urgency: 'critical',
  };
}

/** ✅ Approval: Document fully approved — Sent to original submitter */
export function buildApprovedPush(params: {
  docTitle: string;
}): PushPayload {
  return {
    title: 'Document Approved',
    body: `"${truncate(params.docTitle, 50)}" cleared all approval stages.`,
    actionUrl: '/approvals',
    urgency: 'normal',
  };
}

/** 📋 Approval: Review needed — Sent to next assignee in chain */
export function buildReviewNeededPush(params: {
  docTitle: string;
}): PushPayload {
  return {
    title: 'Your Review is Needed',
    body: `"${truncate(params.docTitle, 50)}" is awaiting your decision.`,
    actionUrl: '/approvals',
    urgency: 'high',
  };
}

/** ↩ Approval: Document returned — Sent to original submitter */
export function buildRejectedPush(params: {
  docTitle: string;
}): PushPayload {
  return {
    title: 'Document Returned',
    body: `"${truncate(params.docTitle, 50)}" requires changes before resubmission.`,
    actionUrl: '/approvals',
    urgency: 'normal',
  };
}

/** 🟢 LiveMeet+: New request — Sent to selected recipients */
export function buildLiveMeetRequestPush(params: {
  requesterName: string;
  docTitle: string;
  format: string;        // e.g. "In-Person" | "Online"
  urgency: string;       // e.g. "Immediate" | "Normal"
}): PushPayload {
  const urgencyLabel = params.urgency === 'Immediate' ? '⚡ Immediate' : params.urgency;
  return {
    title: `Meeting request from ${params.requesterName}`,
    body: `Regarding "${truncate(params.docTitle, 30)}" · ${params.format} · ${urgencyLabel}`,
    actionUrl: '/calendar',
    urgency: params.urgency === 'Immediate' ? 'high' : 'normal',
  };
}

/** 🟢 LiveMeet+: Request accepted — Sent to original requester */
export function buildLiveMeetAcceptedPush(params: {
  responderName: string;
  docTitle: string;
}): PushPayload {
  return {
    title: `${params.responderName} Accepted`,
    body: `Your LiveMeet+ for "${truncate(params.docTitle, 40)}" is confirmed.`,
    actionUrl: '/calendar',
    urgency: 'normal',
  };
}

/** 🟢 LiveMeet+: Request declined — Sent to original requester */
export function buildLiveMeetDeclinedPush(params: {
  responderName: string;
}): PushPayload {
  return {
    title: `${params.responderName} Declined`,
    body: 'Your LiveMeet+ request was not accepted. You may raise a new request from the Approval Center.',
    actionUrl: '/calendar',
    urgency: 'normal',
  };
}

/** 💬 Chat: Direct message */
export function buildDirectMessagePush(params: {
  senderName: string;
  message: string;
  threadId: string;
}): PushPayload {
  return {
    title: params.senderName,
    body: truncate(params.message, 80),
    actionUrl: `/messages?thread=${params.threadId}`,
    urgency: 'normal',
  };
}

/** 💬 Chat: Message inside a document-linked thread */
export function buildDocumentThreadMessagePush(params: {
  senderName: string;
  docTitle: string;
  message: string;
  threadId: string;
}): PushPayload {
  return {
    title: `${params.senderName} · ${truncate(params.docTitle, 30)}`,
    body: truncate(params.message, 80),
    actionUrl: `/messages?thread=${params.threadId}`,
    urgency: 'normal',
  };
}

/** 💬 Chat: Message in a group channel */
export function buildChannelMessagePush(params: {
  senderName: string;
  channelHandle: string;
  message: string;
}): PushPayload {
  return {
    title: `${params.senderName} · #${params.channelHandle}`,
    body: truncate(params.message, 80),
    actionUrl: `/messages?channel=${params.channelHandle}`,
    urgency: 'normal',
  };
}

/** 📎 Chat: Message with attachment */
export function buildAttachmentMessagePush(params: {
  senderName: string;
  fileName: string;
  threadId: string;
}): PushPayload {
  return {
    title: `📎 New File from ${params.senderName}`,
    body: `Attached: ${truncate(params.fileName, 40)}`,
    actionUrl: `/messages?thread=${params.threadId}`,
    urgency: 'normal',
  };
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * High-level orchestration for chat notifications.
 * Determines the correct template and sends to multiple recipients.
 */
export async function notifyMessageRecipients(message: ChatMessage) {
  // Don't notify the sender
  const recipients = (message.recipientIds || []).filter(id => id !== message.senderId);
  if (!recipients.length) return;

  let push: PushPayload;

  if (message.channelHandle) {
    // Group / channel message
    push = buildChannelMessagePush({
      senderName: message.senderName,
      channelHandle: message.channelHandle,
      message: message.body,
    });
  } else if (message.linkedDocTitle) {
    // Document-linked thread
    push = buildDocumentThreadMessagePush({
      senderName: message.senderName,
      docTitle: message.linkedDocTitle,
      message: message.body,
      threadId: message.threadId,
    });
  } else {
    // Standard direct message
    push = buildDirectMessagePush({
      senderName: message.senderName,
      message: message.body,
      threadId: message.threadId,
    });
  }

  await Promise.all(recipients.map(uid => sendPushToUser(uid, push)));
}

// ── updateUserDevicesEmail ────────────────────────────────────────────────────

/**
 * Update the email tag on all devices belonging to a user.
 * Call this whenever the user changes their preferred notification email
 * so that email-based push lookups stay in sync.
 */
export async function updateUserDevicesEmail(
  userId: string,
  newEmail: string
): Promise<{ updated: number }> {
  const { data, error } = await supabaseAdmin
    .from('user_devices')
    .update({ email: newEmail })
    .eq('user_id', userId)
    .select('id');

  if (error) {
    console.error('[Push] Failed to update device emails for user:', userId, error);
    return { updated: 0 };
  }

  const count = data?.length ?? 0;
  console.log(`[Push] Updated ${count} device(s) for user ${userId} -> ${newEmail}`);
  return { updated: count };
}


