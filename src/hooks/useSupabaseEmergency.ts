import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseEmergencyService } from '@/services/SupabaseEmergencyService';
import type { EmergencyDocument, EmergencyNotification } from '@/services/SupabaseEmergencyService';
import { useAuth } from '@/contexts/AuthContext';
import { safeSetItem } from '@/utils/localStorageCache';
import { useVisibilityRefetch } from './useVisibilityRefetch';

export function useSupabaseEmergency() {
  const { user } = useAuth();
  
  // Initialize with validated cache IMMEDIATELY for instant display
  const [documents, setDocuments] = useState<any[]>(() => {
    if (!user?.id) return [];
    
    try {
      const cached = localStorage.getItem('emergency-cache');
      const cachedUser = localStorage.getItem('emergency-cache-user');
      
      // Only use cache if it belongs to current user
      if (cached && cachedUser === user.id) {
        const parsedCache = JSON.parse(cached);
        console.log('[useSupabaseEmergency] Loaded', parsedCache.length, 'documents from cache instantly');
        return parsedCache;
      }
      
      console.log('[useSupabaseEmergency] No valid cache found');
      return [];
    } catch (error) {
      console.warn('[useSupabaseEmergency] Cache read failed:', error);
      return [];
    }
  });
  const [notifications, setNotifications] = useState<any[]>([]);
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
      console.warn('[useSupabaseEmergency] No user ID available, skipping fetch');
      setIsLoading(false);
      return [];
    }
    
    try {
      // Always filter by current user
      const scopedFilters = { 
        ...filters, 
        submitter_id: filters?.submitter_id || user.id 
      };
      const data = await supabaseEmergencyService.getEmergencyDocuments(scopedFilters);
      setDocuments(data);
      
      // Store with user ID for validation
      safeSetItem('emergency-cache', JSON.stringify(data.slice(0, 25)));
      safeSetItem('emergency-cache-user', user.id);
      
      return data;
    } catch (err: any) {
      console.error('Failed to load emergency documents:', err);
      setError(err.message);
      
      if (documents.length === 0) {
        const cached = supabaseEmergencyService.getFromCache();
        const cachedUser = localStorage.getItem('emergency-cache-user');
        // Only use cache if it belongs to current user
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

  // Create emergency document
  const createDocument = useCallback(async (document: EmergencyDocument) => {
    setIsLoading(true);
    setError(null);
    try {
      const created = await supabaseEmergencyService.createEmergencyDocument(document);
      
      // Update local state
      setDocuments(prev => [created, ...prev]);
      
      // Sync to cache
      await supabaseEmergencyService.syncToCache(created);
      
      return { success: true, data: created };
    } catch (err: any) {
      console.error('Failed to create emergency document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update emergency document
  const updateDocument = useCallback(async (id: string, updates: Partial<EmergencyDocument>) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await supabaseEmergencyService.updateEmergencyDocument(id, updates);
      
      // Update local state
      setDocuments(prev => prev.map(doc => doc.id === id ? updated : doc));
      
      // Sync to cache
      await supabaseEmergencyService.syncToCache(updated);
      
      return { success: true, data: updated };
    } catch (err: any) {
      console.error('Failed to update emergency document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete emergency document
  const deleteDocument = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await supabaseEmergencyService.deleteEmergencyDocument(id);
      
      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete emergency document:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create notification
  const createNotification = useCallback(async (notification: EmergencyNotification) => {
    try {
      const created = await supabaseEmergencyService.createNotification(notification);
      return { success: true, data: created };
    } catch (err: any) {
      console.error('Failed to create notification:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Load notifications for recipient
  const loadNotifications = useCallback(async (recipientId: string) => {
    try {
      const data = await supabaseEmergencyService.getNotificationsByRecipient(recipientId);
      setNotifications(data);
      return data;
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      return [];
    }
  }, []);

  const silentRefetch = useCallback(() => { 
    if (user?.id) {
      loadDocuments({ submitter_id: user.id, silent: true }); 
    }
  }, [loadDocuments, user?.id]);
  
  // Re-fetch data whenever the user returns to this tab after inactivity or
  // tab switching — ensures stale/missing data is recovered without a manual refresh.
  useVisibilityRefetch(silentRefetch, !!user?.id);

  // Subscribe to real-time updates with optimized filtering
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useSupabaseEmergency] Setting up real-time subscription for user:', user.id);

    // Validate cache on mount
    const cachedUser = localStorage.getItem('emergency-cache-user');
    if (cachedUser && cachedUser !== user.id) {
      console.log('[useSupabaseEmergency] Cache belongs to different user, clearing');
      localStorage.removeItem('emergency-cache');
      localStorage.removeItem('emergency-cache-user');
      setDocuments([]);
    }

    const channel = supabaseEmergencyService.subscribeToEmergencyDocuments(
      (payload) => {
        console.log('[useSupabaseEmergency] Real-time event:', payload.eventType, 'for document:', payload.new?.id || payload.old?.id);
        
        if (payload.new && payload.new.submitter_id !== user.id) {
          console.warn('[useSupabaseEmergency] Ignoring event for different user');
          return;
        }
        
        if (payload.eventType === 'INSERT') {
          setDocuments(prev => {
            const exists = prev.some(d => d.id === payload.new.id);
            if (exists) {
              console.log('[useSupabaseEmergency] Document already exists, skipping INSERT');
              return prev;
            }
            console.log('[useSupabaseEmergency] Adding new document');
            return [payload.new, ...prev];
          });
          supabaseEmergencyService.syncToCache(payload.new);
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => prev.map(doc => doc.id === payload.new.id ? payload.new : doc));
          supabaseEmergencyService.syncToCache(payload.new);
          console.log('[useSupabaseEmergency] Updated document');
        } else if (payload.eventType === 'DELETE') {
          setDocuments(prev => prev.filter(doc => doc.id !== payload.old.id));
          console.log('[useSupabaseEmergency] Deleted document');
        }
      },
      { submitter_id: user.id }
    );

    let notificationChannel;
    if (user.id) {
      notificationChannel = supabaseEmergencyService.subscribeToNotifications(
        user.id,
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new, ...prev]);
          }
        }
      );
    }

    loadDocuments({ submitter_id: user.id });

    const handleFocus = () => {
      console.log('[useSupabaseEmergency] Window focus - refetching');
      loadDocuments({ submitter_id: user.id, silent: true });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      console.log('[useSupabaseEmergency] Cleaning up subscription');
      channel?.unsubscribe();
      notificationChannel?.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, loadDocuments]);

  const getStatistics = useCallback(() => {
    let active = 0, resolvedCount = 0, resolvedMonth = 0;
    let totalTime = 0, resolvedWithTime = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    for (const d of documents) {
      if (d.status === 'submitted') active++;
      else if (d.status === 'resolved') {
        resolvedCount++;
        const docDate = new Date(d.created_at);
        if (docDate.getMonth() === currentMonth && docDate.getFullYear() === currentYear) {
          resolvedMonth++;
        }
        if (d.updated_at) {
          totalTime += new Date(d.updated_at).getTime() - new Date(d.created_at).getTime();
          resolvedWithTime++;
        }
      }
    }
    
    const avgResponseTime = resolvedWithTime > 0 ? Math.round(totalTime / (resolvedWithTime * 60000)) : 0;
    
    return {
      active,
      resolved: resolvedCount,
      resolvedMonth,
      avgResponseTime,
      total: documents.length,
      responseRate: documents.length > 0 ? Math.round((resolvedCount / documents.length) * 100) : 0
    };
  }, [documents]);

  return {
    documents,
    notifications,
    isLoading,
    error,
    createDocument,
    updateDocument,
    deleteDocument,
    createNotification,
    loadDocuments,
    loadNotifications,
    getStatistics
  };
}
