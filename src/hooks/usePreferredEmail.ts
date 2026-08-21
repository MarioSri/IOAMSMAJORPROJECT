import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function usePreferredEmail() {
  const { user } = useAuth();
  const [preferredEmail, setPreferredEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferredEmail = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('role_recipients')
        .select('preferred_notification_email')
        .eq('supabase_uid', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch preferred email:', error);
      }

      setPreferredEmail(data?.preferred_notification_email || '');
    } catch (err) {
      console.error('Unexpected error fetching preferred email:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPreferredEmail();
  }, [fetchPreferredEmail]);

  const updatePreferredEmail = useCallback(
    async (email: string): Promise<boolean> => {
      if (!user?.id) return false;

      setSaving(true);
      const emailToSave = email.trim() || null;

      try {
        const { error } = await supabase
          .from('role_recipients')
          .update({ preferred_notification_email: emailToSave })
          .eq('supabase_uid', user.id);

        if (error) {
          console.error('Failed to update preferred email:', error);
          return false;
        }

        setPreferredEmail(emailToSave || '');

        // Keep email-targeted push devices aligned, including when the
        // preferred address is cleared so stale email tags are removed.
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            await fetch('/api/notifications/devices/sync-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ email: emailToSave }),
            });
          }
        } catch (syncErr) {
          // Non-fatal: push sync failure should not block email preference save
          console.warn('[usePreferredEmail] Device sync failed:', syncErr);
        }

        return true;
      } catch (err) {
        console.error('Unexpected error updating preferred email:', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user?.id]
  );

  const removePreferredEmail = useCallback(async (): Promise<boolean> => {
    return updatePreferredEmail('');
  }, [updatePreferredEmail]);

  return {
    preferredEmail,
    loading,
    saving,
    updatePreferredEmail,
    removePreferredEmail,
    setPreferredEmail,
  };
}
