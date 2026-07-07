/**
 * localStorageCache.ts
 *
 * Centralised, quota-aware localStorage helpers.
 *
 * safeSetItem(key, value)
 *   – Wraps localStorage.setItem.
 *   – On QuotaExceededError it runs evictCaches() (lowest-priority first)
 *     and retries the write once.  If it still fails the write is silently
 *     dropped so the app never throws to the user.
 *
 * evictCaches()
 *   – Removes cache keys in ascending priority order (most-disposable first)
 *     until at least EVICTION_TARGET_BYTES are freed.
 */

// ---------------------------------------------------------------------------
// Priority registry  (lower number = evicted first)
// ---------------------------------------------------------------------------
export const CACHE_PRIORITIES: Record<string, number> = {
  'search-cache':              1,
  'analytics_metrics_cache':   2,
  'department_stats_cache':    2,
  'monthly_trends_cache':      2,
  'recent-documents-cache':    3,
  'documents-cache':           3,
  'track-documents-cache':     3,
  'bypass-cache':              4,
  'emergency-cache':           4,
  // Dynamic patterns resolved at runtime (see getDynamicPriority)
  // live_meeting_requests_cache_{userId}  → 3
  // chat_messages_cache_{channelId}       → 5
  // chat_channels_cache_{userId}          → 5
  // notes_cache_{userId}                  → 6
  // reminders_cache_{userId}              → 6
};

function getDynamicPriority(key: string): number {
  if (key.startsWith('live_meeting_requests_cache_')) return 3;
  if (key.startsWith('chat_messages_cache_'))         return 5;
  if (key.startsWith('chat_channels_cache_'))         return 5;
  if (key.startsWith('notes_cache_'))                 return 6;
  if (key.startsWith('reminders_cache_'))             return 6;
  return 99; // unknown keys — evict last
}

function keyPriority(key: string): number {
  return CACHE_PRIORITIES[key] ?? getDynamicPriority(key);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the byte-length of a key+value pair stored in localStorage. */
function keyByteSize(key: string): number {
  const v = localStorage.getItem(key);
  return v !== null ? key.length * 2 + v.length * 2 : 0; // UTF-16
}

const EVICTION_TARGET_BYTES = 512 * 1024; // free up at least 512 KB per eviction pass

/** Evicts cache keys in ascending priority order until enough space is freed. */
export function evictCaches(): void {
  try {
    const cacheKeys = Object.keys(localStorage)
      .filter(k => {
        const priority = keyPriority(k);
        return priority < 99 ||
          k.startsWith('live_meeting_requests_cache_') ||
          k.startsWith('chat_messages_cache_') ||
          k.startsWith('chat_channels_cache_') ||
          k.startsWith('notes_cache_') ||
          k.startsWith('reminders_cache_');
      })
      .sort((a, b) => keyPriority(a) - keyPriority(b));

    let freed = 0;
    for (const key of cacheKeys) {
      if (freed >= EVICTION_TARGET_BYTES) break;
      freed += keyByteSize(key);
      localStorage.removeItem(key);
    }
  } catch {
    // If even this fails, give up gracefully.
  }
}

/**
 * Quota-aware replacement for localStorage.setItem.
 *
 * On QuotaExceededError: evicts low-priority caches and retries once.
 * If the retry also fails, the write is silently dropped.
 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      evictCaches();
      try {
        localStorage.setItem(key, value);
      } catch {
        // Second attempt failed — drop the write rather than crashing.
      }
    }
  }
}

/** Returns total localStorage usage in bytes (UTF-16 approximation). */
export function totalStorageBytes(): number {
  return Object.keys(localStorage).reduce(
    (sum, key) => sum + keyByteSize(key),
    0
  );
}
