import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  branch?: string;
  phone?: string;
  employee_id?: string;
  designation?: string;
  bio?: string;
  avatar?: string;
  is_active: boolean;
}

// ── Session-scoped in-memory cache ───────────────────────────────────────────
// Keyed by "email:<email>" or "id:<employee_id>".
// Stores the resolved profile (or null for confirmed-not-found).
// Cleared on page unload so stale data never persists across sessions.
// Stores in-flight Promises too — deduplicates concurrent calls for the same key.
const profileCache = new Map<string, Promise<UserProfile | null>>();

class UserProfileService {

  /** Clear every cached entry (call on sign-out). */
  clearCache(): void {
    profileCache.clear();
  }

  async fetchProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!email) return null;

    const cacheKey = `email:${email}`;
    if (profileCache.has(cacheKey)) {
      console.log('[UserProfileService] Cache hit for email:', email);
      return profileCache.get(cacheKey)!;
    }

    const request = this._fetchByEmail(email);
    profileCache.set(cacheKey, request);
    return request;
  }

  private async _fetchByEmail(email: string): Promise<UserProfile | null> {
    try {
      console.log('[UserProfileService] Fetching profile by email:', email);

      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, phone, employee_id, designation, bio, avatar, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[UserProfileService] Supabase error:', error.message);
        // Remove from cache so next call retries
        profileCache.delete(`email:${email}`);
        throw error;
      }

      if (!data) {
        console.log('[UserProfileService] No profile found for email:', email);
        return null;
      }

      console.log('[UserProfileService] Profile fetched:', data.name);
      return data as UserProfile;
    } catch (error) {
      profileCache.delete(`email:${email}`);
      console.error('[UserProfileService] Failed to fetch profile by email:', error);
      throw new Error('Failed to fetch user profile from database');
    }
  }

  async fetchProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;

    const cacheKey = `id:${userId}`;
    if (profileCache.has(cacheKey)) {
      console.log('[UserProfileService] Cache hit for user ID:', userId);
      return profileCache.get(cacheKey)!;
    }

    const request = this._fetchById(userId);
    profileCache.set(cacheKey, request);
    return request;
  }

  private async _fetchById(userId: string): Promise<UserProfile | null> {
    try {
      console.log('[UserProfileService] Fetching profile by user ID:', userId);

      const { data, error } = await supabase
        .from('role_recipients')
        .select('id, name, email, role, department, branch, phone, employee_id, designation, bio, avatar, is_active')
        .eq('employee_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[UserProfileService] Supabase error:', error.message);
        profileCache.delete(`id:${userId}`);
        throw error;
      }

      if (!data) {
        console.log('[UserProfileService] No profile found for user ID:', userId);
        return null;
      }

      console.log('[UserProfileService] Profile fetched:', data.name);
      return data as UserProfile;
    } catch (error) {
      profileCache.delete(`id:${userId}`);
      console.error('[UserProfileService] Failed to fetch profile:', error);
      throw new Error('Failed to fetch user profile from database');
    }
  }
}

export const userProfileService = new UserProfileService();
