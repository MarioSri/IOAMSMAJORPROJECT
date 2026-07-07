// ────────────────────────────────────────────────────────────────────────────
// Calendar / Meeting Scheduler
// Handles scheduled meetings, Google Meet & Zoom links, calendar events.
// Table: meetings
// ────────────────────────────────────────────────────────────────────────────
export { MeetingAPIService, meetingAPI } from './MeetingAPIService';
export { calendarService } from './CalendarService';

// ────────────────────────────────────────────────────────────────────────────
// LiveMeet+ (Approval-Workflow Communication)
// Handles request/accept/reject workflow for document discussions.
// Table: live_meeting_requests  —  ISOLATED from Calendar / video conferencing.
// ────────────────────────────────────────────────────────────────────────────
export { liveMeetingService } from './LiveMeetingService';

// ────────────────────────────────────────────────────────────────────────────
// Other Services
// ────────────────────────────────────────────────────────────────────────────
export { BiDirectionalWorkflowEngine } from './BiDirectionalWorkflowEngine';
export { ChannelAutoCreationService, channelAutoCreationService } from './ChannelAutoCreationService';
export { DecentralizedChatService } from './DecentralizedChatService';
export { DocumentWorkflowIntegration } from './DocumentWorkflowIntegration';
export type { DocumentWorkflowEvent, WorkflowNotification } from './DocumentWorkflowIntegration';
export { emergencyNotificationService } from './EmergencyNotificationService';
export { escalationService } from './EscalationService';
export { ExternalNotificationDispatcher, type NotificationPayload } from './ExternalNotificationDispatcher';
export { notificationService } from './NotificationService';
export { apiService } from './api';
export { GeminiAIService, geminiAI } from './geminiAI';
export { departmentChatService } from './DepartmentChatService';
export type { ChatChannel as DeptChatChannel, ChatMessage as DeptChatMessage } from './DepartmentChatService';
export { analyticsService } from './AnalyticsService';
export type { AnalyticsMetric, DepartmentStat, MonthlyTrend, UserActivity } from './AnalyticsService';
