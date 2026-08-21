import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { EmailService } from '../services/emailService';
import * as PushService from '../services/pushService';

// ── Enrichment Helper ─────────────────────────────────────────────────────

async function enrichEmailParams(
  type: string,
  params: Record<string, any>,
  documentId?: string
): Promise<Record<string, any>> {
  const enriched = { ...params };
  const frontendUrl = process.env.EMAIL_FRONTEND_URL || process.env.FRONTEND_URL?.split(',')[0] || 'https://app.iaoms.dev';

  // 1. Resolve absolute URLs
  if (enriched.approvalUrl && typeof enriched.approvalUrl === 'string' && !enriched.approvalUrl.startsWith('http')) {
    enriched.approvalUrl = `${frontendUrl}${enriched.approvalUrl.startsWith('/') ? '' : '/'}${enriched.approvalUrl}`;
  }
  if (enriched.meetUrl && typeof enriched.meetUrl === 'string' && !enriched.meetUrl.startsWith('http')) {
    enriched.meetUrl = `${frontendUrl}${enriched.meetUrl.startsWith('/') ? '' : '/'}${enriched.meetUrl}`;
  }

  // 2. Fetch Document Context
  if (documentId) {
    try {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('title, submitted_by, type, created_at')
        .eq('id', documentId)
        .single();

      if (doc) {
        if (!enriched.docTitle) enriched.docTitle = doc.title;
        if (!enriched.documentTitle) enriched.documentTitle = doc.title;
        if (doc.type) enriched.documentType = doc.type;
        if (doc.created_at) enriched.submittedDate = new Date(doc.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        
        // Fetch Submitter Context if not provided
        if (doc.submitted_by && !enriched.submitterName && !enriched.requesterName) {
          const { data: submitter } = await supabaseAdmin
            .from('role_recipients')
            .select('name, full_name, role, department')
            .eq('supabase_uid', doc.submitted_by)
            .single();
          
          if (submitter) {
            const name = submitter.full_name || submitter.name || 'IAOMS User';
            enriched.submitterName = name;
            enriched.requesterName = name;
            if (submitter.role) enriched.submitterRole = submitter.role;
            if (submitter.department) enriched.submitterDepartment = submitter.department;
          }
        }

        // Fetch Workflow Stage Information
        try {
          const { data: workflow } = await supabaseAdmin
            .from('workflow_steps')
            .select('stage_name, stage_order, total_stages, assigned_to')
            .eq('document_id', documentId)
            .order('stage_order', { ascending: false })
            .limit(1)
            .single();

          if (workflow) {
            enriched.currentStage = workflow.stage_name;
            enriched.currentStageNumber = workflow.stage_order;
            enriched.totalStages = workflow.total_stages;
            enriched.stageInfo = `Stage ${workflow.stage_order} of ${workflow.total_stages}`;

            // Fetch Approver Name
            if (workflow.assigned_to && !enriched.approverName) {
              const { data: approver } = await supabaseAdmin
                .from('role_recipients')
                .select('name, full_name, role')
                .eq('supabase_uid', workflow.assigned_to)
                .single();
              
              if (approver) {
                enriched.approverName = approver.full_name || approver.name || 'Approver';
                if (approver.role) enriched.approverRole = approver.role;
              }
            }
          }
        } catch (err) {
          console.error('[Enrichment] Workflow fetch failed', err);
        }
      }
    } catch (err) {
      console.error('[Enrichment] Document fetch failed', err);
    }
  }

  // 3. Enrich LiveMeet+ Requests
  if (type === 'livemeet_request' && params.meetingId) {
    try {
      const { data: meeting } = await supabaseAdmin
        .from('live_meeting_requests')
        .select('format, urgency, agenda, proposed_date, proposed_time, location')
        .eq('id', params.meetingId)
        .single();

      if (meeting) {
        if (meeting.format) enriched.meetingFormat = meeting.format;
        if (meeting.urgency) enriched.meetingUrgency = meeting.urgency;
        if (meeting.agenda) enriched.meetingAgenda = meeting.agenda;
        if (meeting.proposed_date) enriched.meetingDate = new Date(meeting.proposed_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        if (meeting.proposed_time) enriched.meetingTime = meeting.proposed_time;
        if (meeting.location) enriched.meetingLocation = meeting.location;
      }
    } catch (err) {
      console.error('[Enrichment] LiveMeet+ fetch failed', err);
    }
  }

  // 4. Enrich Emergency Notifications
  if (type === 'emergency' && params.emergencyId) {
    try {
      const { data: emergency } = await supabaseAdmin
        .from('emergency_notifications')
        .select('affected_areas, emergency_contacts, action_required, estimated_duration')
        .eq('id', params.emergencyId)
        .single();

      if (emergency) {
        if (emergency.affected_areas) enriched.affectedAreas = emergency.affected_areas;
        if (emergency.emergency_contacts) enriched.emergencyContacts = emergency.emergency_contacts;
        if (emergency.action_required) enriched.actionRequired = emergency.action_required;
        if (emergency.estimated_duration) enriched.estimatedDuration = emergency.estimated_duration;
      }
    } catch (err) {
      console.error('[Enrichment] Emergency fetch failed', err);
    }
  }

  return enriched;
}

// ── Types ─────────────────────────────────────────────────────────────────

interface DispatchBody {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  urgent?: boolean;
  action_url?: string;
  document_id?: string;
  emailParams?: { type: string; params: Record<string, any> } | null;
  pushPayload?: { title: string; body: string; url?: string } | null;
  metadata?: Record<string, any>;
}

// ── Email with retry (max 3 attempts, exponential back-off) ───────────────

async function sendEmailWithRetry(
  to: string,
  notificationId: string,
  emailType: string,
  params: Record<string, any>,
  attempt = 0
): Promise<void> {
  const delays = [2000, 4000, 6000];
  const MAX_ATTEMPTS = 3;

  const emailOpts = { emailType, params };
  let result: { success: boolean; error?: any };

  switch (emailType) {
    case 'submission':
      result = await EmailService.sendDocumentSubmissionNotification(to, params as any);
      break;
    case 'approval':
      result = await EmailService.sendApprovalResultNotification(to, params as any);
      break;
    case 'livemeet_request':
      result = await EmailService.sendLiveMeetRequestNotification(to, params as any);
      break;
    case 'livemeet_response':
      result = await EmailService.sendLiveMeetResponseNotification(to, params as any);
      break;
    case 'emergency':
      result = await EmailService.sendEmergencyNotification(to, params as any);
      break;
    case 'routing':
      result = await EmailService.sendRoutingNotification(to, params as any);
      break;
    default:
      result = await EmailService.sendNotification(to, params.subject || 'IAOMS Notification', `<p>${params.message || ''}</p>`);
  }

  if (result.success) {
    await supabaseAdmin
      .from('notifications')
      .update({ email_sent: true, email_failed: false, last_email_attempt_at: new Date().toISOString() })
      .eq('id', notificationId);
    return;
  }

  // Update failure count regardless
  const newCount = attempt + 1;
  await supabaseAdmin
    .from('notifications')
    .update({
      email_failed: true,
      email_retry_count: newCount,
      last_email_attempt_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (attempt < MAX_ATTEMPTS - 1) {
    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    return sendEmailWithRetry(to, notificationId, emailType, params, attempt + 1);
  }
  // All attempts exhausted — leave email_failed = true for manual resend
}

// ── dispatchNotification ──────────────────────────────────────────────────
// POST /api/notifications/dispatch

export async function dispatchNotification(req: Request, res: Response) {
  try {
    const body = req.body as DispatchBody;
    const { userIds, title, message, type, urgent = false, action_url, document_id, emailParams, pushPayload, metadata } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'userIds array is required' });
    }
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'title and message are required' });
    }

    const results: Array<{ userId: string; notificationId: string }> = [];

    for (const userId of userIds) {
      // 1. Check user's notification preferences
      const { data: prefs } = await supabaseAdmin
        .from('user_notification_preferences')
        .select('email_enabled, push_enabled')
        .eq('user_id', userId)
        .single();

      const emailEnabled = prefs?.email_enabled ?? true;
      const pushEnabled = prefs?.push_enabled ?? true;

      // 2. Resolve preferred email
      const { data: recipient } = await supabaseAdmin
        .from('role_recipients')
        .select('email, preferred_notification_email')
        .eq('supabase_uid', userId)
        .single();

      const emailTo = recipient?.preferred_notification_email || recipient?.email || null;

      // 3. Insert notification row
      const { data: notifRow, error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          urgent,
          action_url: action_url || null,
          document_id: document_id || null,
          delivered_via: [],
          metadata: {
            ...metadata,
            ...(emailParams && emailTo ? { 
              email_to: emailTo, 
              email_type: emailParams.type, 
              email_params: await enrichEmailParams(emailParams.type, emailParams.params, document_id) 
            } : {}),
          },
          read: false,
          email_sent: false,
          email_failed: false,
          email_retry_count: 0,
        })
        .select('id')
        .single();

      if (insertError || !notifRow) {
        console.error('[Dispatch] Insert failed for userId', userId, insertError);
        continue;
      }

      const notificationId = notifRow.id as string;
      const deliveredVia: string[] = [];

      // 4. In-app is always delivered (row inserted = visible in NotificationsCenter)
      deliveredVia.push('in_app');

      // 5. Email
      if (emailEnabled && emailParams && emailTo) {
        // Enrich params before sending
        const enrichedParams = await enrichEmailParams(emailParams.type, emailParams.params, document_id);
        
        // Fire-and-forget with retries; don't await to avoid request timeout
        sendEmailWithRetry(emailTo, notificationId, emailParams.type, enrichedParams).catch(err =>
          console.error('[Dispatch] Email error for', userId, err)
        );
        deliveredVia.push('email');
      }

              // 6. Web Push — user ID is the canonical target. Email fallback is
        // intentionally omitted here to prevent duplicate delivery to a device
        // that is already registered to the same user.

      if (pushEnabled && pushPayload) {
        let urgency: 'normal' | 'high' | 'critical' = 'normal';
        if (type === 'emergency') {
          urgency = 'critical';
        } else if (urgent || type === 'approval_request' || type === 'review_needed') {
          urgency = 'high';
        }

        const pushPayloadData = {
          title: pushPayload.title,
          body: pushPayload.body,
          actionUrl: pushPayload.url || action_url || '/dashboard',
          urgency,
          data: { notificationId, type },
        };

        const pushResult = await PushService.sendPushToUser(userId, pushPayloadData);
        if (pushResult.sent > 0) deliveredVia.push('push');
      }

      // 7. Update delivered_via
      await supabaseAdmin
        .from('notifications')
        .update({ delivered_via: deliveredVia })
        .eq('id', notificationId);

      results.push({ userId, notificationId });
    }

    return res.json({ success: true, dispatched: results.length, results });
  } catch (error) {
    console.error('[Dispatch] Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'Failed to dispatch notifications' });
  }
}

