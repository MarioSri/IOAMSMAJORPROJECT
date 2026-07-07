# Automatic Message and Channel Deletion Feature

## Overview
The Department Chat section in the Messages page now includes automatic cleanup functionality to maintain system efficiency and data hygiene. This feature automatically removes old messages and channels based on predefined time limits.

## Features

### 1. Automatic Message Deletion (24 Hours)
- **Trigger**: All messages in Department Chat channels are automatically deleted after 24 hours
- **Check Frequency**: The system checks and cleans up messages every hour
- **Implementation**: 
  - Messages are filtered based on their `timestamp` property
  - Only messages older than 24 hours from the current time are removed
  - Users receive a toast notification when messages are cleaned up

### 2. Automatic Channel Deletion (1 Week)
- **Trigger**: All channels in Department Chat are automatically deleted after 1 week (7 days)
- **Check Frequency**: The system checks and cleans up channels every 24 hours
- **Implementation**:
  - Channels are filtered based on their `createdAt` property
  - Only channels older than 7 days from the current time are removed
  - If the active channel is deleted, the system automatically switches to the first available channel
  - Users receive a toast notification when channels are cleaned up

## Technical Implementation

### Location
- **File**: `src/components/ChatInterface.tsx`
- **Functions**: 
  - `cleanupMessages()` - Handles message cleanup
  - `cleanupChannels()` - Handles channel cleanup

### Message Cleanup Logic
```typescript
const cleanupMessages = useCallback(() => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  setMessages(prev => {
    const filtered = prev.filter(message => {
      const messageTime = new Date(message.timestamp);
      return messageTime > twentyFourHoursAgo;
    });
    
    // Notify user if messages were deleted
    if (filtered.length !== prev.length) {
      console.log(`Auto-deleted ${prev.length - filtered.length} message(s) older than 24 hours`);
      toast({
        title: 'Messages Cleaned',
        description: `${prev.length - filtered.length} old message(s) automatically deleted`,
        variant: 'default'
      });
    }
    
    return filtered.length !== prev.length ? filtered : prev;
  });
}, [toast]);
```

### Channel Cleanup Logic
```typescript
const cleanupChannels = useCallback(() => {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  setChannels(prev => {
    const filtered = prev.filter(channel => {
      const channelCreationTime = new Date(channel.createdAt);
      return channelCreationTime > oneWeekAgo;
    });
    
    // Check if active channel was deleted
    if (activeChannel && !filtered.find(ch => ch.id === activeChannel.id)) {
      setActiveChannel(filtered.length > 0 ? filtered[0] : null);
    }
    
    // Notify user if channels were deleted
    if (filtered.length !== prev.length) {
      console.log(`Auto-deleted ${prev.length - filtered.length} channel(s) older than 1 week`);
      toast({
        title: 'Channels Cleaned',
        description: `${prev.length - filtered.length} old channel(s) automatically deleted`,
        variant: 'default'
      });
    }
    
    return filtered.length !== prev.length ? filtered : prev;
  });
}, [activeChannel, toast]);
```

### Cleanup Intervals
```typescript
// Message cleanup - runs every hour
useEffect(() => {
  const interval = setInterval(cleanupMessages, 60 * 60 * 1000);
  cleanupMessages(); // Initial cleanup
  return () => clearInterval(interval);
}, [cleanupMessages]);

// Channel cleanup - runs every 24 hours
useEffect(() => {
  const interval = setInterval(cleanupChannels, 24 * 60 * 60 * 1000);
  cleanupChannels(); // Initial cleanup
  return () => clearInterval(interval);
}, [cleanupChannels]);
```

## User Experience

### Notifications
- When messages are deleted, users see: **"Messages Cleaned"** with the count of deleted messages
- When channels are deleted, users see: **"Channels Cleaned"** with the count of deleted channels

### Active Channel Handling
- If the currently active channel is deleted during cleanup, the system automatically:
  1. Switches to the first available channel in the list
  2. If no channels remain, sets active channel to `null`
  3. Updates the UI accordingly

## Data Preservation

### Message Timestamps
- All messages include a `timestamp` property set when the message is created
- Format: JavaScript `Date` object
- Example: `new Date()` when message is sent

### Channel Creation Dates
- All channels include a `createdAt` property set when the channel is created
- Format: JavaScript `Date` object
- Example: `new Date()` when channel is created

## Benefits

1. **System Performance**: Reduces data storage and improves system performance
2. **Privacy**: Ensures sensitive information doesn't persist indefinitely
3. **Compliance**: Helps meet data retention policies
4. **Automatic**: Requires no manual intervention
5. **User-Friendly**: Provides clear notifications when cleanup occurs

## Configuration

### Modifying Time Limits

To change the deletion time limits, update these values in `ChatInterface.tsx`:

**For Messages (currently 24 hours):**
```typescript
const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
// Change 24 to desired hours
```

**For Channels (currently 7 days):**
```typescript
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
// Change 7 to desired days
```

### Modifying Check Intervals

**Message cleanup interval (currently 1 hour):**
```typescript
const interval = setInterval(cleanupMessages, 60 * 60 * 1000);
// Change 60 * 60 * 1000 to desired milliseconds
```

**Channel cleanup interval (currently 24 hours):**
```typescript
const interval = setInterval(cleanupChannels, 24 * 60 * 60 * 1000);
// Change 24 * 60 * 60 * 1000 to desired milliseconds
```

## Testing

### Manual Testing
1. Create a test channel
2. Send several messages in the channel
3. Manually adjust the system time or modify the cleanup thresholds temporarily
4. Verify messages older than 24 hours are deleted
5. Verify channels older than 1 week are deleted
6. Check that notifications appear correctly

### Developer Console
- Cleanup actions are logged to the browser console
- Look for messages like: `"Auto-deleted X message(s) older than 24 hours"`
- Look for messages like: `"Auto-deleted X channel(s) older than 1 week"`

## Future Enhancements

Potential improvements that could be added:
1. User-configurable retention periods
2. Archive feature before deletion
3. Selective preservation of important messages/channels
4. Export functionality before automatic deletion
5. Admin override capabilities
6. Exclude certain channels from auto-deletion (e.g., "General" or "Announcements")

## Support

For issues or questions regarding this feature:
- Check browser console for error messages
- Verify message and channel timestamps are being set correctly
- Ensure the component is properly mounted and cleanup intervals are running
- Review toast notifications for cleanup confirmations

---

**Implementation Date**: October 30, 2025
**Version**: 1.0
**Status**: Active
