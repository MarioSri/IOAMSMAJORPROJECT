/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ISOLATION BOUNDARY — Calendar / Meeting Scheduler                   ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  This service owns ONLY the `meetings` Supabase table.               ║
 * ║                                                                      ║
 * ║  Responsibilities:                                                   ║
 * ║    • Schedule meetings with Google Meet or Zoom video links           ║
 * ║    • Manage calendar events (date, time, participants, agenda)        ║
 * ║    • Generate and store meeting video links                          ║
 * ║                                                                      ║
 * ║  DO NOT import: LiveMeetingService, useLiveMeeting, or reference     ║
 * ║               the `live_meeting_requests` table from this file.      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Meeting } from '@/types/meeting';

class CalendarService {
  private channels: Map<string, RealtimeChannel> = new Map();

  async getMeetings(): Promise<Meeting[]> {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(this.formatMeeting);
      this.cacheMeetings(formatted);
      return formatted;
    } catch (error) {
      console.error('Error fetching meetings:', error);
      // Propagate error — no silent fallback to cached data
      throw error;
    }
  }

  async createMeeting(meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>): Promise<Meeting> {
    try {
      const dbMeeting = this.toDbFormat(meeting);
      const { data, error } = await supabase
        .from('meetings')
        .insert(dbMeeting)
        .select()
        .single();

      if (error) throw error;

      const formatted = this.formatMeeting(data);
      this.addCachedMeeting(formatted);
      return formatted;
    } catch (error) {
      console.error('Error creating meeting:', error);
      // Do NOT fabricate fallback meetings — propagate the error
      throw error;
    }
  }

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<void> {
    try {
      const dbUpdates = this.toDbFormat(updates);
      const { error } = await supabase
        .from('meetings')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating meeting:', error);
      throw error;
    }
  }

  async deleteMeeting(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting meeting:', error);
      throw error;
    }
  }

  subscribeToMeetings(
    onInsert: (meeting: Meeting) => void,
    onUpdate: (meeting: Meeting) => void,
    onDelete: (id: string) => void
  ): () => void {
    const channelName = `meetings_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetings' }, (payload) => {
        onInsert(this.formatMeeting(payload.new));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meetings' }, (payload) => {
        onUpdate(this.formatMeeting(payload.new));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'meetings' }, (payload) => {
        onDelete(payload.old.id);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  private formatMeeting(data: any): Meeting {
    return {
      id: data.id,
      title: data.title,
      description: data.description || '',
      date: data.date,
      time: data.time,
      duration: data.duration,
      location: data.location || '',
      type: data.type,
      status: data.status,
      priority: data.priority,
      category: data.category,
      isRecurring: data.is_recurring,
      recurringPattern: data.recurring_pattern,
      attendees: data.attendees || [],
      tags: data.tags || [],
      department: data.department || '',
      documents: data.documents || [],
      meetingLinks: data.meeting_links,
      notifications: data.notifications,
      approvalWorkflow: data.approval_workflow,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private toDbFormat(meeting: Partial<Meeting>): any {
    const db: any = {};
    if (meeting.title !== undefined) db.title = meeting.title;
    if (meeting.description !== undefined) db.description = meeting.description;
    if (meeting.date !== undefined) db.date = meeting.date;
    if (meeting.time !== undefined) db.time = meeting.time;
    if (meeting.duration !== undefined) db.duration = meeting.duration;
    if (meeting.location !== undefined) db.location = meeting.location;
    if (meeting.type !== undefined) db.type = meeting.type;
    if (meeting.status !== undefined) db.status = meeting.status;
    if (meeting.priority !== undefined) db.priority = meeting.priority;
    if (meeting.category !== undefined) db.category = meeting.category;
    if (meeting.isRecurring !== undefined) db.is_recurring = meeting.isRecurring;
    if (meeting.recurringPattern !== undefined) db.recurring_pattern = meeting.recurringPattern;
    if (meeting.attendees !== undefined) db.attendees = meeting.attendees;
    if (meeting.tags !== undefined) db.tags = meeting.tags;
    if (meeting.department !== undefined) db.department = meeting.department;
    if (meeting.documents !== undefined) db.documents = meeting.documents;
    if (meeting.meetingLinks !== undefined) db.meeting_links = meeting.meetingLinks;
    if (meeting.notifications !== undefined) db.notifications = meeting.notifications;
    if (meeting.approvalWorkflow !== undefined) db.approval_workflow = meeting.approvalWorkflow;
    if (meeting.createdBy !== undefined) db.created_by = meeting.createdBy;
    return db;
  }

  private cacheMeetings(meetings: Meeting[]): void {
    try {
      localStorage.setItem('meetings_cache', JSON.stringify(meetings));
    } catch (error) {
      console.error('Error caching meetings:', error);
    }
  }

  /** Public accessor for the localStorage cache — used by useCalendar for cache-first state init. */
  getCachedMeetingsPublic(): Meeting[] {
    return this.getCachedMeetings();
  }

  private getCachedMeetings(): Meeting[] {
    try {
      const cached = localStorage.getItem('meetings_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  private addCachedMeeting(meeting: Meeting): void {
    try {
      const cached = this.getCachedMeetings();
      cached.unshift(meeting);
      this.cacheMeetings(cached);
    } catch (error) {
      console.error('Error adding cached meeting:', error);
    }
  }

  private updateCachedMeeting(id: string, updates: Partial<Meeting>): void {
    try {
      const cached = this.getCachedMeetings();
      const index = cached.findIndex(m => m.id === id);
      if (index >= 0) {
        cached[index] = { ...cached[index], ...updates };
        this.cacheMeetings(cached);
      }
    } catch (error) {
      console.error('Error updating cached meeting:', error);
    }
  }

  private deleteCachedMeeting(id: string): void {
    try {
      const cached = this.getCachedMeetings();
      this.cacheMeetings(cached.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting cached meeting:', error);
    }
  }
}

export const calendarService = new CalendarService();
