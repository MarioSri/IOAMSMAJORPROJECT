# Track Documents - Verification Checklist

## 🔍 Pre-Deployment Verification

Use this checklist to verify the Track Documents Supabase integration is working correctly before deploying to production.

---

## 1️⃣ Database Setup

### Supabase Configuration
- [ ] Supabase project created
- [ ] Environment variables set in `.env`:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Migration `20240134_document_management.sql` executed
- [ ] Tables exist:
  - [ ] `documents`
  - [ ] `document_files`
- [ ] Realtime enabled on `documents` table
- [ ] RLS policies configured and enabled

### Verify Database
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'document_files');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'documents';

-- Check Realtime publication
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'documents';
```

---

## 2️⃣ Code Integration

### Files Updated
- [ ] `src/hooks/useSupabaseTrackDocuments.ts` - Updated with real-time
- [ ] `src/hooks/useSupabaseDocuments.ts` - Updated with real-time
- [ ] `src/components/documents/DocumentTracker.tsx` - Integrated hooks
- [ ] `src/services/DocumentService.ts` - Cleaned up localStorage writes

### Import Verification
```typescript
// Verify these imports work
import { useSupabaseTrackDocuments } from '@/hooks/useSupabaseTrackDocuments';
import { useSupabaseDocuments } from '@/hooks/useSupabaseDocuments';
import { documentService } from '@/services/DocumentService';
```

---

## 3️⃣ Functional Testing

### Basic CRUD Operations

#### Create Document
- [ ] Open Track Documents page
- [ ] Click "Create Document" or submit form
- [ ] Verify document appears in list immediately
- [ ] Check Supabase dashboard - document exists in `documents` table
- [ ] Verify `submitter_id` matches current user
- [ ] Check localStorage cache updated

**Test Command:**
```typescript
const { createDocument } = useSupabaseTrackDocuments();
const result = await createDocument({
  title: 'Test Document',
  description: 'Test',
  type: 'Letter',
  priority: 'medium',
  submitter_id: user.id,
  submitter_name: user.name,
  files: [],
  recipients: []
});
console.log('Created:', result);
```

#### Read Documents
- [ ] Refresh page
- [ ] Verify all user's documents load
- [ ] Check loading state appears briefly
- [ ] Verify only current user's documents shown
- [ ] Check cache populated in localStorage

**Test Command:**
```typescript
const { trackDocuments, loading } = useSupabaseTrackDocuments();
console.log('Documents:', trackDocuments);
console.log('Loading:', loading);
```

#### Update Document
- [ ] Click on a document
- [ ] Update status or priority
- [ ] Verify UI updates immediately
- [ ] Check Supabase dashboard - changes reflected
- [ ] Verify cache updated

**Test Command:**
```typescript
const { updateDocument } = useSupabaseTrackDocuments();
const result = await updateDocument(documentId, {
  status: 'approved',
  priority: 'high'
});
console.log('Updated:', result);
```

#### Delete Document
- [ ] Click "Remove" on a document
- [ ] Verify document disappears from UI
- [ ] Check Supabase dashboard - document deleted
- [ ] Verify cache updated
- [ ] Check "Undo Remove" functionality

**Test Command:**
```typescript
const { deleteDocument } = useSupabaseTrackDocuments();
const result = await deleteDocument(documentId);
console.log('Deleted:', result);
```

---

## 4️⃣ Real-Time Testing

### Single Browser - Multiple Tabs
- [ ] Open Track Documents in Tab 1
- [ ] Open Track Documents in Tab 2
- [ ] Create document in Tab 1
- [ ] **Verify:** Document appears in Tab 2 within 1 second
- [ ] Update document in Tab 2
- [ ] **Verify:** Update appears in Tab 1 within 1 second
- [ ] Delete document in Tab 1
- [ ] **Verify:** Document disappears from Tab 2 within 1 second

### Multiple Browsers
- [ ] Open Track Documents in Chrome (User A)
- [ ] Open Track Documents in Firefox (User A, same account)
- [ ] Create document in Chrome
- [ ] **Verify:** Document appears in Firefox
- [ ] Update in Firefox
- [ ] **Verify:** Update appears in Chrome

### Multiple Users
- [ ] Login as User A in Browser 1
- [ ] Login as User B in Browser 2
- [ ] Create document as User A
- [ ] **Verify:** User B does NOT see User A's document
- [ ] Create document as User B
- [ ] **Verify:** User A does NOT see User B's document

---

## 5️⃣ Role-Based Access Testing

### Submitter Access
- [ ] Login as regular user
- [ ] Create a document
- [ ] **Verify:** Document appears in Track Documents
- [ ] **Verify:** Can view, update, delete own document
- [ ] Logout and login as different user
- [ ] **Verify:** Cannot see previous user's document

### RLS Policy Verification
```sql
-- Test as authenticated user
SELECT * FROM documents WHERE submitter_id = auth.uid();
-- Should return only user's documents

