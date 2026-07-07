import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';

export function useSocket() {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    channelRef.current = supabase.channel(`user:${user.id}`);
    channelRef.current.subscribe();

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [user]);

  const subscribeToDocument = (documentId: string) => {
    supabase.channel(`document:${documentId}`).subscribe();
  };

  const onDocumentUpdate = (callback: (data: any) => void) => {
    const sub = supabase
      .channel(`doc-updates`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents'
      }, (payload) => callback(payload.new))
      .subscribe();
    return () => { sub.unsubscribe(); };
  };

  const onNotification = (callback: (data: any) => void) => {
    if (!user) return () => {};
    const sub = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => callback(payload.new))
      .subscribe();
    return () => { sub.unsubscribe(); };
  };

  return { subscribeToDocument, onDocumentUpdate, onNotification };
}