// ── getUserNotifications ──────────────────────────────────────────────────
// GET /api/notifications

export async function getUserNotifications(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
}

// ── sendNotification (legacy) ─────────────────────────────────────────────
// POST /api/notifications/send  (kept for backward compatibility)

export async function sendNotification(req: Request, res: Response) {
  const { recipientIds, title, message, type, data } = req.body;
  return dispatchNotification(
    { ...req, body: { userIds: recipientIds, title, message, type, metadata: data } } as any,
    res
  );
}

// ── updateNotificationPreferences (legacy) ────────────────────────────────
// PUT /api/notifications/preferences

export async function updateNotificationPreferences(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { email_enabled, push_enabled, sms_enabled, whatsapp_enabled } = req.body;

    const { error } = await supabaseAdmin
      .from('user_notification_preferences')
      .upsert({ user_id: user.id, email_enabled, push_enabled, sms_enabled, whatsapp_enabled }, { onConflict: 'user_id' });

    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
}

// ── getVapidPublicKey ─────────────────────────────────────────────────────
// GET /api/notifications/vapid-public-key
// Returns the VAPID public key so the frontend can create a PushSubscription.

export async function getVapidPublicKey(_req: Request, res: Response) {
  try {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) {
      return res.status(503).json({ success: false, error: 'Web Push not configured' });
    }
    return res.json({ success: true, vapidPublicKey: key });
  } catch (error) {
    console.error('[getVapidPublicKey] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve VAPID key' });
  }
}

