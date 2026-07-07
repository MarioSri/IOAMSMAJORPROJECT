import { google, calendar_v3 } from 'googleapis';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Meeting Service — Handles Google Calendar, Zoom, and Supabase persistence
// ---------------------------------------------------------------------------

interface MeetingInput {
  title: string;
  description?: string;
  date: string;
  time: string;
  duration?: number;
  location?: string;
  type: 'online' | 'physical' | 'hybrid';
  status?: string;
  priority?: string;
  category?: string;
  is_recurring?: boolean;
  recurring_pattern?: any;
  attendees?: any[];
  tags?: string[];
  department?: string;
  documents?: string[];
  meeting_links?: any;
  notifications?: any;
  approval_workflow?: any;
  created_by: string;
  platform?: string; // 'google-meet' | 'zoom' | 'physical'
}

interface GoogleMeetResult {
  meetingId: string;
  joinUrl: string;
  hangoutLink: string;
  conferenceId: string;
  calendarEventId: string;
  status: 'success' | 'failed';
  createdAt: Date;
}

interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password?: string;
  meetingNumber: string;
  status: 'waiting';
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

/** True when Zoom Server-to-Server OAuth credentials are present */
export function isZoomConfigured(): boolean {
  return !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET && process.env.ZOOM_ACCOUNT_ID);
}

/** True when a Google Service Account key is available for Calendar / Meet */
export function isGoogleConfigured(): boolean {
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  return !!(
    (keyFilePath && fs.existsSync(path.resolve(keyFilePath))) ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );
}

// ---------------------------------------------------------------------------
// Google Calendar Client (Service Account)
// ---------------------------------------------------------------------------
let _calendar: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar | null {
  if (_calendar) return _calendar;

  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let auth: any;

  if (keyFilePath && fs.existsSync(path.resolve(keyFilePath))) {
    auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(keyFilePath),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });
  } else if (keyJsonRaw) {
    const credentials = JSON.parse(keyJsonRaw);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });
  } else {
    console.warn('[MeetingService] No Google Service Account credentials. Google Calendar integration disabled.');
    return null;
  }

  _calendar = google.calendar({ version: 'v3', auth });
  return _calendar;
}

// ---------------------------------------------------------------------------
// Zoom Server-to-Server OAuth
// ---------------------------------------------------------------------------
let _zoomToken: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const accountId = process.env.ZOOM_ACCOUNT_ID;

  if (!clientId || !clientSecret || !accountId) {
    throw new Error('Zoom credentials not configured. Set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID.');
  }

  // Return cached token if still valid
  if (_zoomToken && Date.now() < _zoomToken.expiresAt - 60000) {
    return _zoomToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[MeetingService] Zoom OAuth error:', error);
    throw new Error('Failed to obtain Zoom access token');
  }

  const data: any = await response.json();
  _zoomToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return _zoomToken.token;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a Google Calendar event and attempts to attach a Google Meet conference.
 *
 * NOTE: Standard GCP service accounts (non-Google-Workspace) cannot create
 * Meet conference rooms — only Workspace accounts with domain-wide delegation can.
 * When conferenceData is not supported, the Calendar event is still created and
 * the Zoom join URL (if available) is embedded in the description so attendees
 * receive an email invite with the correct link.
 */
