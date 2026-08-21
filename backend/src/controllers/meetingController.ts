import { Request, Response } from 'express';
import {
  createGoogleMeetEvent,
  createZoomMeeting,
  saveMeetingToDb,
  getMeetings,
  getMeetingById,
  updateMeetingInDb,
  deleteMeetingFromDb,
  createMeetingSession,
  getActiveSession,
  recordParticipantJoin,
  formatMeetingForFrontend,
  isZoomConfigured,
  isGoogleConfigured,
  computeEndTime,
} from '../services/meetingService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a fallback join URL from a platform name when no stored link exists */
function getFallbackJoinUrl(platform: string): string {
  switch (platform) {
    case 'google-meet':
    case 'meet':
      return 'https://meet.google.com/new';
    case 'zoom':
      return 'https://zoom.us/start/videomeeting';
    case 'teams':
      return 'https://teams.microsoft.com/';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// POST /api/meetings — Create meeting
// ---------------------------------------------------------------------------
export async function createMeeting(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const body = req.body;

    if (!body.title || !body.date || !body.time) {
      return res.status(400).json({
        success: false,
        error: 'title, date, and time are required',
      });
    }

    // Determine platform — auto-select best available if requested platform isn't configured
    const meetingType: string = body.type || 'physical';
    let platform: string = body.platform || body.meetingLinks?.primary || 'physical';

    // Prefer Zoom when Google service account isn't set up
    if ((platform === 'google-meet' || platform === 'meet') && !isGoogleConfigured() && isZoomConfigured()) {
      console.log('[MeetingController] Google service account not configured — using Zoom instead');
      platform = 'zoom';
    }

    const meetingLinks: any = { primary: platform };
    let zoomResult: any = null;

    // Generate platform meeting link if online/hybrid
    if ((meetingType === 'online' || meetingType === 'hybrid') && platform !== 'physical') {
      try {
        if (platform === 'zoom') {
          // Step 1: Create Zoom meeting (real room generated via Server-to-Server OAuth)
          zoomResult = await createZoomMeeting(body);
          meetingLinks.zoom = zoomResult;
          meetingLinks.primary = 'zoom';

          // Step 2: Create Google Calendar event that includes the Zoom link so attendees
          // receive email calendar invitations with the correct meeting URL
          if (isGoogleConfigured()) {
            try {
              await createGoogleMeetEvent(body, zoomResult.joinUrl);
              console.log('[MeetingController] Google Calendar invite sent with Zoom link');
            } catch (calErr: any) {
              // Non-blocking — Zoom room is still available
              console.warn('[MeetingController] Google Calendar invite failed (non-blocking):', calErr.message);
            }
          }
        } else if (platform === 'google-meet' || platform === 'meet') {
          const gmeet = await createGoogleMeetEvent(body);
          meetingLinks.googleMeet = gmeet;
          meetingLinks.primary = 'google-meet';
        } else {
          // Default: try Zoom first, then Google Meet
          if (isZoomConfigured()) {
            try {
              zoomResult = await createZoomMeeting(body);
              meetingLinks.zoom = zoomResult;
              meetingLinks.primary = 'zoom';
            } catch {
              console.warn('[MeetingController] Zoom fallback failed');
            }
          }
          if (!zoomResult && isGoogleConfigured()) {
            try {
              const gmeet = await createGoogleMeetEvent(body);
              meetingLinks.googleMeet = gmeet;
              meetingLinks.primary = 'google-meet';
            } catch {
              console.warn('[MeetingController] Google Meet fallback also failed');
            }
          }
        }
      } catch (platformError: any) {
        console.warn('[MeetingController] Platform integration failed:', platformError.message);
        // Continue — fallback URL will be set below
      }

      // If no real platform URL was generated, store a fallback
      const hasRealLink = meetingLinks.googleMeet?.joinUrl || meetingLinks.zoom?.joinUrl;
      if (!hasRealLink) {
        const fallbackUrl = getFallbackJoinUrl(platform);
        if (fallbackUrl) {
          meetingLinks.joinUrl = fallbackUrl;
          console.log(`[MeetingController] Stored fallback join URL for platform "${platform}": ${fallbackUrl}`);
        }
      }
    }

    // Build the meeting record
    const durationMins = body.duration || 60;
    const meetingInput = {
      title: body.title,
      description: body.description || '',
      date: body.date,
      time: body.time,
      duration: durationMins,
      location: body.location || '',
      type: meetingType as any,
      status: body.status || 'scheduled',
      priority: body.priority || 'medium',
      category: body.category || 'academic',
      is_recurring: !!body.isRecurring,
      recurring_pattern: body.recurringPattern || null,
      attendees: body.attendees || [],
      tags: body.tags || [],
      department: body.department || '',
      documents: body.documents || [],
      meeting_links: meetingLinks,
      notifications: body.notifications || null,
      approval_workflow: body.approvalWorkflow || null,
      created_by: user?.id || body.createdBy || 'unknown',
      platform,
    };

    // Save to Supabase
    const savedRow = await saveMeetingToDb(meetingInput);

    // Always create a session record for online/hybrid meetings so all joins use it
    if (meetingType === 'online' || meetingType === 'hybrid') {
      const joinUrl =
        meetingLinks.zoom?.joinUrl ||
        meetingLinks.googleMeet?.joinUrl ||
        meetingLinks.joinUrl ||
        getFallbackJoinUrl(platform);

      const startUrl = meetingLinks.zoom?.startUrl || joinUrl;
      const password = meetingLinks.zoom?.password;
      const endTime = computeEndTime(body.date, body.time, durationMins);

      if (joinUrl) {
        try {
          await createMeetingSession(
            savedRow.id,
            meetingInput.created_by,
            meetingLinks.primary,
            joinUrl,
            startUrl,
            password,
            endTime
          );
          console.log('[MeetingController] Meeting session stored for meeting:', savedRow.id);
        } catch (sessionError: any) {
          console.warn('[MeetingController] Session creation failed (non-blocking):', sessionError.message);
        }
      }
    }

    const formatted = formatMeetingForFrontend(savedRow);

    return res.status(201).json({
      success: true,
      meeting: formatted,
      meetingLinks,
      notifications: [],
    });
  } catch (error: any) {
    console.error('[MeetingController] Create meeting failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create meeting',
    });
  }
}

