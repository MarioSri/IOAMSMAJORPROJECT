# Emergency Management - Supabase Real-Time Integration

## Overview
Emergency Management page is now fully connected to Supabase as the primary database with real-time synchronization. localStorage is downgraded to a cache-only layer.

## Architecture

### Data Flow
```
User Action → Supabase (Primary DB) → Real-time Subscription → UI Update
                    ↓
              localStorage (Cache Only)
```

### Key Components

1. **Supabase Tables**
   - `emergency_documents` - Main emergency document storage
   - `emergency_notifications` - Notification tracking
   - `emergency_notification_settings` - Notification preferences
   - `emergency_escalations` - Escalation tracking

2. **Services**
   - `SupabaseEmergencyService` - Database operations and real-time subscriptions
   - `useSupabaseEmergency` - React hook for emergency management

3. **Real-time Features**
   - Automatic UI updates when documents are created/updated/deleted
   - Cross-user synchronization
   - Cross-device synchronization
   - Notification delivery tracking

## Setup Instructions

### 1. Run Migration
Execute the migration in Supabase SQL Editor:
```bash
supabase/migrations/20240132_emergency_management.sql
```

### 2. Verify Tables
Check that all tables are created:
- emergency_documents
- emergency_notifications
- emergency_notification_settings
- emergency_escalations

### 3. Enable Realtime
Ensure Realtime is enabled for all tables (migration handles this automatically).

### 4. Configure Environment
Ensure `.env` has Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Features

### ✅ Implemented

1. **Real-time Document Creation**
   - Documents are created in Supabase
   - All connected users see updates instantly
   - localStorage caches for offline fallback

2. **Real-time Updates**
   - Status changes propagate immediately
   - Escalation tracking updates in real-time
   - Notification delivery tracking

3. **Statistics Dashboard**
   - Active emergencies count
   - Average response time
   - Resolved documents count
   - Response rate percentage

4. **Cache Layer**
   - localStorage stores last 50 documents
   - Automatic cache sync on Supabase updates
   - Fallback to cache if Supabase unavailable

5. **Role-Based Access**
   - RLS policies control data access
   - User-specific document filtering
   - Recipient-based notifications

### 🔄 Data Synchronization

**Create Flow:**
```typescript
1. User submits emergency
2. Data saved to Supabase
3. Real-time event triggers
4. UI updates automatically
5. Cache synced to localStorage
```

**Update Flow:**
```typescript
1. Document status changes
2. Supabase updated
3. Real-time subscription fires
4. All connected UIs update
5. Cache refreshed
```

### 📊 Statistics Calculation

Statistics are calculated from Supabase data:
- **Active**: `status = 'submitted'`
- **Resolved**: `status = 'resolved'`
- **Avg Response Time**: Calculated from response_time field
- **Response Rate**: `(resolved / total) * 100`

## API Reference

### useSupabaseEmergency Hook

```typescript
const {
  documents,           // Array of emergency documents
  notifications,       // Array of notifications
  isLoading,          // Loading state
  error,              // Error message
  createDocument,     // Create new emergency
  updateDocument,     // Update existing emergency
  deleteDocument,     // Delete emergency
  createNotification, // Send notification
  loadDocuments,      // Refresh documents
  loadNotifications,  // Refresh notifications
  getStatistics       // Get dashboard stats
} = useSupabaseEmergency();
```

### Creating Emergency Document

```typescript
const result = await createDocument({
  title: 'Emergency Title',
  description: 'Emergency description',
  urgency_level: 'critical',
  submitter_id: user.id,
  submitter_name: user.name,
  recipients: ['recipient-1', 'recipient-2'],
  auto_escalation: true,
  escalation_timeout: 24,
  escalation_time_unit: 'hours'
});

if (result.success) {
  console.log('Created:', result.data);
}
```

### Updating Document Status

```typescript
await updateDocument(documentId, {
  status: 'resolved',
  escalation_stopped: true
});
```

## Real-time Subscriptions

