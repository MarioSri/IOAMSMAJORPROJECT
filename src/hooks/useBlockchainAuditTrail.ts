import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { BlockchainAuditLogEntry, AuditTrailResponse } from '@/types/blockchainAudit';
import { useVisibilityRefetch } from './useVisibilityRefetch';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Hook that provides a real-time blockchain audit trail for a document.
 *
 * How it works:
 *   1. Fetches the initial audit trail from the backend API on mount.
 *   2. Subscribes to Supabase Realtime INSERT events on blockchain_audit_log
 *      filtered by document_id so new entries appear immediately in the UI.
 *   3. Cleans up the subscription on unmount / document change.
 */
export function useBlockchainAuditTrail(documentId: string | null) {
  const [entries, setEntries] = useState<BlockchainAuditLogEntry[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<AuditTrailResponse['chainIntegrity']>('unknown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // -----------------------------------------------------------------------
  // Initial fetch from the backend API
  // -----------------------------------------------------------------------
  const fetchTrail = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch(
        `${BACKEND_URL}/api/blockchain-audit/trail/${encodeURIComponent(documentId)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!res.ok) {
        setError(`Failed to load audit trail (${res.status})`);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setEntries(json.data.entries ?? []);
        setChainIntegrity(json.data.chainIntegrity ?? 'unknown');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // -----------------------------------------------------------------------
  // Supabase Realtime subscription for live INSERT events
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!documentId) return;

    // Initial load
    fetchTrail();

    // Subscribe to new blockchain_audit_log inserts for this document
    const channel = supabase
      .channel(`blockchain-audit-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blockchain_audit_log',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          const newEntry = payload.new as BlockchainAuditLogEntry;
          setEntries((prev) => {
            // Deduplicate by id in case of duplicate delivery
            if (prev.some((e) => e.id === newEntry.id)) return prev;
            // Insert in timestamp order
            return [...prev, newEntry].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
          // Re-evaluate chain integrity when a new entry arrives
          setChainIntegrity((prev) => (prev === 'broken' ? 'broken' : 'pending'));
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Safety-net: refetch on window focus
    const handleFocus = () => fetchTrail();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [documentId, fetchTrail]);

  // Re-fetch whenever returning to the tab
  useVisibilityRefetch(fetchTrail, !!documentId);

  return { entries, chainIntegrity, loading, error, refetch: fetchTrail };
}
