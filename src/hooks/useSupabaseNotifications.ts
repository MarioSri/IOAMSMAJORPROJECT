import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useVisibilityRefetch } from './useVisibilityRefetch';
import { safeSetItem } from '@/utils/localStorageCache';

export interface SupabaseNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'emergency' | 'approval' | 'submission' | 'reminder' | 'meeting' | 'chat';
  read: boolean;
  urgent: boolean;
  delivered_via: string[];
  action_url?: string;
  metadata?: Record<string, unknown>;
  document_id?: string;
  email_sent?: boolean;
  email_failed?: boolean;
  email_retry_count?: number;
  last_email_attempt_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────
function notifCacheKey(userId: string) {
  return `notifications_cache_${userId}`;
}

function readNotifCache(userId: string | undefined): SupabaseNotification[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(notifCacheKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as SupabaseNotification[];
  } catch {
    return [];
  }
}

function writeNotifCache(userId: string, data: SupabaseNotification[]): void {
  try {
    safeSetItem(notifCacheKey(userId), JSON.stringify(data.slice(0, 100)));
  } catch {
    // Ignore quota errors
  }
}
// ───────────────────────────────────────────────────────────────────────────────


export function useSupabaseNotifications() {
  const { user } = useAuth();

  // ── Initialise from cache so the first render already has data ───────────────
  const [notifications, setNotifications] = useState<SupabaseNotification[]>(() =>
    readNotifCache(user?.id)
  );
  // Only show the spinner when the cache is empty
  const [loading, setLoading] = useState<boolean>(() => readNotifCache(user?.id).length === 0);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);

  // Update counts whenever notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
    setUrgentCount(notifications.filter(n => n.urgent && !n.read).length);
  }, [notifications]);

  // Fetch notifications from Supabase
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Silent background refresh — only block UI when there is nothing to show
    if (notifications.length === 0) {
      setLoading(true);
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'chat')   // chat events are Web Push-only, never shown in-app
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const result = data || [];
      setNotifications(result);
      writeNotifCache(user.id, result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    if (!user?.id) return;

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to mark as read:', err);
      // Revert on error
      await fetchNotifications();
    }
  }, [user?.id, fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
      // Revert on error
      await fetchNotifications();
    }
  }, [user?.id, fetchNotifications]);

  // Remove notification
  const removeNotification = useCallback(async (id: string) => {
    if (!user?.id) return;

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to remove notification:', err);
      // Revert on error
      await fetchNotifications();
    }
  }, [user?.id, fetchNotifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!user?.id) return;

    // Optimistic update
    setNotifications([]);

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to clear notifications:', err);
      // Revert on error
      await fetchNotifications();
    }
  }, [user?.id, fetchNotifications]);

  // Create notification (for testing or manual creation)
  const createNotification = useCallback(async (
    notification: Omit<SupabaseNotification, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          ...notification
        })
        .select()
        .single();

      if (error) throw error;
      
      // Real-time will handle the update, but we can optimistically add it
      setNotifications(prev => [data, ...prev]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to create notification:', err);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    fetchNotifications();
  }, [user?.id, fetchNotifications]);

  // Re-fetch notifications whenever user returns to the tab.
  useVisibilityRefetch(fetchNotifications, !!user?.id);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📬 New notification:', payload.new);
            // Never surface chat-type rows — chat uses Web Push-only delivery
            if ((payload.new as SupabaseNotification).type === 'chat') return;
            setNotifications(prev => {
              const updated = [payload.new as SupabaseNotification, ...prev];
              if (user?.id) writeNotifCache(user.id, updated);
              return updated;
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📝 Notification updated:', payload.new);
            setNotifications(prev => {
              const updated = prev.map(n => n.id === payload.new.id ? payload.new as SupabaseNotification : n);
              if (user?.id) writeNotifCache(user.id, updated);
              return updated;
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🗑️ Notification deleted:', payload.old);
            setNotifications(prev => {
              const updated = prev.filter(n => n.id !== payload.old.id);
              if (user?.id) writeNotifCache(user.id, updated);
              return updated;
            });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            setTimeout(() => fetchNotifications(), 2000);
          }
        });
    };

    setupRealtime();

    // Extra safety: refetch on window focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    urgentCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    createNotification,
    refresh: fetchNotifications
  };
}