export async function createGoogleMeetEvent(
  meeting: MeetingInput,
  zoomJoinUrl?: string
): Promise<GoogleMeetResult> {
  const calendar = getCalendarClient();
  if (!calendar) {
    throw new Error('Google Calendar not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON.');
  }

  const startDateTime = formatDateTime(meeting.date, meeting.time);
  const endDateTime = formatDateTime(meeting.date, meeting.time, meeting.duration || 60);
  const timezone = 'Asia/Kolkata';

  // Build description — embed zoom link if provided so email invite is useful
  const videoLinkText = zoomJoinUrl
    ? `\n\n🔗 Join Video Call (Zoom): ${zoomJoinUrl}`
    : '\n\n🔗 Join online meeting from your calendar invite.';

  const description = (meeting.description || '') + videoLinkText;

  const event: calendar_v3.Schema$Event = {
    summary: meeting.title,
    description,
    start: { dateTime: startDateTime, timeZone: timezone },
    end: { dateTime: endDateTime, timeZone: timezone },
    attendees: (meeting.attendees || [])
      .filter((a: any) => a.email)
      .map((a: any) => ({
        email: a.email,
        displayName: a.name,
        responseStatus: 'needsAction',
      })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
    // Request conferenceData — works only with Workspace domain delegation
    conferenceData: {
      createRequest: {
        requestId: `iaoms-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  console.log('[MeetingService] Creating Google Calendar event...');

  let result: any = { id: '', hangoutLink: '' };
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      // conferenceDataVersion=1 requests Meet room creation
      conferenceDataVersion: 1,
      requestBody: event,
    });
    result = response.data;
    if (result.hangoutLink) {
      console.log('[MeetingService] Google Meet room created:', result.hangoutLink);
    } else {
      console.log('[MeetingService] Calendar event created (no Meet room — service account limitation):', result.id);
    }
  } catch (calendarError: any) {
    console.warn('[MeetingService] Calendar event creation failed:', calendarError.message);
    // Non-blocking — continue
  }

  // Use hangoutLink from API if available; otherwise use Zoom URL or fallback
  const joinUrl = result.hangoutLink || zoomJoinUrl || 'https://meet.google.com/new';

  return {
    meetingId: result.id || '',
    joinUrl,
    hangoutLink: joinUrl,
    conferenceId: result.conferenceData?.conferenceId || '',
    calendarEventId: result.id || '',
    status: 'success',
    createdAt: new Date(),
  };
}

export async function createZoomMeeting(meeting: MeetingInput): Promise<ZoomMeetingResult> {
  const accessToken = await getZoomAccessToken();
  const startDateTime = formatDateTime(meeting.date, meeting.time);

  const meetingData = {
    topic: meeting.title,
    type: 2, // Scheduled meeting
    start_time: startDateTime,
    duration: meeting.duration || 60,
    timezone: 'Asia/Kolkata',
    agenda: meeting.description || '',
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: true,
      mute_upon_entry: false,
      watermark: false,
      use_pmi: false,
      approval_type: 2,
      audio: 'both',
      auto_recording: 'none',
      waiting_room: false,
    },
  };

  console.log('[MeetingService] Creating Zoom meeting...');

  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meetingData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[MeetingService] Zoom API error:', error);
    throw new Error(`Zoom API error: ${(error as any).message || response.statusText}`);
  }

  const zoomMeeting: any = await response.json();
  const meetingId = String(zoomMeeting.id);

  console.log('[MeetingService] Zoom meeting created:', zoomMeeting.join_url);

  return {
    meetingId,
    joinUrl: zoomMeeting.join_url || '',
    startUrl: zoomMeeting.start_url || '',
    password: zoomMeeting.password || '',
    meetingNumber: meetingId,
    status: 'waiting',
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Supabase CRUD
// ---------------------------------------------------------------------------

export async function saveMeetingToDb(meeting: MeetingInput & { meeting_links?: any }): Promise<any> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const record = {
    title: meeting.title,
    description: meeting.description || null,
    date: meeting.date,
    time: meeting.time,
    duration: meeting.duration || 60,
    location: meeting.location || null,
    type: meeting.type,
    status: meeting.status || 'scheduled',
    priority: meeting.priority || 'medium',
    category: meeting.category || 'academic',
    is_recurring: !!meeting.is_recurring,
    recurring_pattern: meeting.recurring_pattern || null,
    attendees: meeting.attendees || [],
    tags: meeting.tags || [],
    department: meeting.department || null,
    documents: meeting.documents || [],
    meeting_links: meeting.meeting_links || null,
    notifications: meeting.notifications || null,
    approval_workflow: meeting.approval_workflow || null,
    created_by: meeting.created_by,
  };

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('[MeetingService] Supabase insert error:', error.message);
    throw new Error(`Failed to save meeting: ${error.message}`);
  }

  console.log('[MeetingService] Meeting saved to Supabase:', data.id);
  return data;
}

export async function getMeetings(userId?: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabaseAdmin
    .from('meetings')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[MeetingService] Supabase fetch error:', error.message);
    throw new Error(`Failed to fetch meetings: ${error.message}`);
  }

  return data || [];
}

export async function getMeetingById(id: string): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[MeetingService] Supabase fetch error:', error.message);
    return null;
  }

  return data;
}

export async function updateMeetingInDb(id: string, updates: Record<string, any>): Promise<any> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[MeetingService] Supabase update error:', error.message);
    throw new Error(`Failed to update meeting: ${error.message}`);
  }

  return data;
}

export async function deleteMeetingFromDb(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { error } = await supabaseAdmin
    .from('meetings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[MeetingService] Supabase delete error:', error.message);
    throw new Error(`Failed to delete meeting: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Session tracking — each meeting has AT MOST ONE active session
// ---------------------------------------------------------------------------

/**
 * Creates a meeting session record.
 * Uses ON CONFLICT DO NOTHING so a second call for the same meeting_id is a no-op
 * (prevents duplicate sessions when multiple users create/join simultaneously).
 */
export async function createMeetingSession(
  meetingId: string,
  hostUserId: string,
  platform: string,
  joinUrl: string,
  startUrl?: string,
  password?: string,
  endTime?: Date
): Promise<any> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  // First check if an active session already exists — return it if so
  const existing = await getActiveSession(meetingId);
  if (existing && existing.status === 'active') {
    console.log('[MeetingService] Session already exists for meeting:', meetingId);
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('meeting_sessions')
    .insert({
      meeting_id: meetingId,
      host_user_id: hostUserId,
      platform,
      join_url: joinUrl,
      start_url: startUrl || null,
      password: password || null,
      status: 'active',
      started_at: new Date().toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation — another session was just created concurrently
    if (error.code === '23505') {
      console.log('[MeetingService] Concurrent session creation detected — fetching existing session');
      return await getActiveSession(meetingId);
    }
    console.error('[MeetingService] Session insert error:', error.message);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data;
}

/**
 * Returns the active session for a meeting, or null if none.
 * Auto-marks the session as 'expired' if end_time has passed.
 */
export async function getActiveSession(meetingId: string): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabaseAdmin
    .from('meeting_sessions')
    .select('*')
    .eq('meeting_id', meetingId)
    .in('status', ['active', 'expired'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[MeetingService] Session fetch error:', error.message);
    return null;
  }

  if (!data) return null;

  // Auto-expire: if end_time has passed and session is still 'active', mark it expired
  if (data.status === 'active' && data.end_time) {
    const endTime = new Date(data.end_time);
    if (new Date() > endTime) {
      await supabaseAdmin
        .from('meeting_sessions')
        .update({ status: 'expired', ended_at: new Date().toISOString() })
        .eq('id', data.id);

      return { ...data, status: 'expired' };
    }
  }

  return data;
}

export async function recordParticipantJoin(sessionId: string, userId: string, role: 'host' | 'participant'): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabaseAdmin
    .from('meeting_participants')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role,
      joined_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[MeetingService] Participant insert error:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats date + time as an ISO datetime string.
 * If durationMinutes is provided, adds it to compute the end time.
 */
function formatDateTime(date: string, time: string, durationMinutes?: number): string {
  const [hours, minutes] = time.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

  if (durationMinutes) {
    d.setMinutes(d.getMinutes() + durationMinutes);
  }

  return d.toISOString();
}

/**
 * Computes the end time Date object from date + time + duration (minutes).
 */
export function computeEndTime(date: string, time: string, durationMinutes: number): Date {
  const [hours, minutes] = time.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  d.setMinutes(d.getMinutes() + durationMinutes);
  return d;
}

/** Convert DB snake_case row to frontend camelCase Meeting */
export function formatMeetingForFrontend(row: any): any {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    date: row.date,
    time: row.time,
    duration: row.duration,
    location: row.location || '',
    type: row.type,
    status: row.status,
    priority: row.priority,
    category: row.category,
    isRecurring: row.is_recurring,
    recurringPattern: row.recurring_pattern,
    attendees: row.attendees || [],
    tags: row.tags || [],
    department: row.department || '',
    documents: row.documents || [],
    meetingLinks: row.meeting_links,
    notifications: row.notifications,
    approvalWorkflow: row.approval_workflow,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
