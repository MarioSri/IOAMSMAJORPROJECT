import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, isJwtExpired } from '@/contexts/AuthContext';
import { documentService } from '@/services/DocumentService';
import { workflowRemovalService } from '@/services/WorkflowRemovalService';
import { useVisibilityRefetch } from './useVisibilityRefetch';

/** Cache is considered fresh for 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── User-scoped cache helpers ────────────────────────────────────────────────
// Keys are namespaced by userId so a Google account switch never serves a
// previous user's data.

function cacheKey(userId: string): string {
  return `track-documents-cache-${userId}`;
}

function cacheTsKey(userId: string): string {
  return `track-documents-cache-ts-${userId}`;
}

/** Read cache for a specific user; returns [] on any parse error. */
function readCache(userId: string): any[] {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]');
  } catch {
    return [];
  }
}

/** Return true when the user's cached data was written less than CACHE_TTL_MS ago. */
function isCacheFresh(userId: string): boolean {
  try {
    const ts = Number(localStorage.getItem(cacheTsKey(userId)) || '0');
    return Date.now() - ts < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function writeCache(userId: string, data: any[]): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data.slice(0, 50)));
    localStorage.setItem(cacheTsKey(userId), String(Date.now()));
  } catch (e) {
    console.warn('[TrackDocuments] Cache write failed:', e);
  }
}