-- Try to access another user's document
SELECT * FROM documents WHERE submitter_id != auth.uid();
-- Should return empty (blocked by RLS)
```

---

## 6️⃣ Offline/Error Handling

### Network Disconnect
- [ ] Load Track Documents page (documents load)
- [ ] Disconnect network (airplane mode or dev tools)
- [ ] Refresh page
- [ ] **Verify:** Documents load from cache
- [ ] **Verify:** Error message shown (optional)
- [ ] Reconnect network
- [ ] **Verify:** Data syncs from Supabase

### Supabase Error Simulation
```typescript
// Temporarily break Supabase connection
const { trackDocuments, error } = useSupabaseTrackDocuments();
// Should fallback to cache
console.log('Error:', error);
console.log('Cache fallback:', trackDocuments);
```

### Cache Fallback
- [ ] Populate cache with test data
- [ ] Disconnect from Supabase
- [ ] Load page
- [ ] **Verify:** Cache data displayed
- [ ] **Verify:** Error state handled gracefully

---

## 7️⃣ Performance Testing

### Load Time
- [ ] Clear cache and reload page
- [ ] **Verify:** Initial load < 2 seconds
- [ ] **Verify:** Loading indicator appears
- [ ] **Verify:** Documents render smoothly

### Real-Time Latency
- [ ] Create document in Tab 1
- [ ] Measure time until appears in Tab 2
- [ ] **Target:** < 1 second
- [ ] **Acceptable:** < 3 seconds

### Large Dataset
- [ ] Create 50+ documents
- [ ] **Verify:** Page loads without lag
- [ ] **Verify:** Scroll is smooth
- [ ] **Verify:** Cache limited to 50 documents

---

## 8️⃣ UI Preservation

### All UI Components Work
- [ ] Search bar filters documents
- [ ] Status filter dropdown works
- [ ] Type filter dropdown works
- [ ] Document cards display correctly
- [ ] Workflow progress shows
- [ ] Status badges appear
- [ ] Priority indicators work
- [ ] View button opens file viewer
- [ ] Download button downloads files
- [ ] Remove button deletes document
- [ ] Undo Remove restores document

### No Visual Changes
- [ ] Layout matches original design
- [ ] Colors and styling unchanged
- [ ] Icons display correctly
- [ ] Responsive design works
- [ ] Mobile view functional

---

## 9️⃣ Integration Testing

### File Upload
- [ ] Create document with files
- [ ] **Verify:** Files stored in `document_files` table
- [ ] **Verify:** Google Drive integration works (if configured)
- [ ] **Verify:** File metadata correct

### Workflow Integration
- [ ] Create document with workflow
- [ ] **Verify:** Workflow steps tracked
- [ ] **Verify:** Progress updates correctly
- [ ] **Verify:** Status changes reflected

### Signature Integration
- [ ] Create document requiring signature
- [ ] Sign document
- [ ] **Verify:** Signature recorded
- [ ] **Verify:** Signed status updates

---

## 🔟 Security Testing

### Authentication
- [ ] Try accessing without login
- [ ] **Verify:** Redirected to login
- [ ] Login and access page
- [ ] **Verify:** Documents load

### Authorization
- [ ] Try to access another user's document via API
- [ ] **Verify:** RLS blocks access
- [ ] Try to update another user's document
- [ ] **Verify:** RLS blocks update
- [ ] Try to delete another user's document
- [ ] **Verify:** RLS blocks delete

### SQL Injection Prevention
```typescript
// Try malicious input
const result = await createDocument({
  title: "'; DROP TABLE documents; --",
  // ... other fields
});
// Should be safely escaped by Supabase
```

---

## 1️⃣1️⃣ Browser Compatibility

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] Chrome Mobile
- [ ] Safari iOS
- [ ] Firefox Mobile

---

## 1️⃣2️⃣ Console Verification

### No Errors
- [ ] Open browser console (F12)
- [ ] Load Track Documents page
- [ ] **Verify:** No red errors
- [ ] **Verify:** No warning about localStorage writes
- [ ] **Verify:** Real-time subscription logs appear

### Expected Logs
```
✅ Real-time update: { eventType: 'INSERT', ... }
✅ [DocumentTracker] Processing documents: X
✅ Cache write successful
```

### No Unexpected Logs
```
❌ localStorage.setItem('submitted-documents', ...)
❌ Failed to connect to Supabase
❌ RLS policy violation
```

---

## 1️⃣3️⃣ Documentation Review

### Files Created
- [ ] `TRACK_DOCUMENTS_SUPABASE_REALTIME.md` exists
- [ ] `MIGRATION_GUIDE_SUPABASE.md` exists
- [ ] `QUICK_REFERENCE_SUPABASE.md` exists
- [ ] `IMPLEMENTATION_SUMMARY.md` exists
- [ ] All documentation is accurate and up-to-date

---

## 1️⃣4️⃣ Deployment Readiness

### Pre-Deployment
- [ ] All tests passing
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete

### Deployment Steps
- [ ] Backup current database
- [ ] Run migrations on production
- [ ] Deploy code changes
- [ ] Verify environment variables
- [ ] Test in production

### Post-Deployment
- [ ] Monitor Supabase dashboard
- [ ] Check error logs
- [ ] Verify real-time connections
- [ ] Test with real users
- [ ] Monitor performance metrics

---

## ✅ Sign-Off

### Developer Checklist
- [ ] All code changes reviewed
- [ ] All tests passing
- [ ] Documentation complete
- [ ] No breaking changes
- [ ] Backward compatible

### QA Checklist
- [ ] Functional testing complete
- [ ] Real-time testing verified
- [ ] Security testing passed
- [ ] Performance acceptable
- [ ] UI/UX unchanged

### Product Owner Checklist
- [ ] Requirements met
- [ ] User experience preserved
- [ ] No regressions
- [ ] Ready for production

---

## 🚀 Final Verification

**Date:** _______________  
**Tested By:** _______________  
**Environment:** [ ] Development [ ] Staging [ ] Production  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

**Approved for Deployment:** [ ] YES [ ] NO  
**Signature:** _______________

---

## 📞 Support Contacts

**Technical Issues:**
- Check documentation in `docs/features/documents/`
- Review Supabase dashboard
- Check browser console logs

**Emergency Rollback:**
- Revert to `useRealTimeDocuments` hook
- Keep Supabase integration active
- Document issues for investigation

---

**Checklist Version:** 1.0.0  
**Last Updated:** 2024-01-24  
**Status:** Ready for Use