// ---------------------------------------------------------------------------
// GET /api/meetings — List meetings
// ---------------------------------------------------------------------------
export async function listMeetings(req: Request, res: Response) {
  try {
    const rows = await getMeetings();
    const meetings = rows.map(formatMeetingForFrontend);
    return res.json({ success: true, data: meetings });
  } catch (error: any) {
    console.error('[MeetingController] List meetings failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch meetings' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/meetings/:id — Get a single meeting
// ---------------------------------------------------------------------------
export async function getMeetingDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const row = await getMeetingById(id);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    return res.json({ success: true, data: formatMeetingForFrontend(row) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch meeting' });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/meetings/:id — Update meeting
// ---------------------------------------------------------------------------
export async function updateMeeting(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: Record<string, any> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.date !== undefined) updates.date = body.date;
    if (body.time !== undefined) updates.time = body.time;
    if (body.duration !== undefined) updates.duration = body.duration;
    if (body.location !== undefined) updates.location = body.location;
    if (body.type !== undefined) updates.type = body.type;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.category !== undefined) updates.category = body.category;
    if (body.isRecurring !== undefined) updates.is_recurring = body.isRecurring;
    if (body.recurringPattern !== undefined) updates.recurring_pattern = body.recurringPattern;
    if (body.attendees !== undefined) updates.attendees = body.attendees;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.department !== undefined) updates.department = body.department;
    if (body.documents !== undefined) updates.documents = body.documents;
    if (body.meetingLinks !== undefined) updates.meeting_links = body.meetingLinks;
    if (body.notifications !== undefined) updates.notifications = body.notifications;
    if (body.approvalWorkflow !== undefined) updates.approval_workflow = body.approvalWorkflow;

    const row = await updateMeetingInDb(id, updates);
    return res.json({ success: true, data: formatMeetingForFrontend(row) });
  } catch (error: any) {
    console.error('[MeetingController] Update meeting failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update meeting' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/meetings/:id — Delete meeting
// ---------------------------------------------------------------------------
export async function deleteMeeting(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await deleteMeetingFromDb(id);
    return res.json({ success: true, message: 'Meeting deleted' });
  } catch (error: any) {
    console.error('[MeetingController] Delete meeting failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete meeting' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/meetings/:id/join — Join a meeting (returns stored link securely)
// ---------------------------------------------------------------------------
export async function joinMeeting(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Fetch the meeting record
    const meeting = await getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Physical meetings have no online link
    if (meeting.type === 'physical') {
      return res.status(404).json({
        success: false,
        error: meeting.location
          ? `This is a physical meeting. Location: ${meeting.location}`
          : 'This is a physical meeting — no online link available.',
      });
    }

    const isCreator = meeting.created_by === user?.id;

    // -----------------------------------------------------------------------
    // CRITICAL: always get the stored session — NEVER generate a new link here
    // -----------------------------------------------------------------------
    const session = await getActiveSession(id);

    // Session is expired → return 410 Gone so frontend shows "Expired"
    if (session && session.status === 'expired') {
      return res.status(410).json({
        success: false,
        expired: true,
        error: 'This meeting has ended.',
      });
    }

    let joinUrl = '';
    let platform = meeting.meeting_links?.primary || 'google-meet';

    if (session) {
      // Reuse the stored session URL — host gets startUrl if available
      joinUrl = isCreator ? (session.start_url || session.join_url) : session.join_url;
      platform = session.platform;

      // Track participant attendance (non-blocking)
      recordParticipantJoin(session.id, user?.id || 'anonymous', isCreator ? 'host' : 'participant')
        .catch(() => { /* non-blocking */ });
    } else {
      // No session stored — try meeting_links as fallback (created before migration)
      const links = meeting.meeting_links || {};
      if (links.zoom?.joinUrl) {
        joinUrl = isCreator ? (links.zoom.startUrl || links.zoom.joinUrl) : links.zoom.joinUrl;
        platform = 'zoom';
      } else if (links.googleMeet?.joinUrl) {
        joinUrl = links.googleMeet.joinUrl;
        platform = 'google-meet';
      } else if (links.joinUrl) {
        joinUrl = links.joinUrl;
      }
    }

    // If still no URL, return an error — do NOT generate a new room
    if (!joinUrl) {
      return res.status(404).json({
        success: false,
        error: 'No meeting link has been generated for this session. Please contact the organizer.',
      });
    }

    return res.json({
      success: true,
      joinUrl,
      platform,
      isHost: isCreator,
    });
  } catch (error: any) {
    console.error('[MeetingController] Join meeting failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to join meeting' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/meetings/conflicts — Check scheduling conflicts
// ---------------------------------------------------------------------------
export async function checkConflicts(req: Request, res: Response) {
  try {
    const { date, time, duration, attendees } = req.body;
    const rows = await getMeetings();
    const conflicts: any[] = [];

    if (date && time) {
      const requestedStart = new Date(`${date}T${time}`);
      const requestedEnd = new Date(requestedStart.getTime() + (duration || 60) * 60000);

      for (const row of rows) {
        if (row.date === date && row.status !== 'cancelled') {
          const existingStart = new Date(`${row.date}T${row.time}`);
          const existingEnd = new Date(existingStart.getTime() + (row.duration || 60) * 60000);

          if (requestedStart < existingEnd && requestedEnd > existingStart) {
            conflicts.push({
              meetingId: row.id,
              meetingTitle: row.title,
              conflictTime: { start: existingStart, end: existingEnd },
              severity: 'medium',
            });
          }
        }
      }
    }

    return res.json({
      hasConflict: conflicts.length > 0,
      conflicts,
      suggestions: [],
    });
  } catch (error: any) {
    return res.json({ hasConflict: false, conflicts: [], suggestions: [] });
  }
}

// ---------------------------------------------------------------------------
// POST /api/meetings/:id/notifications — Send meeting notifications
// ---------------------------------------------------------------------------
export async function sendNotifications(req: Request, res: Response) {
  try {
    return res.json([]);
  } catch {
    return res.json([]);
  }
}