export function useSupabaseTrackDocuments() {
  const { user } = useAuth();

  // Start empty — populated either from the user-scoped cache or a live fetch.
  const [trackDocuments, setTrackDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signatureVersion, setSignatureVersion] = useState(0);

  // Prevent overlapping fetches caused by rapid realtime events
  const fetchingRef = useRef(false);

  const fetchDocuments = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (fetchingRef.current) return; // deduplicate concurrent calls
    fetchingRef.current = true;

    // ✅ Validate/Refresh Supabase session before fetching.
    // A stale or absent session would cause the query to return 0 rows 
    // even though data exists in the database.
    try {
      let { data: { session } } = await supabase.auth.getSession();
      
      // Force a refresh if session is missing or dangerously close to expiry (JWT buffer)
      if (!session || isJwtExpired(session.expires_at)) {
        console.log('[TrackDocuments] Session stale/missing — refreshing session');
        const refreshResult = await supabase.auth.refreshSession();
        session = refreshResult.data.session;
      }

      if (!session) {
        console.error('[TrackDocuments] No active Supabase session — aborting fetch to prevent zero-row UI flash');
        setError('Session expired. Please log in again.');
        setLoading(false);
        fetchingRef.current = false;
        return;
      }
    } catch (sessionErr) {
      console.error('[TrackDocuments] Session validation failed:', sessionErr);
      // Non-fatal: proceed and let the query fail if token is truly dead.
    }

    // ✅ Debug logging — confirms which user's data is being fetched
    console.log('[TrackDocuments] Fetching for user:', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    if (!silent) {
      setLoading(true);
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('*, document_workflows(*, workflow_steps(*))')
        .eq('submitter_id', user.id)
        // Exclude archived tracking cards — they remain in DB for audit compliance
        .neq('tracking_visible', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[TrackDocuments] Supabase fetch error:', {
          message: fetchError.message,
          code: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint,
        });
        throw fetchError;
      }

      setTrackDocuments(data || []);
      setError(null);
      writeCache(user.id, data || []);
    } catch (err: any) {
      console.error('[TrackDocuments] Failed to fetch documents:', err);
      setError(err.message);

      // Fall back to user-scoped cache when the live fetch fails.
      const cached = readCache(user.id);
      if (cached.length > 0) {
        setTrackDocuments(cached);
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reset state whenever the logged-in user changes ─────────────────────
  // This is the primary fix for the Google account switch bug:
  // when user.id changes we immediately clear stale cards and reload from
  // the correct user-scoped cache (or show a loading indicator if the cache
  // is cold), then trigger a fresh live fetch.
  useEffect(() => {
    if (!user?.id) {
      // Signed out — clear everything
      setTrackDocuments([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Load this user's cached data synchronously so the UI shows something
    // immediately while the live fetch is in flight.
    const cached = readCache(user.id);
    const cacheUsable = cached.length > 0 && isCacheFresh(user.id);

    setTrackDocuments(cached); // [] for a cold cache, populated for a warm one
    setLoading(!cacheUsable);  // suppress spinner if cache is warm
    setError(null);

    // Trigger a live fetch (silent if cache is warm)
    fetchDocuments(!cacheUsable ? false : true);
  }, [user?.id, fetchDocuments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch documents whenever user returns to the tab (safety net).
  useVisibilityRefetch(useCallback(() => fetchDocuments(true), [fetchDocuments]), !!user?.id);

  // ─── Real-time subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const refetch = () => fetchDocuments(true); // realtime events are always silent

    // 1. documents — status, priority, submitter changes
    const documentsChannel = supabase
      .channel(`track-documents-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `submitter_id=eq.${user.id}`
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (
            JSON.stringify(newRow?.signature_metadata) !== JSON.stringify(oldRow?.signature_metadata) ||
            JSON.stringify(newRow?.signed_by) !== JSON.stringify(oldRow?.signed_by)
          ) {
            setSignatureVersion(v => v + 1);
          }
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[TrackDocuments] Realtime channel error, refetching...');
          setTimeout(() => fetchDocuments(true), 2000);
        }
      });

    // 2. workflow_steps — escalation badge, bypass badge, step transitions
    const stepsChannel = supabase
      .channel(`track-workflow-steps-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflow_steps' },
        refetch
      )
      .subscribe();

    // 3. document_workflows — progress %, escalation_level, bypassed_recipients
    const workflowsChannel = supabase
      .channel(`track-document-workflows-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_workflows' },
        refetch
      )
      .subscribe();

    // Safety-net focus handler — dual guard alongside visibilitychange.
    const handleFocus = () => fetchDocuments(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      documentsChannel.unsubscribe();
      stepsChannel.unsubscribe();
      workflowsChannel.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, fetchDocuments]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── CRUD helpers ─────────────────────────────────────────────────────────

  const createDocument = useCallback(async (data: any) => {
    setError(null);
    try {
      const created = await documentService.createDocument(data);
      setTrackDocuments(prev => [created, ...prev]);
      return { success: true, data: created };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const updateDocument = useCallback(async (id: string, updates: any) => {
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      setTrackDocuments(prev => prev.map(doc => doc.id === id ? data : doc));
      return { success: true, data };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    setError(null);
    try {
      await documentService.deleteDocument(id);
      setTrackDocuments(prev => prev.filter(doc => doc.id !== id));
      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Smart remove: delegates to WorkflowRemovalService.
   * - Completed workflows (approved/partially-approved) → archive (hide from UI, preserve data)
   * - In-progress workflows → hard delete all linked application data
   * - Blockchain audit entries are NEVER deleted
   */
  const removeDocument = useCallback(async (id: string) => {
    setError(null);
    // Optimistically remove from local state immediately for instant UX
    setTrackDocuments(prev => prev.filter(doc => doc.id !== id));
    try {
      const result = await workflowRemovalService.removeDocument(id);
      if (!result.success) {
        // Re-fetch to restore the card if the operation failed
        await fetchDocuments(true);
        const msg = result.error || 'Failed to remove document';
        setError(msg);
        return { success: false, action: result.action, error: msg };
      }
      return { success: true, action: result.action };
    } catch (err: any) {
      await fetchDocuments(true);
      setError(err.message);
      return { success: false, action: 'deleted' as const, error: err.message };
    }
  }, [fetchDocuments]);

  return {
    trackDocuments,
    loading,
    error,
    signatureVersion,
    createDocument,
    updateDocument,
    deleteDocument,
    removeDocument,
    refetch: fetchDocuments
  };
}