### Document Changes
```typescript
supabaseEmergencyService.subscribeToEmergencyDocuments((payload) => {
  if (payload.eventType === 'INSERT') {
    // New document created
  } else if (payload.eventType === 'UPDATE') {
    // Document updated
  } else if (payload.eventType === 'DELETE') {
    // Document deleted
  }
});
```

### Notifications
```typescript
supabaseEmergencyService.subscribeToNotifications(userId, (payload) => {
  // New notification received
});
```

## Cache Management

### Sync to Cache
```typescript
await supabaseEmergencyService.syncToCache(document);
```

### Get from Cache
```typescript
const cached = supabaseEmergencyService.getFromCache();
```

### Clear Cache
```typescript
supabaseEmergencyService.clearCache();
```

## UI Components

### Emergency Statistics
- Real-time dashboard metrics
- Auto-updates from Supabase
- No manual refresh needed

### Emergency Form
- Creates documents in Supabase
- Real-time validation
- File upload support

### Document List
- Real-time updates
- Automatic sorting
- Status indicators

## Security

### Row Level Security (RLS)
All tables have RLS enabled with permissive policies. Customize based on your auth setup:

```sql
-- Example: Restrict to submitter and recipients
CREATE POLICY "Users can view own documents" 
ON emergency_documents FOR SELECT 
USING (
  auth.uid()::text = submitter_id 
  OR auth.uid()::text = ANY(recipients)
);
```

### Data Validation
- Input sanitization
- File size limits
- Type checking
- Required field validation

## Performance

### Optimizations
- Indexed queries for fast retrieval
- Pagination support (50 documents per page)
- Efficient real-time subscriptions
- Minimal localStorage usage

### Monitoring
- Console logs for debugging
- Error tracking
- Performance metrics

## Troubleshooting

### Documents Not Appearing
1. Check Supabase connection
2. Verify RLS policies
3. Check browser console for errors
4. Verify real-time subscription status

### Real-time Not Working
1. Ensure Realtime is enabled in Supabase
2. Check subscription setup
3. Verify network connectivity
4. Check browser console for WebSocket errors

### Cache Issues
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Check cache size limits

## Migration from localStorage

### Before (localStorage Only)
```typescript
const docs = JSON.parse(localStorage.getItem('emergency-submissions') || '[]');
docs.unshift(newDoc);
localStorage.setItem('emergency-submissions', JSON.stringify(docs));
```

### After (Supabase Primary)
```typescript
const result = await emergencyService.createDocument(newDoc);
// Real-time subscription handles UI update
// Cache synced automatically
```

## Testing

### Test Real-time Sync
1. Open Emergency page in two browser tabs
2. Create emergency in tab 1
3. Verify it appears in tab 2 instantly

### Test Offline Fallback
1. Disconnect network
2. Check if cached data loads
3. Reconnect and verify sync

### Test Statistics
1. Create emergency documents
2. Verify statistics update in real-time
3. Change document status
4. Verify statistics recalculate

## Best Practices

1. **Always use emergencyService for data operations**
   - Don't write directly to localStorage
   - Use Supabase as source of truth

2. **Handle errors gracefully**
   - Show user-friendly messages
   - Fallback to cache when needed

3. **Optimize file uploads**
   - Compress large files
   - Use appropriate file formats
   - Limit file sizes

4. **Monitor performance**
   - Check real-time subscription health
   - Monitor database query performance
   - Track cache hit rates

## Future Enhancements

- [ ] Offline mode with sync queue
- [ ] Advanced filtering and search
- [ ] Export to PDF/Excel
- [ ] Email notifications integration
- [ ] SMS notifications integration
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] Document versioning
- [ ] Audit trail

## Support

For issues or questions:
1. Check console logs
2. Verify Supabase connection
3. Review RLS policies
4. Check real-time subscription status

## Changelog

### v1.0.0 (Current)
- ✅ Supabase integration complete
- ✅ Real-time subscriptions active
- ✅ localStorage downgraded to cache
- ✅ Statistics dashboard connected
- ✅ Document CRUD operations
- ✅ Notification system
- ✅ Escalation tracking
