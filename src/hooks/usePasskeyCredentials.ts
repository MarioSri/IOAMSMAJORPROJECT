// src/hooks/usePasskeyCredentials.ts
// Fast passkey credential loading with module-level cache + Supabase realtime sync.
//
// Why a module-level cache?
//   – The cache persists across component remounts, tab switches, and React StrictMode
//     double-invocations. A fresh fetch is only triggered when the cache is stale or
//     the user changes.
//   – On the Security tab open the data is already in memory → zero perceived latency.
//   – On page refresh, Profile.tsx calls prefetchPasskeyCredentials() immediately on
//     mount so the fetch races with (or completes before) the user clicks the tab.

import { useState, useEffect, useCallback, useRef } from 'react';
import { listCredentials, PasskeyCredential } from '@/services/WebAuthnService';
import { supabase } from '@/lib/supabase';

// ── Module-level cache ───────────────────────────────────────────────────────
// Shared across all consumers so the list is fetched only ONCE per session.

interface CacheEntry {
  userId: string;
  data: PasskeyCredential[];
  fetchedAt: number; // ms epoch
}

let _cache: CacheEntry | null = null;
let _inflight: Promise<PasskeyCredential[]> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes before a background revalidation

function isCacheValid(userId: string): boolean {
  if (!_cache) return false;
  if (_cache.userId !== userId) return false;
  return Date.now() - _cache.fetchedAt < CACHE_TTL_MS;
}

/**
 * Warm the cache in the background.
 * Safe to call multiple times — coalesces concurrent in-flight requests.
 */
export async function prefetchPasskeyCredentials(userId: string): Promise<void> {
  if (isCacheValid(userId)) return; // already fresh
  if (_inflight) return;            // already fetching

  _inflight = listCredentials();
  try {
    const data = await _inflight;
    _cache = { userId, data, fetchedAt: Date.now() };
  } catch {
    // Prefetch errors are silent — the hook will retry on mount
  } finally {
    _inflight = null;
  }
}

/** Invalidate the cache (call after register / revoke). */
export function invalidatePasskeyCache(): void {
  _cache = null;
  _inflight = null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UsePasskeyCredentialsResult {
  credentials: PasskeyCredential[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function usePasskeyCredentials(userId: string): UsePasskeyCredentialsResult {
  // If data is already cached, start with it immediately (no loading flash).
  const getCachedIfValid = () => (isCacheValid(userId) ? _cache!.data : []);

  const [credentials, setCredentials] = useState<PasskeyCredential[]>(getCachedIfValid);
  const [loading, setLoading] = useState<boolean>(!isCacheValid(userId));
  const mountedRef = useRef(true);

  const fetchAndStore = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh && isCacheValid(userId)) {
      // Serve from cache instantly
      setCredentials(_cache!.data);
      setLoading(false);
      return;
    }

    // Coalesce with any existing in-flight request
    if (!_inflight) {
      _inflight = listCredentials();
    }

    try {
      const data = await _inflight;
      _cache = { userId, data, fetchedAt: Date.now() };
      if (mountedRef.current) {
        setCredentials(data);
      }
    } catch (err) {
      console.error('[usePasskeyCredentials] fetch error:', err);
    } finally {
      _inflight = null;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAndStore();
    return () => { mountedRef.current = false; };
  }, [fetchAndStore]);

  // ── Supabase Realtime subscription ────────────────────────────────────────
  // Listen for INSERT / UPDATE / DELETE on user_credentials so any change
  // (registered from another device/tab, background revocation) is reflected
  // immediately without the user needing to refresh.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`passkey-credentials-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credentials',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate and re-fetch silently in the background
          invalidatePasskeyCache();
          fetchAndStore(true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchAndStore]);

  const refresh = useCallback(async () => {
    invalidatePasskeyCache();
    setLoading(true);
    await fetchAndStore(true);
  }, [fetchAndStore]);

  return { credentials, loading, refresh };
}
