import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _supabaseAdmin: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceRoleKey);
}

/**
 * Returns the Supabase admin client.
 * Lazily initialised on first access — only throws if env vars are missing
 * AND caller actually tries to use it.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      if (!isSupabaseConfigured()) {
        console.warn('[Supabase] Not configured — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
        // Return a safe no-op for .auth.getUser so auth middleware can fall through
        if (prop === 'auth') {
          return { getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }) };
        }
        if (prop === 'from') {
          const notConfiguredErr = { message: 'Supabase not configured' };
          const noopChain: any = new Proxy({}, {
            get(_t, _p) {
              // Any chained call (eq, delete, update, select, insert, single, limit, order…)
              // returns either a resolved Promise or another chainable proxy so callers
              // that await the chain receive { data: null, error: notConfiguredErr }.
              return (..._args: any[]) => new Proxy(
                Promise.resolve({ data: null, error: notConfiguredErr, count: null }),
                { get(target: any, p2) { return p2 in target ? (target as any)[p2] : (..._a: any[]) => noopChain; } }
              );
            }
          });
          return () => noopChain;
        }
        return undefined;
      }
      _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    }
    return (_supabaseAdmin as any)[prop];
  }
});
