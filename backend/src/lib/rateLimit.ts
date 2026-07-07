// backend/src/lib/rateLimit.ts
// Database-backed sliding window rate limiter using rate_limit_events table.
// In development mode the limiter is a no-op so testing is never blocked.
import { supabaseAdmin } from '../config/supabase';

const IS_DEV = process.env.NODE_ENV !== 'production';

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<void> {
  // Skip rate limiting in development — prevents test-session event accumulation blocking flows
  if (IS_DEV) return;

  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Prune events outside the current window first (keeps the table lean)
  await supabaseAdmin
    .from('rate_limit_events')
    .delete()
    .eq('key', key)
    .lt('created_at', windowStart);

  const { count } = await supabaseAdmin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= maxRequests) {
    throw Object.assign(
      new Error(`Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000}s.`),
      { status: 429 }
    );
  }

  // Record this attempt
  await supabaseAdmin
    .from('rate_limit_events')
    .insert({ key });
}
