import {
  Meeting,
  MeetingLinks,
  CreateMeetingResponse,
  ConflictCheck,
  AISchedulingSuggestion,
  AttendanceRecord,
} from '@/types/meeting';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// MeetingAPIService — Secure frontend client
// All platform integrations (Google Meet, Zoom) run on the backend.
// No API keys or secrets are stored in the frontend.
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Continue without auth header
  }

  return headers;
}

export class MeetingAPIService {
  private apiUrl: string;

  constructor() {
    // Use relative '/api' so Vite proxy routes to backend; no CORS issues in dev.
    this.apiUrl = import.meta.env.VITE_API_URL || '/api';
  }

  // -------------------------------------------------------------------------
  // Create Meeting — backend handles platform link generation + DB save
  // -------------------------------------------------------------------------
  async createMeeting(meeting: Partial<Meeting>): Promise<CreateMeetingResponse> {
    const headers = await getAuthHeaders();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.apiUrl}/meetings`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          title: meeting.title,
          description: meeting.description,
          date: meeting.date,
          time: meeting.time,
          duration: meeting.duration,
          location: meeting.location,
          type: meeting.type,
          status: meeting.status || 'scheduled',
          priority: meeting.priority || 'medium',
          category: meeting.category || 'academic',
          isRecurring: meeting.isRecurring,
          recurringPattern: meeting.recurringPattern,
          attendees: meeting.attendees,
          tags: meeting.tags,
          department: meeting.department,
          documents: meeting.documents,
          notifications: meeting.notifications,
          approvalWorkflow: meeting.approvalWorkflow,
          createdBy: meeting.createdBy,
          // Platform selection for the backend
          platform: meeting.meetingLinks?.primary || 'iaoms-meet',
          meetingLinks: meeting.meetingLinks,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create meeting: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        meeting: data.meeting,
        meetingLinks: data.meetingLinks || { primary: 'physical' },
        notifications: data.notifications || [],
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Meeting creation timed out. Please try again.');
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Join Meeting — backend validates access and returns join URL securely
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Join Meeting — backend validates access and returns join URL securely.
  // Throws an error with expired=true flag when the meeting has ended.
  // -------------------------------------------------------------------------
  async joinMeeting(meetingId: string): Promise<{ joinUrl: string; platform: string; isHost: boolean }> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/meetings/${meetingId}/join`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // HTTP 410 Gone — meeting session has expired
      if (response.status === 410 || (errorData as { expired?: boolean }).expired === true) {
        const expiredMsg = (errorData as { error?: string }).error || 'This meeting has ended.';
        throw Object.assign(new Error(expiredMsg), { expired: true });
      }

      throw new Error(errorData.error || 'Failed to join meeting');
    }

    const data = await response.json();
    return {
      joinUrl: data.joinUrl,
      platform: data.platform,
      isHost: data.isHost,
    };
  }

  // -------------------------------------------------------------------------
  // Check Conflicts
  // -------------------------------------------------------------------------
  async checkConflicts(meeting: Partial<Meeting>): Promise<ConflictCheck> {
    try {
      const response = await fetch(`${this.apiUrl}/meetings/conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: meeting.date,
          time: meeting.time,
          duration: meeting.duration,
          attendees: meeting.attendees?.map(a => a.id),
        }),
      });

      if (!response.ok) {
        return { hasConflict: false, conflicts: [], suggestions: [] };
      }

      return await response.json();
    } catch {
      return { hasConflict: false, conflicts: [], suggestions: [] };
    }
  }

  // -------------------------------------------------------------------------
  // AI Scheduling Suggestions
  // -------------------------------------------------------------------------
  async getAISchedulingSuggestions(meeting: Partial<Meeting>): Promise<AISchedulingSuggestion> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/meetings/ai-suggestions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: meeting.title,
        description: meeting.description,
        attendees: meeting.attendees?.map(a => a.id),
        preferredDuration: meeting.duration,
        department: meeting.department,
        priority: meeting.priority,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI suggestions failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // -------------------------------------------------------------------------
  // Update Meeting
  // -------------------------------------------------------------------------
  async updateMeeting(meetingId: string, updates: Partial<Meeting>): Promise<Meeting> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/meetings/${meetingId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Meeting update failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  // -------------------------------------------------------------------------
  // Cancel Meeting
  // -------------------------------------------------------------------------
  async cancelMeeting(meetingId: string, reason?: string): Promise<boolean> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/meetings/${meetingId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'cancelled' }),
    });

    return response.ok;
  }

  // -------------------------------------------------------------------------
  // Track Attendance
  // -------------------------------------------------------------------------
  async trackAttendance(meetingId: string): Promise<AttendanceRecord[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${this.apiUrl}/meetings/${meetingId}/attendance`, {
        headers,
      });

      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Generate MOM (Minutes of Meeting)
  // -------------------------------------------------------------------------
  async generateMOM(meetingId: string): Promise<string> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${this.apiUrl}/meetings/${meetingId}/mom`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      throw new Error(`MOM generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.momUrl;
  }
}

export const meetingAPI = new MeetingAPIService();
