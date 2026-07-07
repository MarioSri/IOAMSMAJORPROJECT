import { useState, useEffect, useCallback, useRef } from 'react';
import { documentService } from '@/services/DocumentService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useVisibilityRefetch } from './useVisibilityRefetch';

export function useSupabaseDocuments() {
  const { user } = useAuth();
  
  // Initialize with validated cache IMMEDIATELY for instant display
  const [documents, setDocuments] = useState<any[]>(() => {
    if (!user?.id) return [];
    
    try {
      const cached = localStorage.getItem('documents-cache');
      const cachedUser = localStorage.getItem('documents-cache-user');
      
      if (cached && cachedUser === user.id) {
        const parsedCache = JSON.parse(cached);
        console.log('[useSupabaseDocuments] Loaded', parsedCache.length, 'documents from cache instantly');
        return parsedCache;
      }
      
      console.log('[useSupabaseDocuments] No valid cache found');
      return [];
    } catch (error) {
      console.warn('[useSupabaseDocuments] Cache read failed:', error);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const loadDocuments = useCallback(async (filters?: { status?: string; submitter_id?: string; silent?: boolean }) => {
    const shouldShowLoading = !filters?.silent && documents.length === 0 && isInitialMount.current;
    
    if (shouldShowLoading) {
      setIsLoading(true);
    }
    isInitialMount.current = false;
    setError(null);
    
    // Always ensure we have a user ID for filtering
    if (!user?.id) {
      console.warn('[useSupabaseDocuments] No user ID available, skipping fetch');
      setIsLoading(false);
      return [];
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const refresh = await supabase.auth.refreshSession();
        if (!refresh.data.session) {
          console.warn('[useSupabaseDocuments] Session expired, skipping fetch');
          setError('Authentication required');
          setIsLoading(false);
          return [];
        }
      }

      let query = supabase
        .from('documents')
        .select('*')
        .eq('submitter_id', filters?.submitter_id || user.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      setDocuments(data || []);
      
      try {
        localStorage.setItem('documents-cache', JSON.stringify(data?.slice(0, 50) || []));
        localStorage.setItem('documents-cache-user', user.id);
      } catch (e) {
        console.warn('Cache write failed:', e);
      }
      
      return data || [];
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setError(err.message);
      
      if (documents.length === 0) {
        try {
          const cached = JSON.parse(localStorage.getItem('documents-cache') || '[]');
          const cachedUser = localStorage.getItem('documents-cache-user');
          if (cachedUser === user.id) {
            setDocuments(cached);
            return cached;
          }
        } catch {
          return [];
        }
      }
      return documents;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const createDocument = useCallback(async (document: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const created = await documentService.createDocument(document);
      setDocuments(prev => [created, ...prev]);
      return { success: true, data: created };
    } catch (err: any) {
      console.error('Failed to create document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateDocument = useCallback(async (id: string, updates: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setDocuments(prev => prev.map(doc => doc.id === id ? data : doc));
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to update document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await documentService.deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const silentRefetch = useCallback(() => {
    if (user?.id) {
      loadDocuments({ submitter_id: user.id, silent: true });
    }
  }, [loadDocuments, user?.id]);
  useVisibilityRefetch(silentRefetch, !!user?.id);

  // Real-time subscription with optimized filtering
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useSupabaseDocuments] Setting up real-time subscription for user:', user.id);

    const channel = supabase
      .channel(`documents-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `submitter_id=eq.${user.id}`
        },
        (payload: any) => {
          const newDoc = (payload.new || undefined) as { id?: string; submitter_id?: string } | undefined;
          const oldDoc = (payload.old || undefined) as { id?: string; submitter_id?: string } | undefined;
          console.log('[useSupabaseDocuments] Real-time event:', payload.eventType, 'for document:', newDoc?.id || oldDoc?.id);
          
          // Double-check user ownership
          if (newDoc && newDoc.submitter_id !== user.id) {
            console.warn('[useSupabaseDocuments] Ignoring event for different user');
            return;
          }
          
          if (payload.eventType === 'INSERT') {
            setDocuments(prev => {
              const exists = prev.some(d => d.id === newDoc?.id);
              if (exists) {
                console.log('[useSupabaseDocuments] Document already exists, skipping INSERT');
                return prev;
              }
              console.log('[useSupabaseDocuments] Adding new document');
              return [newDoc, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setDocuments(prev => {
              const updated = prev.map(doc => doc.id === newDoc?.id ? newDoc : doc);
              console.log('[useSupabaseDocuments] Updated document');
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setDocuments(prev => {
              const filtered = prev.filter(doc => doc.id !== oldDoc?.id);
              console.log('[useSupabaseDocuments] Deleted document');
              return filtered;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useSupabaseDocuments] Subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Documents] Realtime channel error, refetching...');
          setTimeout(() => loadDocuments({ submitter_id: user.id, silent: true }), 2000);
        }
      });

    loadDocuments({ submitter_id: user.id });

    const handleFocus = () => {
      console.log('[useSupabaseDocuments] Window focus - refetching');
      loadDocuments({ submitter_id: user.id, silent: true });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      console.log('[useSupabaseDocuments] Cleaning up subscription');
      channel.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, loadDocuments]);

  const getStatistics = useCallback(() => {
    let pending = 0, approved = 0, rejected = 0;
    let totalTime = 0, approvedCount = 0;
    
    for (const d of documents) {
      if (d.status === 'pending') pending++;
      else if (d.status === 'approved') {
        approved++;
        if (d.updated_at) {
          totalTime += new Date(d.updated_at).getTime() - new Date(d.created_at).getTime();
          approvedCount++;
        }
      } else if (d.status === 'rejected') rejected++;
    }
    
    const avgTimeHours = approvedCount > 0 ? totalTime / (approvedCount * 3600000) : 0;
    const averageTime = avgTimeHours < 1 ? `${Math.round(avgTimeHours * 60)} mins` : `${avgTimeHours.toFixed(1)} hours`;
    
    return {
      pending,
      approved,
      rejected,
      total: documents.length,
      averageTime,
      approvalRate: documents.length > 0 ? Math.round((approved / documents.length) * 100) : 0
    };
  }, [documents]);

  return {
    documents,
    isLoading,
    error,
    createDocument,
    updateDocument,
    deleteDocument,
    loadDocuments,
    getStatistics
  };
}
