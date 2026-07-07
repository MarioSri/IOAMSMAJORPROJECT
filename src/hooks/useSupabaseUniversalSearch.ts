import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'approval' | 'meeting' | 'livemeet' | 'reminder' | 'note' | 'calendar';
  section: string;
  path: string;
  metadata?: any;
}

export function useSupabaseUniversalSearch() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!query.trim() || !user) return [];

    setIsLoading(true);
    setError(null);

    try {
      const searchTerm = `%${query.toLowerCase()}%`;

      // ── identity keys ──────────────────────────────────────────────────────
      // workflow_steps.assignee_id stores role_recipients UUIDs (primary),
      // falling back to auth UID strings for legacy rows.
      const recipientId = user.recipientId;
      const userId = user.id;
      const assigneeFilter = recipientId
        ? `assignee_id.eq.${recipientId},assignee_id.eq.${userId}`
        : `assignee_id.eq.${userId}`;

      // ── run all queries in parallel ─────────────────────────────────────────
      const [
        docResult,
        approvalsResult,
        historyResult,
        livemeetResult,
        notesResult,
        remindersResult,
        calendarResult,
      ] = await Promise.allSettled([

        // 1. Track Documents — scoped to submitter
        supabase
          .from('documents')
          .select('id, title, description, type, status, priority, submitter_id, submitter_name, created_at')
          .eq('submitter_id', userId)
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .order('created_at', { ascending: false })
          .limit(10),

        // 2. Pending Approvals — match recipientId (role_recipients UUID) OR auth UID
        supabase
          .from('workflow_steps')
          .select(`
            id,
            name,
            assignee,
            assignee_id,
            status,
            workflow_id,
            document_workflows!inner(
              document_id,
              documents!inner(
                id,
                title,
                description,
                type
              )
            )
          `)
          .or(assigneeFilter)
          .in('status', ['current', 'pending'])
          .limit(10),

        // 3. Approval History
        supabase
          .from('document_approvals')
          .select(`
            id,
            action,
            comment,
            approver_name,
            action_date,
            documents!inner(
              id,
              title,
              description
            )
          `)
          .eq('approver_id', userId)
          .or(`comment.ilike.${searchTerm},approver_name.ilike.${searchTerm},documents.title.ilike.${searchTerm}`)
          .order('action_date', { ascending: false })
          .limit(10),

        // 4. LiveMeet+ — scoped by RLS (requester_id OR target_user_id = auth.uid)
        supabase
          .from('live_meeting_requests')
          .select('id, document_title, document_type, purpose, agenda, status, urgency, meeting_format, requested_time, scheduled_time, requester_name, target_user_name')
          .or(`document_title.ilike.${searchTerm},purpose.ilike.${searchTerm},agenda.ilike.${searchTerm},requester_name.ilike.${searchTerm},target_user_name.ilike.${searchTerm}`)
          .order('requested_time', { ascending: false })
          .limit(10),

        // 5. Notes
        supabase
          .from('notes')
          .select('id, title, content, category, color, pinned, created_at')
          .eq('user_id', userId)
          .or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`)
          .order('created_at', { ascending: false })
          .limit(10),

        // 6. Reminders
        supabase
          .from('reminders')
          .select('id, title, description, due_date, due_time, priority, completed')
          .eq('user_id', userId)
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .order('due_date', { ascending: true })
          .limit(10),

        // 7. Calendar Events — global meetings table (all orgs see all meetings)
        supabase
          .from('meetings')
          .select('id, title, description, date, time, type, status, location')
          .or(`title.ilike.${searchTerm},description.ilike.${searchTerm},location.ilike.${searchTerm}`)
          .order('date', { ascending: true })
          .limit(10),
      ]);

      const results: SearchResult[] = [];

      // 1. Track Documents
      if (docResult.status === 'fulfilled' && docResult.value.data) {
        results.push(...docResult.value.data.map(doc => ({
          id: doc.id,
          title: doc.title,
          description: doc.description || `${doc.type} - ${doc.status}`,
          type: 'document' as const,
          section: 'Track Documents',
          path: `/track-documents#${doc.id}`,
          metadata: doc,
        })));
      }

      // 2. Pending Approvals — filter text client-side after identity match
      if (approvalsResult.status === 'fulfilled' && approvalsResult.value.data) {
        const q = query.toLowerCase();
        const matches = approvalsResult.value.data.filter((a: any) =>
          a.document_workflows?.documents?.title?.toLowerCase().includes(q) ||
          a.name?.toLowerCase().includes(q) ||
          a.assignee?.toLowerCase().includes(q)
        );
        results.push(...matches.map((approval: any) => ({
          id: approval.id,
          title: approval.document_workflows.documents.title,
          description: `Step: ${approval.name} — ${approval.status}`,
          type: 'approval' as const,
          section: 'Pending Approvals',
          path: `/approvals#${approval.document_workflows.documents.id}`,
          metadata: approval,
        })));
      }

      // 3. Approval History
      if (historyResult.status === 'fulfilled' && historyResult.value.data) {
        results.push(...historyResult.value.data.map((item: any) => ({
          id: item.id,
          title: item.documents.title,
          description: `${item.action} — ${item.comment || 'No comment'}`,
          type: 'approval' as const,
          section: 'Approval History',
          path: `/approvals#${item.documents.id}`,
          metadata: item,
        })));
      }

      // 4. LiveMeet+
      if (livemeetResult.status === 'fulfilled' && livemeetResult.value.data) {
        results.push(...livemeetResult.value.data.map((lm: any) => ({
          id: lm.id,
          title: lm.document_title || 'LiveMeet+ Request',
          description: `${lm.purpose ?? ''}${lm.status ? ` — ${lm.status}` : ''}`.trim() || `${lm.meeting_format ?? ''} · ${lm.urgency ?? ''}`,
          type: 'livemeet' as const,
          section: 'LiveMeet+',
          path: `/messages?tab=live-requests#${lm.id}`,
          metadata: lm,
        })));
      }

      // 5. Notes
      if (notesResult.status === 'fulfilled' && notesResult.value.data) {
        results.push(...notesResult.value.data.map(note => ({
          id: note.id,
          title: note.title,
          description: (note.content ?? '').substring(0, 100),
          type: 'note' as const,
          section: 'Sticky Notes',
          path: `/messages?tab=notes#${note.id}`,
          metadata: note,
        })));
      }

      // 6. Reminders
      if (remindersResult.status === 'fulfilled' && remindersResult.value.data) {
        results.push(...remindersResult.value.data.map(reminder => ({
          id: reminder.id,
          title: reminder.title,
          description: `${reminder.due_date ?? ''} ${reminder.due_time ? `at ${reminder.due_time}` : ''} — ${reminder.priority ?? ''}`.trim(),
          type: 'reminder' as const,
          section: 'Upcoming Reminders',
          path: `/messages?tab=notes#${reminder.id}`,
          metadata: reminder,
        })));
      }

      // 7. Calendar Events
      if (calendarResult.status === 'fulfilled' && calendarResult.value.data) {
        results.push(...calendarResult.value.data.map(meeting => ({
          id: `cal-${meeting.id}`,
          title: meeting.title,
          description: `${meeting.date ?? ''} ${meeting.time ? `at ${meeting.time}` : ''} — ${meeting.type ?? ''}`.trim(),
          type: 'calendar' as const,
          section: 'Calendar Events',
          path: `/calendar#${meeting.id}`,
          metadata: meeting,
        })));
      }

      // Cache results
      try {
        localStorage.setItem('search-cache', JSON.stringify({
          query,
          results: results.slice(0, 50),
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('Cache write failed:', e);
      }

      return results;
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message);

      // Fallback to cache
      try {
        const cached = JSON.parse(localStorage.getItem('search-cache') || '{}');
        if (cached.query === query && Date.now() - cached.timestamp < 300000) {
          return cached.results;
        }
      } catch {}

      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Real-time subscriptions — invalidate cache on any relevant table change
  useEffect(() => {
    if (!user) return;

    const invalidateCache = () => localStorage.removeItem('search-cache');

    const channels = [
      supabase.channel('search-documents').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        invalidateCache
      ),
      supabase.channel('search-livemeet').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_meeting_requests' },
        invalidateCache
      ),
      supabase.channel('search-meetings').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        invalidateCache
      ),
      supabase.channel('search-notes').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        invalidateCache
      ),
      supabase.channel('search-reminders').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        invalidateCache
      ),
      supabase.channel('search-workflow-steps').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflow_steps' },
        invalidateCache
      ),
    ];

    channels.forEach(ch => ch.subscribe());

    return () => {
      channels.forEach(ch => ch.unsubscribe());
    };
  }, [user]);

  return {
    search,
    isLoading,
    error,
  };
}