// ── registerDevice ────────────────────────────────────────────────────────
// POST /api/notifications/devices/register
// Body: { subscription: { endpoint, keys: { p256dh, auth } }, deviceType?, email? }
//   -- OR legacy --
// Body: { fcmToken, deviceType?, email? }  (ignored — responds OK to avoid client errors)

export async function registerDevice(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { subscription, deviceType } = req.body;

    // Never log endpoints or encryption keys; both are bearer-like device credentials.

    // Validate Web Push subscription shape
    if (!subscription) {
      console.error('[RegisterDevice] Missing subscription object');
      return res.status(400).json({
        success: false,
        error: 'subscription object is required',
      });
    }

    // Check VAPID configuration
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.error('[RegisterDevice] VAPID keys not configured');
      return res.status(503).json({
        success: false,
        error: 'Web Push not configured on server',
      });
    }

    if (
      typeof subscription.endpoint !== 'string' ||
      !subscription.endpoint ||
      !subscription.keys ||
      typeof subscription.keys !== 'object' ||
      typeof subscription.keys.p256dh !== 'string' ||
      typeof subscription.keys.auth !== 'string' ||
      !subscription.keys.p256dh.trim() ||
      !subscription.keys.auth.trim()
    ) {
      console.error('[RegisterDevice] Invalid subscription format:', {
        hasEndpoint: typeof subscription.endpoint === 'string' && Boolean(subscription.endpoint),
        hasP256dh: typeof subscription.keys?.p256dh === 'string' && Boolean(subscription.keys.p256dh),
        hasAuth: typeof subscription.keys?.auth === 'string' && Boolean(subscription.keys.auth),
      });
      return res.status(400).json({
        success: false,
        error: 'subscription must have endpoint (string) and keys.p256dh, keys.auth',
      });
    }

    const endpoint: string = subscription.endpoint.trim();
    const p256dh = typeof subscription.keys.p256dh === 'string' ? subscription.keys.p256dh.trim() : '';
    const auth = typeof subscription.keys.auth === 'string' ? subscription.keys.auth.trim() : '';
    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      return res.status(400).json({ success: false, error: 'subscription endpoint must be a valid HTTPS URL' });
    }
    if (endpointUrl.protocol !== 'https:' || endpoint.length > 2048 || p256dh.length > 512 || auth.length > 256) {
      return res.status(400).json({ success: false, error: 'subscription endpoint or keys are invalid' });
    }
    const pushKeys = { p256dh, auth };

    // Resolve preferred email from role_recipients (preferred > default > auth email)
    let deviceEmail: string | null = null;
    const { data: recipientForDevice } = await supabaseAdmin
      .from('role_recipients')
      .select('email, preferred_notification_email')
      .eq('supabase_uid', user.id)
      .maybeSingle();
    if (recipientForDevice) {
      deviceEmail = recipientForDevice.preferred_notification_email || recipientForDevice.email || null;
    }
    if (!deviceEmail && user.email && typeof user.email === 'string') {
      deviceEmail = user.email;
    }

    console.log('[RegisterDevice] Registering web device for user:', user.id, 'provider:', endpointUrl.hostname);

    const now = new Date().toISOString();

    // UPSERT on fcm_token (globally unique endpoint) — handles both insert and key rotation
    const { error: upsertError } = await supabaseAdmin
      .from('user_devices')
      .upsert(
        {
          user_id: user.id,
          fcm_token: endpoint,
          device_type: deviceType || 'web',
          last_seen: now,
          email: deviceEmail,
          push_keys: pushKeys,
        },
        { onConflict: 'fcm_token' }
      );

    if (upsertError) {
      console.error('[RegisterDevice] DB Operation failed:', upsertError);
      return res.status(500).json({ success: false, error: 'Database operation failed: ' + upsertError.message });
    }
    
    console.log('[RegisterDevice] Success for user:', user.id);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[RegisterDevice] Unexpected error:', error);
    console.error('[RegisterDevice] Error stack:', error?.stack);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to register device: ' + (error?.message || 'Unknown error')
    });
  }
}

