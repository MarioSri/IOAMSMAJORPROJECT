# MeetingBot Integration Analysis for Calendar Meeting Tracking

## Executive Summary

**MeetingBot** (https://github.com/meetingbot/meetingbot) is an open-source meeting bot API that can join Google Meet, Zoom, and Microsoft Teams meetings to record them. However, it has **LIMITED** capability to meet all your detailed participant tracking requirements without significant customization.

---

## ✅ What MeetingBot PROVIDES (Out of the Box)

### 1. **Platform Support** ✅
```typescript
// Supported Platforms
- Google Meet ✅
- Zoom ✅
- Microsoft Teams ✅
```

### 2. **Basic Bot Capabilities** ✅
- **Automatically joins meetings** using meeting URL/ID
- **Records the entire meeting** (audio + video)
- **Uploads recordings to S3** automatically
- **Bot deployment via API** - Simple REST API to send bots
- **Status tracking** - Bot lifecycle management

### 3. **Recording Features** ✅
```typescript
// From bot.ts - Recording capabilities
- Full audio/video recording
- Automatic upload to AWS S3
- Signed URLs for downloading recordings
- Multiple video formats (MP4, WebM)
```

### 4. **Basic Participant Tracking** ⚠️ (LIMITED)
```typescript
// From meet/src/bot.ts (Google Meet bot)
participants: Participant[] = [];

// Can track:
- Participant names
- When participants join/leave the meeting
- Basic participant list
```

### 5. **Infrastructure** ✅
- **Self-hosted** - Deploy on your AWS account
- **Docker containers** - Bots run in isolated containers
- **PostgreSQL database** - For storing bot/meeting metadata
- **Terraform IaC** - Infrastructure as Code for easy deployment
- **API-first design** - RESTful API for all operations

---

## ❌ What MeetingBot DOES NOT Provide (Your Requirements)

### 1. **Detailed Participation Metrics** ❌
```
REQUIRED: Track screen on/off status per participant
MEETINGBOT: Does NOT track individual screen states

REQUIRED: Track audio on/off (listening status) per participant
MEETINGBOT: Does NOT track individual audio states

REQUIRED: Rejoin timestamps for each participant
MEETINGBOT: Basic join/leave tracking only

REQUIRED: Total duration per participant
MEETINGBOT: Would need to be calculated from join/leave events
```

### 2. **Minutes of Meeting (MOM) Auto-Generation** ❌
```
REQUIRED: Automatic MOM generation at meeting end
MEETINGBOT: NO automatic transcription or MOM generation
          - Only provides raw video/audio recording
          - No AI summarization
          - No action item extraction
```

### 3. **Real-Time Engagement Tracking** ❌
```
REQUIRED: Real-time tracking of participant engagement
MEETINGBOT: Limited to basic participant list monitoring
          - No attention tracking
          - No screen activity monitoring
          - No speaking time tracking
```

### 4. **Meeting Session Management** ❌
```
REQUIRED: Hide meeting from session list during live session
MEETINGBOT: No built-in session management UI
          - You'd need to build this yourself
```

---

## 🔧 What Would Need CUSTOMIZATION

### **Architecture Overview**
```
┌─────────────────────────────────────────────────────────┐
│                  Your Application                        │
│  (Calendar Page + Frontend UI)                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─ Create Meeting API Call
                 │
┌────────────────▼────────────────────────────────────────┐
│             MeetingBot API Server                        │
│  - REST API for bot management                          │
│  - PostgreSQL database                                   │
│  - Bot deployment orchestration                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─ Deploy Bot to AWS ECS
                 │
┌────────────────▼────────────────────────────────────────┐
│          Bot Container (on AWS ECS)                      │
│  - Joins meeting via Puppeteer                          │
│  - Records audio/video with FFmpeg                      │
│  - Uploads to S3                                        │
│  - Sends heartbeat & status updates                     │
└─────────────────────────────────────────────────────────┘
```

### **Required Customizations**

#### 1. **Extend Bot Code for Detailed Tracking**
```typescript
// FILE: src/bots/meet/src/bot.ts (Google Meet Bot)
// CURRENT: Basic participant tracking
participants: Participant[] = [];

// NEED TO ADD:
interface DetailedParticipant {
  name: string;
  email: string;
  joinTime: Date;
  leaveTime: Date | null;
  rejoinTimes: Date[];
  screenOnDurations: { start: Date; end: Date }[];
  audioOnDurations: { start: Date; end: Date }[];
  totalDuration: number;
  engagementScore: number;
}

// NEED TO IMPLEMENT:
- Monitor DOM for screen share indicators
- Monitor audio status icons for each participant
- Calculate durations in real-time
- Store detailed tracking data
```

#### 2. **Add Transcription & MOM Generation**
```typescript
// REQUIRED: Integrate Speech-to-Text API
// Options:
// - Google Cloud Speech-to-Text
// - AWS Transcribe
// - OpenAI Whisper
// - AssemblyAI

// NEED TO ADD:
interface MinutesOfMeeting {
  meetingId: string;
  participants: DetailedParticipant[];
  transcription: string;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  generatedAt: Date;
}

// IMPLEMENTATION:
1. Send recording to transcription service
2. Use AI (GPT-4, Claude) to generate summary
3. Extract action items and key decisions
4. Store MOM in database
```

#### 3. **Database Schema Extensions**
```sql
-- NEED TO ADD NEW TABLES:

CREATE TABLE participant_tracking (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id),
  participant_email VARCHAR(255),
  participant_name VARCHAR(255),
  join_time TIMESTAMP,
  leave_time TIMESTAMP,
  rejoin_times TIMESTAMP[],
  screen_on_periods JSONB,
  audio_on_periods JSONB,
  total_duration INTEGER,
  engagement_score FLOAT
);

CREATE TABLE minutes_of_meeting (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES bots(id),
  transcription TEXT,
  summary TEXT,
  key_points TEXT[],
  action_items JSONB,
  generated_at TIMESTAMP
);
```

#### 4. **API Endpoints to Add**
```typescript
// NEED TO IMPLEMENT:

// Get detailed participant tracking
GET /api/meetings/:id/participants/detailed

// Get Minutes of Meeting
GET /api/meetings/:id/mom

// Real-time participant updates (WebSocket)
WS /api/meetings/:id/live-updates

// Generate MOM from recording
POST /api/meetings/:id/generate-mom
```

---

## 🚫 Google Meet & Zoom API Limitations

### **IMPORTANT: MeetingBot Uses Browser Automation (Puppeteer)**

MeetingBot **DOES NOT** use official Google Meet or Zoom APIs. Instead:

```typescript
// From meet/src/bot.ts - Browser automation approach
import { chromium } from 'playwright';

// Bot launches actual Chrome browser
this.browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream']
});

// Bot navigates to meeting URL like a real user
await this.page.goto(meetingURL);
```

### **Why This Matters:**

#### ✅ **ADVANTAGES:**
1. **No Enterprise Requirements**
   - ❌ Don't need Google Workspace Enterprise
   - ❌ Don't need Zoom Pro/Business account
   - ❌ Don't need special API permissions
   - ✅ Works with ANY meeting link

2. **No Complex OAuth**
   - No Google API setup
   - No Zoom App creation
   - No webhook configuration

3. **Platform Independent**
   - Same approach works for Google Meet, Zoom, Teams
   - No platform-specific API learning curve

#### ⚠️ **LIMITATIONS:**
1. **UI-Dependent**
   - If Google Meet/Zoom changes UI, bot breaks
   - Requires maintenance when platforms update

2. **Limited Participant Data**
   - Can only see what's visible in the UI
   - Cannot access platform APIs for rich data

3. **Resource Intensive**
   - Each bot runs a full Chrome browser
   - Higher AWS costs per meeting

4. **Detection Risk**
   - Platforms may detect and block bots
   - Potential Terms of Service concerns

---

## 💰 Cost Estimation (AWS)

Based on MeetingBot's infrastructure:

```
Per Meeting Bot:
- ECS Fargate Task: $0.04048 per vCPU per hour
- Memory: $0.004445 per GB per hour
- Typical bot: 1 vCPU, 2GB RAM
- Cost: ~$0.05/hour

1-hour meeting = $0.05
10 meetings/day = $0.50/day = $15/month
100 meetings/day = $5/day = $150/month

Storage (S3):
- Recording: ~100MB per hour
- $0.023 per GB/month
- 100 hours/month = 10GB = $0.23/month

Total for 100 meetings/month:
- Compute: $150
- Storage: $0.23
- Data transfer: ~$5
- PostgreSQL RDS: ~$15
- TOTAL: ~$170/month
```

---

## 📋 Implementation Roadmap

### **Phase 1: Deploy Basic MeetingBot (2-3 weeks)**
1. Set up AWS infrastructure with Terraform
2. Deploy MeetingBot server
3. Test basic meeting recording
4. Integrate with your calendar page

### **Phase 2: Add Detailed Tracking (3-4 weeks)**
1. Extend bot code to track join/leave times
2. Add screen/audio status monitoring
3. Implement duration calculations
4. Create new database tables
5. Build API endpoints

### **Phase 3: Add Transcription & MOM (2-3 weeks)**
1. Integrate transcription service (Whisper/AssemblyAI)
2. Add AI summarization (OpenAI GPT-4)
3. Build MOM generation pipeline
4. Create MOM viewing UI

### **Phase 4: Real-Time Features (2 weeks)**
1. Add WebSocket support
2. Implement live participant updates
3. Build real-time dashboard

### **Phase 5: Testing & Polish (1-2 weeks)**
1. End-to-end testing
2. Bug fixes
3. Documentation
4. Performance optimization

**TOTAL ESTIMATED TIME: 10-14 weeks**

---

## 🎯 Recommendation

### **Option A: Use MeetingBot with Custom Extensions** ⭐ RECOMMENDED
**PROS:**
- ✅ No Google Workspace Enterprise needed
- ✅ Works with any meeting link
- ✅ Self-hosted = data privacy
- ✅ Active open-source community
- ✅ Good documentation

**CONS:**
- ❌ Requires significant customization
- ❌ 3-4 months development time
- ❌ Ongoing maintenance for UI changes
- ❌ AWS infrastructure costs

**BEST FOR:** 
- If you need full control and privacy
- If you have development resources
- If you can't use official APIs

### **Option B: Use Commercial Services**
Consider services like **Recall.ai** (sponsored by MeetingBot):
- ✅ Fully managed API
- ✅ Built-in transcription
- ✅ Better participant tracking
- ❌ Costs $$$
- ❌ Less control

### **Option C: Build Custom Solution**
- Start from scratch with official APIs
- More reliable but requires Enterprise accounts
- Better data access but complex setup

---

## 🔑 Key Takeaway

**MeetingBot provides 40-50% of what you need:**
- ✅ Meeting joining & recording
- ✅ Basic participant tracking  
- ✅ Infrastructure & deployment
- ❌ Detailed engagement metrics
- ❌ Transcription & MOM
- ❌ Real-time UI integration

**You WILL need to customize MeetingBot** to meet all your requirements, but it gives you a **solid foundation** to build upon without needing Google Workspace Enterprise or complex Zoom API setup.

**Estimated effort: 10-14 weeks of development**

---

## 📞 Next Steps

1. **Test MeetingBot locally** with a demo meeting
2. **Evaluate customization complexity** for your specific needs
3. **Compare with commercial alternatives** (Recall.ai, Fireflies.ai)
4. **Decide on approach** based on budget, timeline, and requirements
5. **Start with MVP**: Basic recording → Add tracking → Add MOM generation

---

**Last Updated:** October 21, 2025
**MeetingBot Version:** Latest (main branch)
**Repository:** https://github.com/meetingbot/meetingbot
