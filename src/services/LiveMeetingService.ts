/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ISOLATION BOUNDARY — LiveMeet+ (Approval-Workflow Communication)  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  This service owns ONLY the `live_meeting_requests` Supabase table. ║
 * ║                                                                      ║
 * ║  LiveMeet+ is a WORKFLOW COORDINATION system:                        ║
 * ║    • Users request real-time discussions on documents                ║
 * ║    • Recipients accept or reject the request                         ║
 * ║    • Status transitions: pending → accepted | rejected               ║
 * ║                                                                      ║
 * ║  LiveMeet+ does NOT:                                                 ║
 * ║    ✗ Generate meeting links (Jitsi / Google Meet / Zoom)             ║
 * ║    ✗ Schedule calendar events                                        ║
 * ║    ✗ Interact with the `meetings` table                              ║
 * ║                                                                      ║
 * ║  DO NOT import: CalendarService, GoogleMeetService, ZoomService,     ║
 * ║                 MeetingAPIService, or useCalendar from this file.    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import {
  LiveMeetingRequest,
  CreateLiveMeetingRequestDto,
  LiveMeetingResponse,
  LiveMeetingStats,
  URGENCY_CONFIGS,
  LIVE_MEETING_PERMISSIONS
} from '../types/liveMeeting';
import { supabase } from '@/lib/supabase';
import { mapRoleTextToKey } from '@/services/AuthService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { safeSetItem } from '@/utils/localStorageCache';

class LiveMeetingService {
  private channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Formats a Date as a local-time ISO string without timezone offset
   * (e.g. "2026-03-10T14:30:00"). This is required because the
   * `requested_time` and `requested_end_time` columns are TIMESTAMP (no TZ),
   * so storing a UTC ISO string (e.g. "...08:30:00Z") would shift the time by
   * the sender's UTC offset when it is read back by the receiver.
   */
  private toLocalISOString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  async createRequest(
    requestData: CreateLiveMeetingRequestDto,
    user: { id: string; name: string; role: string }
  ): Promise<LiveMeetingRequest> {
    // BUG 5 FIX: Always use the verified Supabase auth UID as requester_id so the
    // INSERT RLS policy (requester_id = auth.uid()::text) is satisfied.  The
    // user.id fallback can be a synthetic string for Employee-ID logins which
    // would be rejected by RLS.
    const { data: { session } } = await supabase.auth.getSession();
    const authUid = session?.user?.id;
    if (!authUid) throw new Error('[LiveMeet+] No active Supabase session — cannot create request');

    const urgencyConfig = URGENCY_CONFIGS[requestData.urgency];
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + urgencyConfig.expiresInMinutes);

    const request = {
      document_id: requestData.documentId,
      document_type: requestData.documentType,
      document_title: requestData.documentTitle,
      requester_id: authUid,
      requester_name: user.name,
      requester_role: user.role,
      target_user_id: requestData.targetUserIds[0],
      target_user_name: requestData.targetUserNames?.[0] || 'Recipient',
      target_user_role: requestData.targetUserRoles?.[0] || 'principal',
      urgency: requestData.urgency,
      meeting_format: requestData.meetingFormat,
      purpose: requestData.purpose,
      agenda: requestData.agenda,
      requested_time: requestData.requestedTime ? this.toLocalISOString(requestData.requestedTime) : undefined,
      requested_end_time: requestData.requestedEndTime ? this.toLocalISOString(requestData.requestedEndTime) : undefined,
      location: requestData.location,
      meeting_link: requestData.meetingLink,
      status: 'pending' as const,
      participants: requestData.targetUserIds.map((userId, index) => ({
        id: `participant_${index}`,
        userId,
        userName: requestData.targetUserNames?.[index] || `User ${index + 1}`,
        role: requestData.targetUserRoles?.[index] || 'principal',
        email: requestData.targetUserEmails?.[index] || `user${index + 1}@institution.edu`,
        status: 'invited' as const
      })),
      expires_at: expiresAt.toISOString()
    };

