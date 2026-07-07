# IAOMS Meeting Scheduler API Documentation

## Overview
This document outlines the API endpoints needed to support the IAOMS Meeting Scheduler with Google Calendar, Zoom, and Microsoft Teams integration.

## Authentication

### Google Calendar API
```bash
# Environment Variables
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret
VITE_GOOGLE_API_KEY=your_google_api_key
```

### Zoom API
```bash
# Environment Variables
VITE_ZOOM_CLIENT_ID=your_zoom_client_id
VITE_ZOOM_CLIENT_SECRET=your_zoom_client_secret
VITE_ZOOM_ACCOUNT_ID=your_zoom_account_id
```

### Microsoft Teams API
```bash
# Environment Variables
VITE_MS_CLIENT_ID=your_microsoft_client_id
VITE_MS_CLIENT_SECRET=your_microsoft_client_secret
VITE_MS_TENANT_ID=your_microsoft_tenant_id
```

## API Endpoints

### 1. Meeting Management

#### Create Meeting
```http
POST /api/meetings
Content-Type: application/json

{
  "title": "Faculty Meeting",
  "description": "Monthly faculty review",
  "date": "2024-01-25",
  "time": "10:00",
  "duration": 60,
  "type": "online",
  "location": "google-meet",
  "priority": "high",
  "category": "academic",
  "attendees": [
    {
      "id": "user-1",
      "name": "Dr. Smith",
      "email": "smith@university.edu",
      "role": "Professor",
      "isRequired": true
    }
  ],
  "notifications": {
    "email": true,
    "dashboard": true,
    "teams": false,
    "reminders": [
      {
        "type": "email",
        "timing": 1440,
        "enabled": true
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "meeting-123",
      "title": "Faculty Meeting",
      "meetingLinks": {
        "googleMeet": {
          "joinUrl": "https://meet.google.com/abc-defg-hij",
          "meetingId": "abc-defg-hij"
        },
        "primary": "google-meet"
      },
      "status": "scheduled"
    },
    "notifications": [
      {
        "type": "email",
        "status": "sent",
        "recipient": "smith@university.edu"
      }
    ]
  }
}
```

#### Get Meetings
```http
GET /api/meetings?date=2024-01-25&userId=user-1
```

#### Update Meeting
```http
PATCH /api/meetings/{meetingId}
Content-Type: application/json

{
  "title": "Updated Meeting Title",
  "time": "11:00"
}
```

#### Cancel Meeting
```http
POST /api/meetings/{meetingId}/cancel
Content-Type: application/json

{
  "reason": "Scheduling conflict"
}
```

### 2. Conflict Detection

#### Check Conflicts
```http
POST /api/meetings/conflicts
Content-Type: application/json

{
  "date": "2024-01-25",
  "time": "10:00",
  "duration": 60,
  "attendees": ["user-1", "user-2"]
}
```

**Response:**
```json
{
  "hasConflict": true,
  "conflicts": [
    {
      "meetingId": "meeting-456",
      "meetingTitle": "Board Meeting",
      "attendeeId": "user-1",
      "attendeeName": "Dr. Smith",
      "severity": "high"
    }
  ],
  "suggestions": [
    {
      "date": "2024-01-25",
      "time": "14:00",
      "duration": 60,
      "availabilityScore": 0.95,
      "conflictCount": 0
    }
  ]
}
```

### 3. AI Scheduling Suggestions

#### Get AI Suggestions
```http
POST /api/meetings/ai-suggestions
Content-Type: application/json

{
  "title": "Department Meeting",
  "attendees": ["user-1", "user-2", "user-3"],
  "preferredDuration": 90,
  "department": "Computer Science",
  "priority": "high"
}
```

**Response:**
```json
{
  "recommendedSlots": [
    {
      "date": "2024-01-26",
      "time": "10:00",
      "duration": 90,
      "availabilityScore": 0.98,
      "conflictCount": 0,
      "suggestedBy": "ai"
    }
  ],
  "conflictAnalysis": {
    "bestTimeRange": {
      "start": "10:00",
      "end": "11:30",
      "reason": "Highest availability across all attendees"
    }
  },
  "roomSuggestions": [
    {
      "roomId": "conf-a",
      "roomName": "Conference Room A",
      "capacity": 12,
      "availability": true,
      "amenities": ["Projector", "Whiteboard"]
    }
  ]
}
```

### 4. Meeting Platform Integration

