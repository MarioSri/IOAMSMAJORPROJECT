# Recent Documents Widget - Verification Checklist

## ✅ Pre-Deployment Verification

### 1. Database Setup
- [ ] Supabase tables exist: `documents`, `document_workflows`, `workflow_steps`
- [ ] Realtime enabled on all tables
- [ ] RLS policies configured
- [ ] Indexes created for performance

### 2. Code Integration
- [ ] `useSupabaseRecentDocuments.ts` hook created
- [ ] `DocumentsWidget.tsx` updated to use hook
- [ ] No localStorage writes for business data
- [ ] No hard-coded mock data
- [ ] Real-time subscriptions active

### 3. Functional Tests

#### Basic Functionality
- [ ] Widget loads on Dashboard
- [ ] Documents display correctly
- [ ] Filter buttons work (All, Pending, Emergency)
- [ ] Click document navigates to Approval Center
- [ ] AI Summarizer opens

#### Real-Time Updates
- [ ] Create document in Approval Center → Appears in widget
- [ ] Approve document → Removed from widget
- [ ] Reject document → Removed from widget
- [ ] Update workflow step → Status updates

#### Multi-User Sync
- [ ] User A creates document → User B sees it
- [ ] User A approves → Removed from User B's widget
- [ ] Works across browser tabs
- [ ] Works across devices

#### Role-Based Access
- [ ] Principal sees documents for Principal
- [ ] Registrar sees documents for Registrar
- [ ] HOD sees documents for HOD
- [ ] Employee role handled correctly

#### Cache Fallback
- [ ] Disconnect network → Shows cached data
- [ ] Reconnect → Syncs with Supabase
- [ ] Cache expires after 5 minutes

### 4. Performance
- [ ] Initial load < 1 second
- [ ] Real-time updates < 500ms
- [ ] No console errors
- [ ] No memory leaks

### 5. UI/UX
- [ ] All UI elements visible
- [ ] Emergency documents highlighted
- [ ] Action Required badge shows
- [ ] Escalation level displays
- [ ] Responsive on mobile

## 🧪 Test Scenarios

### Scenario 1: Create and Approve
1. Login as Faculty
2. Create approval card in Approval Center
3. Verify appears in Dashboard widget
4. Login as Principal
5. Approve document
6. Verify removed from Dashboard widget

### Scenario 2: Multi-User Real-Time
1. Open two browsers (User A and User B)
2. User A creates document
3. Verify User B sees it instantly
4. User B approves
5. Verify removed from User A's widget

### Scenario 3: Emergency Document
1. Create emergency document
2. Verify red styling and pulse animation
3. Verify appears in Emergency filter
4. Verify "EMERGENCY" badge

### Scenario 4: Cache Fallback
1. Load Dashboard
2. Disconnect network
3. Refresh page
4. Verify cached documents display
5. Reconnect network
6. Verify syncs with Supabase

## 🐛 Known Issues
None

## 📊 Test Results
- Date Tested: ___________
- Tested By: ___________
- Environment: ___________
- Status: ___________

## ✅ Sign-Off
- [ ] All tests passed
- [ ] Documentation complete
- [ ] Ready for production

---

**Version:** 1.0.0
**Last Updated:** 2024-01-28