// ── unregisterDevice ──────────────────────────────────────────────────────
// DELETE /api/notifications/devices/:token
// :token is the URL-encoded Web Push endpoint

export async function unregisterDevice(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, error: 'token param is required' });

    // token param = URL-encoded Web Push endpoint (stored in fcm_token column)
    const endpoint = decodeURIComponent(token);

    const { error } = await supabaseAdmin
      .from('user_devices')
      .delete()
      .eq('user_id', user.id)
      .eq('fcm_token', endpoint);

    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to unregister device' });
  }
}

// ── resendNotification ────────────────────────────────────────────────────
// POST /api/notifications/:id/resend

export async function resendNotification(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { id } = req.params;

    // Verify the notification belongs to the requesting user
    const { data: notif, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !notif) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    // Allow the owner or admin/service_role
    if ((notif as any).user_id !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const result = await EmailService.resendEmail(id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to resend notification' });
  }
}

// ── dispatchChatPush ──────────────────────────────────────────────────────
// POST /api/notifications/chat-push
// Push-only endpoint for chat events. Does NOT create a notifications row
// (chat has its own real-time UI). Respects push_enabled preference.

interface ChatPushBody {
  channel_id?: string;
  document_id?: string;
  emails?: string[];
  exclude_user_id?: string;
  title: string;
  body: string;
  action_url?: string;
}

export async function dispatchChatPush(req: Request, res: Response) {
  try {
    const { channel_id, document_id, emails, exclude_user_id, title, body, action_url } = req.body as ChatPushBody;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }

    const userIds = new Set<string>();

    // Resolve members from channel_id
    if (channel_id) {
      const { data: channel } = await supabaseAdmin
        .from('chat_channels')
        .select('members')
        .eq('id', channel_id)
        .single();
      if (channel?.members) {
        (channel.members as string[]).forEach(id => userIds.add(id));
      }
    }

    // Resolve members from document_id (DB trigger may not have fired yet — retry once)
    if (document_id) {
      let channel: { members: string[] } | null = null;

      const fetchByDocId = async () => {
        const { data } = await supabaseAdmin
          .from('chat_channels')
          .select('members')
          .eq('document_id', document_id)
          .maybeSingle();
        return data as { members: string[] } | null;
      };

      channel = await fetchByDocId();
      if (!channel) {
        // DB trigger may still be running — wait 1.5 s and retry once
        await new Promise(resolve => setTimeout(resolve, 1500));
        channel = await fetchByDocId();
      }

      if (channel?.members) {
        (channel.members as string[]).forEach(id => userIds.add(id));
      }
    }

    // Remove excluded user (typically the sender)
    if (exclude_user_id) userIds.delete(exclude_user_id);

    const pushPayload = { title, body, actionUrl: action_url };
    let sent = 0;
    let failed = 0;

    // Send to resolved user IDs (respecting push_enabled preference)
    const userIdList = Array.from(userIds);
    await Promise.all(userIdList.map(async (userId) => {
      const { data: prefs } = await supabaseAdmin
        .from('user_notification_preferences')
        .select('push_enabled')
        .eq('user_id', userId)
        .single();

      const pushEnabled = prefs?.push_enabled ?? true;
      if (!pushEnabled) return;

      const result = await PushService.sendPushToUser(userId, {
        title,
        body,
        actionUrl: action_url ?? '/messages',
        urgency: 'normal',
        data: { url: action_url ?? '/messages', type: 'chat' },
      }).catch((err: unknown) => {
        console.error('[ChatPush] Push error for user', userId, err);
        return { sent: 0, failed: 1 };
      });
      sent += result.sent;
      failed += result.failed;
    }));

    // Email targeting is a fallback for callers that cannot resolve channel
    // members. It is skipped when user IDs were already resolved to avoid
    // duplicate delivery to the same endpoint.
    if (userIdList.length === 0 && emails && emails.length > 0) {
      const uniqueEmails = [...new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean))];
      const emailResults = await Promise.all(uniqueEmails.map(async (email) => {
        return PushService.sendPushToEmailDirect(email, {
          title,
          body,
          actionUrl: action_url ?? '/messages',
          urgency: 'normal',
          data: { url: action_url ?? '/messages', type: 'chat' },
        }).catch((err: unknown) => {
          console.error('[ChatPush] Email-direct push error for', email);
          return { sent: 0, failed: 1 };
        });
      }));
      sent += emailResults.reduce((total, result) => total + result.sent, 0);
      failed += emailResults.reduce((total, result) => total + result.failed, 0);
    }

    return res.json({ success: true, sent, failed });
  } catch (error) {
    console.error('[ChatPush] Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'Failed to dispatch chat push' });
  }
}

// ── syncDeviceEmail ───────────────────────────────────────────────────────
// POST /api/notifications/devices/sync-email
// Called when user changes preferred notification email.
// Updates all registered devices for that user with the new email.

export async function syncDeviceEmail(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { email } = req.body as { email?: unknown };
    const normalizedEmail = email === null
      ? null
      : typeof email === 'string' && email.trim()
        ? email.trim()
        : undefined;
    if (normalizedEmail === undefined || (normalizedEmail !== null && !normalizedEmail.includes('@'))) {
      return res.status(400).json({ success: false, error: 'Valid email or null is required' });
    }

    const result = await PushService.updateUserDevicesEmail(user.id, normalizedEmail);
    console.log(`[SyncDeviceEmail] Updated ${result.updated} device(s) for user ${user.id}`);
    return res.json({ success: true, updated: result.updated });
  } catch (error) {
    console.error('[SyncDeviceEmail] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to sync device emails' });
  }
}