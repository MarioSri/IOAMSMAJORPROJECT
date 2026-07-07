import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationPreferencesData {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferencesData = {
  email_enabled: true,
  push_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
};

const LEGACY_LS_KEY_PREFIX = 'user-preferences-';

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferencesData>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Migrate from localStorage if a legacy key exists, then clear it
  const migrateLegacyPreferences = useCallback(
    async (userId: string): Promise<Partial<NotificationPreferencesData> | null> => {
      try {
        const raw = localStorage.getItem(`${LEGACY_LS_KEY_PREFIX}${userId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Legacy format: { email: { enabled }, push: { enabled }, ... }
        const migrated: Partial<NotificationPreferencesData> = {};
        if (parsed?.email?.enabled !== undefined) migrated.email_enabled = Boolean(parsed.email.enabled);
        if (parsed?.push?.enabled !== undefined) migrated.push_enabled = Boolean(parsed.push.enabled);
        if (parsed?.sms?.enabled !== undefined) migrated.sms_enabled = Boolean(parsed.sms.enabled);
        if (parsed?.whatsapp?.enabled !== undefined) migrated.whatsapp_enabled = Boolean(parsed.whatsapp.enabled);
        localStorage.removeItem(`${LEGACY_LS_KEY_PREFIX}${userId}`);
        return Object.keys(migrated).length > 0 ? migrated : null;
      } catch {
        return null;
      }
    },
    []
  );

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Row not found — check for legacy localStorage data and upsert defaults
        const legacy = await migrateLegacyPreferences(user.id);
        const toInsert = { ...DEFAULT_PREFERENCES, ...(legacy ?? {}) };
        const { data: inserted } = await supabase
          .from('user_notification_preferences')
          .upsert({ user_id: user.id, ...toInsert }, { onConflict: 'user_id' })
          .select()
          .single();
        if (inserted) setPreferences(inserted as NotificationPreferencesData);
        else setPreferences(toInsert);
      } else if (error) {
        console.error('Failed to fetch notification preferences:', error);
        setPreferences(DEFAULT_PREFERENCES);
      } else if (data) {
        setPreferences(data as NotificationPreferencesData);
      }
    } catch (err) {
      console.error('Unexpected error fetching notification preferences:', err);
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setLoading(false);
    }
  }, [user?.id, migrateLegacyPreferences]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferencesData>): Promise<boolean> => {
      if (!user?.id) return false;
      setSaving(true);
      const optimistic = { ...preferences, ...updates };
      setPreferences(optimistic);
      try {
        const { error } = await supabase
          .from('user_notification_preferences')
          .upsert({ user_id: user.id, ...optimistic }, { onConflict: 'user_id' });
        if (error) {
          console.error('Failed to save notification preferences:', error);
          setPreferences(preferences); // revert
          return false;
        }
        return true;
      } catch (err) {
        console.error('Unexpected error saving notification preferences:', err);
        setPreferences(preferences); // revert
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user?.id, preferences]
  );

  const isChannelEnabled = useCallback(
    (channel: keyof NotificationPreferencesData): boolean => {
      return preferences[channel] ?? false;
    },
    [preferences]
  );

  return { preferences, loading, saving, updatePreferences, isChannelEnabled };
}
