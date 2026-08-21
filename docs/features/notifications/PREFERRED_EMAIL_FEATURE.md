# Preferred Email Notification Feature

## Overview
This feature allows users to set a preferred email address for receiving notifications, separate from their default Google account email. The email is stored in the frontend state and synchronized with Supabase in real-time.

## Implementation Details

### 1. Custom Hook: `usePreferredEmail`
**Location:** `src/hooks/usePreferredEmail.ts`

A reusable hook that manages preferred email state and Supabase synchronization:

- **State Management:**
  - `preferredEmail`: Current preferred email value
  - `loading`: Initial fetch state
  - `saving`: Save/update operation state

- **Functions:**
  - `updatePreferredEmail(email: string)`: Updates or removes the preferred email in Supabase
  - `removePreferredEmail()`: Clears the preferred email (sets to null)
  - `setPreferredEmail(email: string)`: Updates local state only

- **Features:**
  - Automatic fetching on mount
  - Real-time Supabase synchronization
  - Optimistic UI updates
  - Error handling

### 2. Database Schema
**Table:** `role_recipients`
**Column:** `preferred_notification_email` (nullable string)

The preferred email is stored in the `role_recipients` table, linked to users via `supabase_uid`.

### 3. UI Components

#### Profile Page (`src/pages/Profile.tsx`)
- Displays preferred email input in the Preferences tab
- Shows "Save" button (enabled only when email changes)
- Shows "Remove" button (× icon) when email exists
- Provides user feedback via toast notifications
- Tracks changes to enable/disable save button

#### NotificationPreferences Component (`src/components/notifications/NotificationPreferences.tsx`)
- Embedded preferred email management
- Only visible when email notifications are enabled
- Same save/remove functionality as Profile page

### 4. Key Features

✅ **Real-time Supabase Sync:** Changes are immediately saved to the database
✅ **Add Email:** Users can set a preferred notification email
✅ **Update Email:** Changes are tracked and saved on button click
✅ **Remove Email:** Users can clear the preferred email to use default
✅ **Change Detection:** Save button only enabled when email changes
✅ **User Feedback:** Toast notifications for success/error states
✅ **Consistent State:** Frontend and Supabase remain synchronized

### 5. User Flow

1. **Adding Email:**
   - User types email in input field
   - Save button becomes enabled
   - Click "Save" → Email saved to Supabase
   - Toast confirms success

2. **Updating Email:**
   - User modifies existing email
   - Save button becomes enabled
   - Click "Save" → Updated email saved to Supabase
   - Toast confirms success

3. **Removing Email:**
   - User clicks "×" button
   - Email cleared from Supabase (set to null)
   - Input field cleared
   - Toast confirms removal
   - System falls back to default email

### 6. Technical Implementation

```typescript
// Hook usage example
const { 
  preferredEmail,           // Current email value
  saving,                   // Loading state
  updatePreferredEmail,     // Save function
  removePreferredEmail,     // Remove function
  setPreferredEmail         // Local state setter
} = usePreferredEmail();

// Update email
await updatePreferredEmail('user@example.com');

// Remove email
await removePreferredEmail();
```

### 7. Error Handling

- Network errors are caught and logged
- User receives error toast on failure
- State reverts on failed operations
- Graceful handling of missing user data

### 8. Benefits

- **Centralized Logic:** Single hook manages all preferred email operations
- **Reusable:** Can be used in any component
- **Type-Safe:** Full TypeScript support
- **Optimized:** Minimal re-renders with proper memoization
- **User-Friendly:** Clear feedback and intuitive UI

## Files Modified/Created

### Created:
- `src/hooks/usePreferredEmail.ts` - Custom hook for preferred email management

### Modified:
- `src/pages/Profile.tsx` - Added preferred email UI and logic
- `src/components/notifications/NotificationPreferences.tsx` - Added preferred email section
- `src/hooks/index.ts` - Exported new hook

## Testing Checklist

- [ ] Add preferred email and verify it saves to Supabase
- [ ] Update existing email and verify changes persist
- [ ] Remove email and verify it clears from Supabase
- [ ] Verify save button only enables when email changes
- [ ] Test with empty/whitespace-only input
- [ ] Verify toast notifications appear correctly
- [ ] Test error handling (disconnect network)
- [ ] Verify default email is used when preferred email is removed
