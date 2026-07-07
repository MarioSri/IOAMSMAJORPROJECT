import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseBypassService } from '@/services/SupabaseBypassService';
import type { BypassDocument } from '@/services/SupabaseBypassService';
import { useAuth } from '@/contexts/AuthContext';
import { safeSetItem } from '@/utils/localStorageCache';
import { useVisibilityRefetch } from './useVisibilityRefetch';

export function useSupabaseBypass() {
  const { user } = useAuth();
  
  // Initialize with validated cache IMMEDIATELY for instant display
  const [documents, setDocuments] = useState<any[]>(() => {
    if (!user?.id) return [];
    
    try {
      const cached = localStorage.getItem('bypass-cache');
      const cachedUser = localStorage.getItem('bypass-cache-user');
      
      if (cached && cachedUser === user.id) {
        const parsedCache = JSON.parse(cached);
        console.log('[useSupabaseBypass] Loaded', parsedCache.length, 'documents from cache instantly');
        return parsedCache;
      }
      
      console.log('[useSupabaseBypass] No valid cache found');
      return [];
    } catch (error) {
      console.warn('[useSupabaseBypass] Cache read failed:', error);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const loadDocuments = useCallback(async (filters?: { status?: string; silent?: boolean }) => {
    const shouldShowLoading = !filters?.silent && documents.length === 0 && isInitialMount.current;
    
    if (shouldShowLoading) {
      setIsLoading(true);
    }
    isInitialMount.current = false;
    setError(null);
    
    if (!user?.id) {
      console.warn('[useSupabaseBypass] No user ID available, skipping fetch');
      setIsLoading(false);
      return [];
    }
    
    try {
      const scopedFilters = { 
        ...filters, 
        submitter_id: user.id 
      };
      const data = await supabaseBypassService.getBypassDocuments(scopedFilters);
      setDocuments(data);
      
      safeSetItem('bypass-cache', JSON.stringify(data.slice(0, 25)));
      safeSetItem('bypass-cache-user', user.id);
      
      return data;
    } catch (err: any) {
      console.error('Failed to load bypass documents:', err);
      setError(err.message);
      
      if (documents.length === 0) {
        const cached = supabaseBypassService.getFromCache();
        const cachedUser = localStorage.getItem('bypass-cache-user');
        if (cachedUser === user.id) {
          setDocuments(cached);
          return cached;
        }
      }
      return documents;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const createDocument = useCallback(async (document: BypassDocument) => {
    setIsLoading(true);
    setError(null);
    try {
      const created = await supabaseBypassService.createBypassDocument(document);
      
      setDocuments(prev => [created, ...prev]);
      await supabaseBypassService.syncToCache(created);
      
      return { success: true, data: created };
    } catch (err: any) {
      console.error('Failed to create bypass document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateDocument = useCallback(async (id: string, updates: Partial<BypassDocument>) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await supabaseBypassService.updateBypassDocument(id, updates);
      
      setDocuments(prev => prev.map(doc => doc.id === id ? updated : doc));
      await supabaseBypassService.syncToCache(updated);
      
      return { success: true, data: updated };
    } catch (err: any) {
      console.error('Failed to update bypass document:', err);
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
      await supabaseBypassService.deleteBypassDocument(id);
      
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete bypass document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const silentRefetch = useCallback(() => { 
    if (user?.id) {
      loadDocuments({ silent: true }); 
    }
  }, [loadDocuments, user?.id]);

  // Re-fetch whenever the user returns to this tab after inactivity / tab switching
  useVisibilityRefetch(silentRefetch, !!user?.id);

  useEffect(() => {
    if (!user?.id) return;

    console.log('[useSupabaseBypass] Setting up real-time subscription for user:', user.id);

    const cachedUser = localStorage.getItem('bypass-cache-user');
    if (cachedUser && cachedUser !== user.id) {
      console.log('[useSupabaseBypass] Cache belongs to different user, clearing');
      localStorage.removeItem('bypass-cache');
      localStorage.removeItem('bypass-cache-user');
      setDocuments([]);
    }

    const channel = supabaseBypassService.subscribeToBypassDocuments((payload) => {
      console.log('[useSupabaseBypass] Real-time event:', payload.eventType);
      
      if (payload.new && payload.new.submitter_id !== user.id) {
        console.warn('[useSupabaseBypass] Ignoring event for different user');
        return;
      }

      if (payload.eventType === 'INSERT') {
        setDocuments(prev => {
          const exists = prev.some(d => d.id === payload.new.id);
          if (exists) {
            console.log('[useSupabaseBypass] Document already exists, skipping INSERT');
            return prev;
          }
          return [payload.new, ...prev];
        });
        supabaseBypassService.syncToCache(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        setDocuments(prev => prev.map(doc => doc.id === payload.new.id ? payload.new : doc));
        supabaseBypassService.syncToCache(payload.new);
      } else if (payload.eventType === 'DELETE') {
        setDocuments(prev => prev.filter(doc => doc.id !== payload.old.id));
      }
    }, { submitter_id: user.id });

    loadDocuments();

    const handleFocus = () => {
      console.log('[useSupabaseBypass] Window focus - refetching');
      loadDocuments({ silent: true });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      console.log('[useSupabaseBypass] Cleaning up subscription');
      channel?.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, loadDocuments]);

  const getStatistics = useCallback(() => {
    let pending = 0, completed = 0, bypassed = 0;
    let totalMs = 0, completedCount = 0;
    
    for (const d of documents) {
      if (d.status === 'pending') pending++;
      else if (d.status === 'approved') completed++;
      else if (d.status === 'bypassed') bypassed++;
      
      if ((d.status === 'approved' || d.status === 'bypassed') && d.created_at && d.updated_at) {
        totalMs += new Date(d.updated_at).getTime() - new Date(d.created_at).getTime();
        completedCount++;
      }
    }
    
    let avgHoursStr = '0 hours';
    if (completedCount > 0) {
      const avgHours = totalMs / (completedCount * 3600000);
      avgHoursStr = avgHours < 1 ? `${Math.round(avgHours * 60)} mins` : `${avgHours.toFixed(1)} hours`;
    }

    return {
      pending,
      completed,
      bypassed,
      bypassCount: bypassed,
      total: documents.length,
      averageTime: avgHoursStr,
      responseRate: documents.length > 0 ? Math.round((completed / documents.length) * 100) : 0
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
