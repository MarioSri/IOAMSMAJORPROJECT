import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using localStorage fallback.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Automatically refresh the JWT before it expires so long session tabs
    // never silently lose authentication.
    autoRefreshToken: true,
    // Persist the session in localStorage (Supabase default) so it survives
    // tab duplications, refreshes, and browser restarts.
    persistSession: true,
    // Correctly extract OAuth tokens from the URL after Google redirect.
    detectSessionInUrl: true,
    // Explicit storage key to avoid collisions on shared origins.
    storageKey: 'iaoms-supabase-auth',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
