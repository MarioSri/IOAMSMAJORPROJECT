import { Meeting } from '@/types/meeting';

interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  branch?: string;
}

export function filterMeetingsByRecipient(
  meetings: Meeting[],
  currentUser: User | null
): Meeting[] {
  if (!currentUser) {
    console.warn('[Meeting Filtering] No current user - showing no meetings');
    return [];
  }

  if (!meetings || meetings.length === 0) {
    return [];
  }

  const currentUserId = String(currentUser.id ?? '');
  const currentUserName = currentUser.name ?? '';
  const currentUserEmail = (currentUser.email ?? '').toLowerCase().trim();

  const filteredMeetings = meetings.filter((meeting) => {
    const meetingCreatorId = String(meeting.createdBy ?? '');

    if (meetingCreatorId === currentUserId) {
      return true;
    }

    const isAttendee = meeting.attendees?.some((attendee) => {
      const attendeeId = String(attendee.id ?? '');
      const attendeeEmail = (attendee.email ?? '').toLowerCase().trim();

      if (attendeeId && currentUserId && attendeeId === currentUserId) {
        return true;
      }

      if (attendeeEmail && currentUserEmail && attendeeEmail === currentUserEmail) {
        return true;
      }

      if (attendee.name && currentUserName && attendee.name === currentUserName) {
        return true;
      }

      return false;
    });

    return !!isAttendee;
  });

  return filteredMeetings;
}

export function saveMeetingsToStorage(meetings: Meeting[]): void {
  try {
    localStorage.setItem('meetings', JSON.stringify(meetings));
  } catch (error) {
    console.error('[Meeting Storage] Error saving to localStorage:', error);
  }
}

export function loadMeetingsFromStorage(): Meeting[] {
  try {
    const stored = localStorage.getItem('meetings');
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('[Meeting Storage] Error loading from localStorage:', error);
    return [];
  }
}

export function addMeetingToStorage(meeting: Meeting): void {
  const existingMeetings = loadMeetingsFromStorage();
  const updatedMeetings = [meeting, ...existingMeetings];
  saveMeetingsToStorage(updatedMeetings);
  window.dispatchEvent(new CustomEvent('meetings-updated', { detail: meeting }));
}

export function updateMeetingInStorage(meetingId: string, updatedMeeting: Partial<Meeting>): void {
  const existingMeetings = loadMeetingsFromStorage();
  const updatedMeetings = existingMeetings.map(m =>
    m.id === meetingId ? { ...m, ...updatedMeeting } : m
  );
  saveMeetingsToStorage(updatedMeetings);
  window.dispatchEvent(new CustomEvent('meetings-updated', { detail: updatedMeeting }));
}

export function deleteMeetingFromStorage(meetingId: string): void {
  const existingMeetings = loadMeetingsFromStorage();
  const updatedMeetings = existingMeetings.filter(m => m.id !== meetingId);
  saveMeetingsToStorage(updatedMeetings);
  window.dispatchEvent(new CustomEvent('meetings-updated', { detail: { id: meetingId } }));
}