    try {
      // RLS note: the SELECT policy (20260305_livemeet_rls_receiver_only.sql) is scoped
      // to receivers only, so the requester cannot read back the inserted row via .select().
      // We skip the post-insert read and build the return value from the input data; the
      // real-time subscription will deliver the authoritative row to the receiver.
      const { error } = await supabase
        .from('live_meeting_requests')
        .insert(request);

      if (error) throw error;

      const now = new Date().toISOString();
      const formatted = this.formatRequest({
        ...request,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });
      this.cacheRequest(authUid, formatted);
      return formatted;
    } catch (error) {
      console.error('Error creating live meeting request:', error);
      throw error;
    }
  }

  async respondToRequest(response: LiveMeetingResponse): Promise<void> {
    const updates: any = {
      status: response.response === 'accept' ? 'accepted' : 'rejected',
      response: response.message,
      response_time: new Date().toISOString()
    };

    // LiveMeet+ does NOT generate meeting links — it is an approval-workflow
    // communication system, not a video conferencing scheduler.
    // meeting_link remains null; if parties agree to a video call they use
    // the Calendar Meeting Scheduler (Calendar page) independently.

    const { error } = await supabase
      .from('live_meeting_requests')
      .update(updates)
      .eq('id', response.requestId);

    if (error) {
      console.error('Error responding to live meeting request:', error);
      throw error;
    }
  }

  async getMyRequests(userId: string, filter?: 'pending' | 'urgent' | 'immediate' | 'all', recipientId?: string): Promise<LiveMeetingRequest[]> {
    // BUG 4 DIAGNOSTIC: warn when recipientId is absent so incoming requests
    // for this user (stored via role_recipients.id) may not be returned.
    if (!recipientId) {
      console.warn('[LiveMeet+] recipientId is undefined for user', userId,
        '— received requests may not be visible. Ensure role_recipients.supabase_uid is populated.');
    }
    try {
      // Only fetch requests where this user is the RECEIVER (target_user_id).
      // Initiators do not see their own sent requests in the LiveMeet+ view.
      const orFilter = recipientId && recipientId !== userId
        ? `target_user_id.eq.${userId},target_user_id.eq.${recipientId}`
        : `target_user_id.eq.${userId}`;

      let query = supabase
        .from('live_meeting_requests')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false });

      if (filter && filter !== 'all') {
        switch (filter) {
          case 'pending':
            query = query.eq('status', 'pending');
            break;
          case 'urgent':
            query = query.eq('urgency', 'urgent');
            break;
          case 'immediate':
            query = query.eq('urgency', 'immediate');
            break;
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map(this.formatRequest);
      this.cacheRequests(userId, formatted);
      return formatted;
    } catch (error) {
      console.error('Error fetching live meeting requests:', error);
      throw error;
    }
  }

  async getStats(userId: string, userRole?: string, recipientId?: string): Promise<LiveMeetingStats> {
    try {
      // Stats reflect received requests only — mirrors getMyRequests() scoping.
      const orFilter = recipientId && recipientId !== userId
        ? `target_user_id.eq.${userId},target_user_id.eq.${recipientId}`
        : `target_user_id.eq.${userId}`;

      const { data, error } = await supabase
        .from('live_meeting_requests')
        .select('*')
        .or(orFilter);
      if (error) throw error;

      const requests = data || [];
      const today = new Date().toDateString();

      return {
        totalRequests: requests.length,
        pendingRequests: requests.filter((r: any) => r.status === 'pending').length,
        immediateRequests: requests.filter((r: any) => r.urgency === 'immediate').length,
        urgentRequests: requests.filter((r: any) => r.urgency === 'urgent').length,
        todaysMeetings: requests.filter((r: any) => new Date(r.created_at).toDateString() === today).length,
        successRate: requests.length > 0 ? Math.round((requests.filter((r: any) => r.status === 'accepted').length / requests.length) * 100) : 0,
        averageResponseTime: this.calculateAvgResponseTime(requests)
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  subscribeToRequests(
    userId: string,
    recipientId: string | undefined,
    onInsert: (request: LiveMeetingRequest) => void,
    onUpdate: (request: LiveMeetingRequest) => void,
    onDelete: (id: string) => void
  ): () => void {
    // Only surface real-time events where this user is the RECEIVER.
    const isRelevant = (row: any): boolean =>
      row.target_user_id === userId ||
      (recipientId != null && row.target_user_id === recipientId);

    const channelName = `live_meeting_requests_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_meeting_requests' },
        (payload) => {
          if (isRelevant(payload.new)) {
            onInsert(this.formatRequest(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_meeting_requests' },
        (payload) => {
          if (isRelevant(payload.new)) {
            onUpdate(this.formatRequest(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_meeting_requests' },
        (payload) => {
          if (isRelevant(payload.old)) {
            onDelete(payload.old.id);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  private formatRequest(data: any): LiveMeetingRequest {
    return {
      id: data.id,
      type: 'live_communication_request',
      documentId: data.document_id,
      documentType: data.document_type,
      documentTitle: data.document_title,
      requesterId: data.requester_id,
      requesterName: data.requester_name,
      requesterRole: data.requester_role,
      targetUserId: data.target_user_id,
      targetUserName: data.target_user_name,
      targetUserRole: data.target_user_role,
      urgency: data.urgency,
      meetingFormat: data.meeting_format,
      purpose: data.purpose,
      agenda: data.agenda,
      requestedTime: data.requested_time ? new Date(data.requested_time) : undefined,
      requestedEndTime: data.requested_end_time ? new Date(data.requested_end_time) : undefined,
      scheduledTime: data.scheduled_time ? new Date(data.scheduled_time) : undefined,
      meetingLink: data.meeting_link,
      location: data.location,
      status: data.status,
      participants: data.participants || [],
      response: data.response,
      responseTime: data.response_time ? new Date(data.response_time) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      expiresAt: new Date(data.expires_at)
    };
  }

  private calculateAvgResponseTime(requests: any[]): number {
    const responded = requests.filter(r => r.response_time && r.created_at);
    if (responded.length === 0) return 0;

    const totalMinutes = responded.reduce((sum, r) => {
      const created = new Date(r.created_at).getTime();
      const responded = new Date(r.response_time).getTime();
      return sum + (responded - created) / (1000 * 60);
    }, 0);

    return Math.round(totalMinutes / responded.length);
  }

  // P1 FIX: Cache key is scoped to the userId so different users on the same
  // browser session never see each other's cached requests after a role switch.
  private cacheKey(userId: string): string {
    return `live_meeting_requests_cache_${userId}`;
  }

  private cacheRequest(userId: string, request: LiveMeetingRequest): void {
    try {
      const cached = this.getCachedRequests(userId);
      cached.unshift(request);
      safeSetItem(this.cacheKey(userId), JSON.stringify(cached.slice(0, 30)));
    } catch (error) {
      console.error('Error caching request:', error);
    }
  }

  private cacheRequests(userId: string, requests: LiveMeetingRequest[]): void {
    try {
      safeSetItem(this.cacheKey(userId), JSON.stringify(requests.slice(0, 30)));
    } catch (error) {
      console.error('Error caching requests:', error);
    }
  }

  private getCachedRequests(userId: string, filter?: string): LiveMeetingRequest[] {
    try {
      const cached = JSON.parse(localStorage.getItem(this.cacheKey(userId)) || '[]');
      if (!filter || filter === 'all') return cached;

      return cached.filter((req: LiveMeetingRequest) => {
        switch (filter) {
          case 'pending': return req.status === 'pending';
          case 'urgent': return req.urgency === 'urgent';
          case 'immediate': return req.urgency === 'immediate';
          default: return true;
        }
      });
    } catch {
      return [];
    }
  }

  canRequestMeeting(userRole: string, targetUserRole: string): boolean {
    const allowedRoles = LIVE_MEETING_PERMISSIONS[userRole] || [];
    return allowedRoles.includes(targetUserRole) || allowedRoles.includes('all');
  }

  async getAvailableParticipants(
    currentUserRole: string,
    currentUserId?: string
  ): Promise<Array<{ id: string; name: string; role: string; email: string; department: string }>> {
    try {
      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, role, email, department')
        .eq('is_active', true);

      if (error) throw error;

      const rows = data || [];

      // Exclude the current user from the recipient list
      const others = rows.filter((r: any) => r.id !== currentUserId);

      // Normalise a DB role string (e.g. 'HOD', 'Program Department Head', 'hod_cse') to its
      // base permission key. Uses mapRoleTextToKey for display-text → key conversion, then
      // strips the department suffix.
      const norm = (r: string): string => {
        const mapped = mapRoleTextToKey(r); // 'HOD' → 'hod', 'Program Department Head' → 'program-head'
        const s = mapped.toLowerCase().replace(/-/g, '_');
        for (const base of ['program_head', 'hod', 'cdc_employee']) {
          if (s === base || s.startsWith(base + '_')) return base;
        }
        return s;
      };

      // Normalise LIVE_MEETING_PERMISSIONS keys/values — these are already normalised
      // keys (e.g. 'hod_cse', 'program_head_eee') so mapRoleTextToKey must NOT be used
      // on them (it would return 'employee' for any unrecognised key, hiding all HODs etc.).
      const normPermKey = (k: string): string => {
        const s = k.toLowerCase().replace(/-/g, '_');
        for (const base of ['program_head', 'hod', 'cdc_employee']) {
          if (s === base || s.startsWith(base + '_')) return base;
        }
        return s;
      };

      // Collect ALL permission entries whose normalised key matches the caller's base role.
      const callerBase = norm(currentUserRole);
      const matchingEntries = Object.entries(LIVE_MEETING_PERMISSIONS).filter(
        ([key]) => normPermKey(key) === callerBase || key === currentUserRole
      );

      // Unknown role — show everyone so the modal is never empty
      if (matchingEntries.length === 0) return others;

      // Build set of normalised allowed role bases from all matched entries.
      // Use normPermKey (not norm) because the values are already normalised keys.
      const allowedBases = new Set(
        matchingEntries.flatMap(([, vals]) => vals).map(normPermKey)
      );

      if (allowedBases.has('all')) return others;

      return others.filter((r: any) => allowedBases.has(norm(r.role)));
    } catch (error) {
      console.error('Error fetching available participants:', error);
      throw error;
    }
  }
}

export const liveMeetingService = new LiveMeetingService();
