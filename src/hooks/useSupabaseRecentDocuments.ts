import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { approvalService } from '@/services/ApprovalService';
import { useVisibilityRefetch } from './useVisibilityRefetch';
import { safeSetItem } from '@/utils/localStorageCache';

export interface RecentDocument {
  id: string;
  title: string;
  type: 'Letter' | 'Circular' | 'Report';
  status: 'pending' | 'approved' | 'rejected' | 'in-review' | 'emergency';
  submittedBy: string;
  submittedByRole: string;
  department: string;
  branch?: string;
  year?: string;
  date: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  description: string;
  requiresAction: boolean;
  escalationLevel: number;
  aiSummary?: string;
  recipients?: string[];
  /** Raw approval card data incl. files[] with storage_path or base64 data */
  approvalCard?: {
    id: string;
    title: string;
    description: string;
    files?: Record<string, unknown>[];
  };
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────
const CACHE_KEY = 'recent-documents-cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: RecentDocument[];
  timestamp: number;
}

function readRecentDocsCache(): RecentDocument[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const entry: CacheEntry = JSON.parse(raw);
    // Only serve cached data if it was written within the TTL
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return [];
    return entry.data || [];
  } catch {
    return [];
  }
}

function writeRecentDocsCache(data: RecentDocument[]): void {
  try {
    const entry: CacheEntry = { data: data.slice(0, 100), timestamp: Date.now() };
    safeSetItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}
// ───────────────────────────────────────────────────────────────────────────────

export function useSupabaseRecentDocuments() {
  const { user } = useAuth();

  // ── Initialise from cache so the Dashboard renders data on the first frame ───
  const [documents, setDocuments] = useState<RecentDocument[]>(() => readRecentDocsCache());
  // Only show the spinner when there is truly nothing cached to display
  const [loading, setLoading] = useState<boolean>(() => readRecentDocsCache().length === 0);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    // Silent background refresh — only block UI when nothing is visible
    if (documents.length === 0) {
      setLoading(true);
    }

    try {
      setError(null);

      // Use the same UUID-based service call as the Approval Center.
      // This matches workflow_steps.assignee_id against user.recipientId (role_recipients UUID)
      // so only cards where this user has an active 'current' step are returned.
      const workflows = await approvalService.getPendingApprovals(
        user.id,
        user.role,
        user.recipientId,
      );

      const mapped: RecentDocument[] = workflows
        // Exclude cards submitted by the logged-in user — the widget shows received cards only.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((w: any) => w.document?.submitter_id !== user.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((w: any) => {
          const doc = w.document;
          return {
            id: doc.id,
            title: doc.title,
            type: doc.type as RecentDocument['type'],
            status: (doc.is_emergency ? 'emergency' : doc.status) as RecentDocument['status'],
            submittedBy: doc.submitter_name,
            submittedByRole: 'Faculty',
            department: doc.submitter_department || 'General',
            date: doc.submitted_date,
            priority: (doc.is_emergency ? 'emergency' : doc.priority) as RecentDocument['priority'],
            description: doc.description || '',
            // requiresAction is true for every result — the service only returns cards
            // where this user has a 'current' workflow step awaiting their action.
            requiresAction: true,
            escalationLevel: w.escalation_level || 0,
            recipients: doc.recipients,
            // Pass the raw approval card (with files[]) so AISummarizerModal can
            // fetch & send the actual uploaded file to the backend summarizer.
            approvalCard: {
              id: doc.id,
              title: doc.title,
              description: doc.description || '',
              files: doc.files || [],
            },
          };
        });

      setDocuments(mapped);
      writeRecentDocsCache(mapped);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('[useSupabaseRecentDocuments] Failed to fetch:', err);
      setError(err.message);

      // Read-only fallback to cached data on transient network errors.
      const fallback = readRecentDocsCache();
      if (fallback.length > 0) {
        setDocuments(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Re-fetch the dashboard widget data whenever the user returns to this tab.
  // This is the primary guard against the "data appears lost" symptom on the
  // Dashboard after extended inactivity or tab switching.
  useVisibilityRefetch(fetchDocuments, !!user);

  // Supabase Realtime — refetch whenever documents, workflows, or steps change.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('recent-documents-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => fetchDocuments(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_workflows' },
        () => fetchDocuments(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflow_steps' },
        () => fetchDocuments(),
      )
      .subscribe((status) => {
        // If the channel errors (e.g. token expired, WebSocket dropped) do a
        // one-off refetch so the widget never shows permanently stale data.
        if (status === 'CHANNEL_ERROR') {
          console.warn('[RecentDocuments] Realtime channel error, refetching...');
          setTimeout(() => fetchDocuments(), 2000);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refresh: fetchDocuments,
  };
}