#### Create Google Meet Event
```http
POST /api/meetings/google-meet
Content-Type: application/json

{
  "summary": "Faculty Meeting",
  "description": "Monthly review",
  "start": {
    "dateTime": "2024-01-25T10:00:00Z",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2024-01-25T11:00:00Z",
    "timeZone": "America/New_York"
  },
  "attendees": [
    {
      "email": "smith@university.edu",
      "displayName": "Dr. Smith"
    }
  ],
  "conferenceData": {
    "createRequest": {
      "conferenceSolutionKey": {
        "type": "hangoutsMeet"
      },
      "requestId": "unique-request-id"
    }
  }
}
```

#### Create Zoom Meeting
```http
POST /api/meetings/zoom
Content-Type: application/json

{
  "topic": "Faculty Meeting",
  "agenda": "Monthly review",
  "type": 2,
  "start_time": "2024-01-25T10:00:00Z",
  "duration": 60,
  "timezone": "America/New_York",
  "settings": {
    "host_video": true,
    "participant_video": true,
    "waiting_room": true
  }
}
```

#### Create Teams Meeting
```http
POST /api/meetings/teams
Content-Type: application/json

{
  "subject": "Faculty Meeting",
  "body": {
    "contentType": "HTML",
    "content": "Monthly review meeting"
  },
  "start": {
    "dateTime": "2024-01-25T10:00:00Z",
    "timeZone": "America/New_York"
  },
  "end": {
    "dateTime": "2024-01-25T11:00:00Z",
    "timeZone": "America/New_York"
  },
  "isOnlineMeeting": true,
  "onlineMeetingProvider": "teamsForBusiness"
}
```

### 5. Attendance Tracking

#### Get Meeting Attendance
```http
GET /api/meetings/{meetingId}/attendance
```

**Response:**
```json
{
  "attendance": [
    {
      "attendeeId": "user-1",
      "attendeeName": "Dr. Smith",
      "joinTime": "2024-01-25T10:02:00Z",
      "leaveTime": "2024-01-25T11:00:00Z",
      "duration": 3480,
      "status": "present",
      "platform": "google-meet"
    }
  ]
}
```

### 6. Minutes of Meeting (MOM) Generation

#### Generate MOM
```http
POST /api/meetings/{meetingId}/mom
```

**Response:**
```json
{
  "success": true,
  "momUrl": "https://docs.google.com/document/d/doc-id/edit",
  "driveId": "drive-file-id",
  "generatedAt": "2024-01-25T11:05:00Z"
}
```

### 7. Notifications

#### Send Meeting Notifications
```http
POST /api/meetings/{meetingId}/notifications
Content-Type: application/json

{
  "types": ["email", "dashboard", "teams"],
  "timing": "immediate"
}
```

### 8. Authentication Endpoints

#### Get Zoom Access Token
```http
POST /api/zoom/auth/token
Content-Type: application/json

{
  "clientId": "zoom_client_id",
  "clientSecret": "zoom_client_secret"
}
```

#### Get Microsoft Access Token
```http
POST /api/microsoft/auth/token
Content-Type: application/json

{
  "clientId": "ms_client_id",
  "clientSecret": "ms_client_secret",
  "tenantId": "ms_tenant_id"
}
```

## Integration Flow

### 1. Google Meet Auto-Generation
1. User selects Google Meet as platform
2. Frontend calls `/api/meetings/google-meet` with `conferenceDataVersion=1`
3. Google Calendar API creates event with `conferenceData.createRequest`
4. API returns meeting with `conferenceData.entryPoints` containing join URL
5. Meeting link stored in IAOMS database

### 2. Zoom Meeting Creation
1. User selects Zoom as platform
2. Backend authenticates with Zoom using OAuth
3. Call Zoom API `/users/me/meetings` endpoint
4. Zoom returns `join_url` and `start_url`
5. Links stored and shared with attendees

### 3. Teams Meeting Creation
1. User selects Teams as platform
2. Backend authenticates with Microsoft Graph
3. Call Graph API `/me/events` with `isOnlineMeeting: true`
4. Microsoft returns `onlineMeeting.joinUrl`
5. Teams link integrated into calendar event

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Meeting title is required",
  "details": {
    "field": "title",
    "code": "REQUIRED"
  }
}
```

## Rate Limits

- Google Calendar API: 1,000 requests per 100 seconds per user
- Zoom API: 10 requests per second
- Microsoft Graph: Variable based on license

## Webhook Support

Configure webhooks for real-time updates:

```http
POST /api/webhooks/meetings
Content-Type: application/json

{
  "url": "https://your-domain.com/webhooks/meeting-updates",
  "events": ["meeting.created", "meeting.updated", "meeting.cancelled"],
  "secret": "webhook-secret"
}
```
