// LiveMeet+ hook — ISOLATED: do not import Calendar, GoogleMeetService, or ZoomService
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { liveMeetingService } from '@/services/LiveMeetingService';
import { NotificationDispatchService } from '@/services/NotificationDispatchService';
import {
  LiveMeetingRequest,
  CreateLiveMeetingRequestDto,
  LiveMeetingResponse,
  LiveMeetingStats
} from '@/types/liveMeeting';
import { useVisibilityRefetch } from './useVisibilityRefetch';

export function useLiveMeeting() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LiveMeetingRequest[]>([]);
  const [stats, setStats] = useState<LiveMeetingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    
    try {
      const data = await liveMeetingService.getMyRequests(user.id, undefined, user.recipientId);
      setRequests(data);
      setIsConnected(true);
    } catch (error) {
      console.error('Error loading live meeting requests:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const data = await liveMeetingService.getStats(user.id, user.role, user.recipientId);
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [user]);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [loadRequests, loadStats]);

  // Re-fetch whenever returning to tab
  useVisibilityRefetch(async () => {
    await Promise.all([loadRequests(), loadStats()]);
  }, !!user);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = liveMeetingService.subscribeToRequests(
      user.id,
      user.recipientId,
      (_newRequest) => {
        // Re-fetch from Supabase so RLS is the authority on what this user can see.
        loadRequests();
        loadStats();
      },
      (_updatedRequest) => {
        // P2 FIX: Re-fetch on UPDATE too so RLS visibility and any server-side
        // mutations (e.g. meeting_link generation) are always reflected correctly.
        loadRequests();
        loadStats();
      },
      (deletedId) => {
        setRequests((prev) => prev.filter((r) => r.id !== deletedId));
        loadStats();
      }
    );

    // Safety-net: refetch on window focus
    const handleFocus = () => {
      loadRequests();
      loadStats();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, loadRequests, loadStats]);

  const createRequest = useCallback(async (requestData: CreateLiveMeetingRequestDto) => {
    if (!user) throw new Error('User not authenticated');
    try {
      await liveMeetingService.createRequest(requestData, {
        id: user.id,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  }, [user]);

  const respondToRequest = useCallback(async (response: LiveMeetingResponse) => {
    try {
      await liveMeetingService.respondToRequest(response);

      // Notify the original requester of the response
      const originalRequest = requests.find(r => r.id === response.requestId);
      if (originalRequest?.requesterId) {
        const accepted = response.response === 'accept';
        NotificationDispatchService.dispatch({
          userIds: [originalRequest.requesterId],
          title: `LiveMeet+ ${accepted ? 'Accepted' : 'Declined'}`,
          message: `${user?.name} has ${accepted ? 'accepted' : 'declined'} your LiveMeet+ request for "${originalRequest.documentTitle}".`,
          type: 'meeting',
          action_url: `${window.location.origin}/calendar`,
          document_id: originalRequest.documentId,
          emailParams: {
            type: 'livemeet_response',
            params: {
              submitterName: user?.name || 'A colleague',
              status: accepted ? 'accepted' : 'declined',
              meetUrl: `${window.location.origin}/calendar`,
            },
          },
          pushPayload: {
            title: `LiveMeet+ ${accepted ? 'Accepted' : 'Declined'}`,
            body: `${user?.name} ${accepted ? 'accepted' : 'declined'} your request`,
            url: `${window.location.origin}/calendar`,
          },
        }).catch(err => console.error('[useLiveMeeting] Dispatch failed:', err));
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      throw error;
    }
  }, [requests, user]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadRequests(), loadStats()]);
  }, [loadRequests, loadStats]);

  return {
    requests,
    stats,
    loading,
    isConnected,
    createRequest,
    respondToRequest,
    refreshData
  };
}
