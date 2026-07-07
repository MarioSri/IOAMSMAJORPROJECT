export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  attendees: MeetingAttendee[];
  location: string;
  type: MeetingType;
  status: MeetingStatus;
  documents: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  recurringPattern?: RecurringPattern;
  approvalWorkflow?: ApprovalWorkflow;
  meetingLinks?: MeetingLinks;
  notifications?: NotificationSettings;
  attendance?: AttendanceRecord[];
  momTemplate?: string;
  priority: MeetingPriority;
  isRecurring: boolean;
  parentMeetingId?: string;
  tags: string[];
  department?: string;
  category: MeetingCategory;
}

export interface MeetingAttendee {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: AttendeeStatus;
  responseTime?: Date;
  isRequired: boolean;
  canEdit: boolean;
}

export interface MeetingLinks {
  iaomsMeet?: IAOMSMeetInfo;
  primary: MeetingPlatform;
}



export interface IAOMSMeetInfo {
  meetingId: string;
  joinUrl: string;
  roomId: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}



export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: Date;
  occurrences?: number;
  exceptions?: Date[];
}

export interface ApprovalWorkflow {
  isRequired: boolean;
  approvers: ApprovalStep[];
  currentStep: number;
  status: ApprovalStatus;
  requestedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  comments?: ApprovalComment[];
}

export interface ApprovalStep {
  id: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  order: number;
  status: ApprovalStatus;
  responseTime?: Date;
  comments?: string;
  isRequired: boolean;
}

export interface ApprovalComment {
  id: string;
  approverId: string;
  approverName: string;
  comment: string;
  timestamp: Date;
  attachments?: string[];
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  reminders: ReminderSettings[];
  escalation: EscalationSettings;
}

export interface ReminderSettings {
  type: 'email' | 'push' | 'sms' | 'whatsapp';
  timing: number; // minutes before meeting
  enabled: boolean;
  customMessage?: string;
}

export interface EscalationSettings {
  enabled: boolean;
  escalateAfterHours: number;
  escalateTo: string[];
  autoApprove: boolean;
}

export interface AttendanceRecord {
  attendeeId: string;
  attendeeName: string;
  joinTime?: Date;
  leaveTime?: Date;
  duration?: number;
  status: 'present' | 'absent' | 'late' | 'early_leave';
  platform?: MeetingPlatform;
}

export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: MeetingConflict[];
  suggestions: TimeSlotSuggestion[];
}

export interface MeetingConflict {
  meetingId: string;
  meetingTitle: string;
  attendeeId: string;
  attendeeName: string;
  conflictTime: {
    start: Date;
    end: Date;
  };
  severity: 'low' | 'medium' | 'high';
}

export interface TimeSlotSuggestion {
  date: string;
  time: string;
  duration: number;
  availabilityScore: number;
  conflictCount: number;
  suggestedBy: 'ai' | 'calendar_analysis';
}

export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  defaultDuration: number;
  defaultAttendees: string[];
  agenda: string;
  requiredApprovals: boolean;
  category: MeetingCategory;
  createdBy: string;
  isPublic: boolean;
}

export interface MeetingDocument {
  id: string;
  name: string;
  type: 'agenda' | 'minutes' | 'circular' | 'report' | 'proposal';
  url: string;
  driveId?: string;
  createdAt: Date;
  createdBy: string;
  isRequired: boolean;
  permissions: DocumentPermission[];
}

export interface DocumentPermission {
  userId: string;
  permission: 'view' | 'edit' | 'comment';
}

export interface AISchedulingSuggestion {
  recommendedSlots: TimeSlotSuggestion[];
  optimalDuration: number;
  suggestedAttendees: string[];
  conflictAnalysis: ConflictAnalysis;
  roomSuggestions: RoomSuggestion[];
  agendaTemplate?: string;
}

export interface ConflictAnalysis {
  totalConflicts: number;
  highPriorityConflicts: number;
  affectedAttendees: string[];
  alternativeSlots: TimeSlotSuggestion[];
  bestTimeRange: {
    start: string;
    end: string;
    reason: string;
  };
}

export interface RoomSuggestion {
  roomId: string;
  roomName: string;
  capacity: number;
  availability: boolean;
  amenities: string[];
  bookingUrl?: string;
}

export interface MeetingAnalytics {
  totalMeetings: number;
  completionRate: number;
  averageDuration: number;
  attendanceRate: number;
  platformUsage: Record<MeetingPlatform, number>;
  topAttendees: AttendeeStats[];
  meetingTrends: MeetingTrend[];
  departmentStats: DepartmentMeetingStats[];
}

export interface AttendeeStats {
  attendeeId: string;
  attendeeName: string;
  meetingsAttended: number;
  attendanceRate: number;
  averageJoinTime: number;
}

export interface MeetingTrend {
  date: string;
  count: number;
  duration: number;
  type: string;
}

export interface DepartmentMeetingStats {
  department: string;
  totalMeetings: number;
  averageDuration: number;
  attendanceRate: number;
  topMeetingTypes: string[];
}

export type MeetingType = 'online' | 'physical' | 'hybrid';
export type MeetingPlatform = 'iaoms-meet';
export type MeetingStatus = 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'postponed';
export type AttendeeStatus = 'invited' | 'accepted' | 'declined' | 'tentative' | 'no-response';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto-approved';
export type MeetingPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MeetingCategory = 'academic' | 'administrative' | 'financial' | 'recruitment' | 'disciplinary' | 'emergency' | 'social' | 'training' | 'other';

export interface CreateMeetingResponse {
  meeting: Meeting;
  meetingLinks: MeetingLinks;
  calendarEvent?: any;
  notifications: NotificationStatus[];
}

export interface NotificationStatus {
  type: 'email' | 'dashboard';
  status: 'sent' | 'failed' | 'pending';
  recipient: string;
  sentAt?: Date;
  error?: string;
}

export interface MeetingAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CalendarIntegration {
  platform: 'google' | 'outlook' | 'apple';
  isConnected: boolean;
  lastSync: Date;
  syncStatus: 'active' | 'error' | 'paused';
  settings: CalendarSyncSettings;
}

export interface CalendarSyncSettings {
  autoSync: boolean;
  syncDirection: 'both' | 'iaoms-to-calendar' | 'calendar-to-iaoms';
  defaultReminders: number[];
  excludePrivate: boolean;
  calendarId?: string;
}
