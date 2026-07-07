import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { calendarService } from '@/services/CalendarService';
import { Meeting } from '@/types/meeting';
import { filterMeetingsByRecipient } from '@/utils/meetingFilters';
import { useVisibilityRefetch } from './useVisibilityRefetch';

export function useCalendar() {
  const { user } = useAuth();

  // ── Initialise from CalendarService cache so the first render has data ────────
  const [allMeetings, setAllMeetings] = useState<Meeting[]>(() =>
    calendarService.getCachedMeetingsPublic()
  );
  // Only show the spinner when the cache is empty
  const [loading, setLoading] = useState<boolean>(
    () => calendarService.getCachedMeetingsPublic().length === 0
  );
  const [isConnected, setIsConnected] = useState(false);

  const meetings = useMemo(() => {
    return filterMeetingsByRecipient(allMeetings, user)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allMeetings, user]);

  const loadMeetings = useCallback(async () => {
    if (!user) return;

    // Silent background refresh when meetings already in state
    if (allMeetings.length === 0) {
      setLoading(true);
    }

    try {
      const data = await calendarService.getMeetings();
      setAllMeetings(data);
      setIsConnected(true);
    } catch (error) {
      console.error('Error loading meetings:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Re-fetch meetings whenever user returns to the tab.
  useVisibilityRefetch(loadMeetings, !!user);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = calendarService.subscribeToMeetings(
      (newMeeting) => {
        setAllMeetings((prev) => [newMeeting, ...prev]);
      },
      (updatedMeeting) => {
        setAllMeetings((prev) =>
          prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m))
        );
      },
      (deletedId) => {
        setAllMeetings((prev) => prev.filter((m) => m.id !== deletedId));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, loadMeetings]);

  const createMeeting = useCallback(async (meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await calendarService.createMeeting(meeting);
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw error;
    }
  }, []);

  const updateMeeting = useCallback(async (id: string, updates: Partial<Meeting>) => {
    try {
      await calendarService.updateMeeting(id, updates);
    } catch (error) {
      console.error('Error updating meeting:', error);
      throw error;
    }
  }, []);

  const deleteMeeting = useCallback(async (id: string) => {
    try {
      await calendarService.deleteMeeting(id);
    } catch (error) {
      console.error('Error deleting meeting:', error);
      throw error;
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadMeetings();
  }, [loadMeetings]);

  return {
    allMeetings,
    meetings,
    loading,
    isConnected,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    refreshData
  };
}
