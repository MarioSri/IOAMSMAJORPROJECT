# Real-Time Emergency Contacts Integration

## Overview
This implementation adds real-time Supabase data integration to the Emergency Contacts section on the Emergency Management page. The contacts are fetched directly from the existing `role_recipients` table and automatically update when changes occur in the Supabase database, without requiring page refreshes.

## What Was Changed

### 1. Custom React Hook (`src/hooks/useEmergencyContacts.ts`)
Created a reusable hook that:
- Fetches emergency contacts from the **existing `role_recipients` table** (no new table needed!)
- Subscribes to real-time changes (INSERT, UPDATE, DELETE)
- Automatically updates the UI when data changes
- Handles loading and error states
- Sorts contacts by role priority (Principal → Registrar → HOD → etc.)

**Key Features:**
- Queries only **active recipients** (`is_active = true`)
- All active recipients are shown as "Available" by default
- Uses role-based priority ordering
- Leverages existing recipient data (no data duplication)

**Usage:**
```typescript
const { contacts, loading, error } = useEmergencyContacts();
```

### 2. Real-Time Migration (`supabase/migrations/20260318_enable_realtime_role_recipients.sql`)
- Enables real-time subscriptions for the `role_recipients` table
- Safe to run multiple times (idempotent)
- Required for live updates to work

### 3. Updated Emergency Workflow Interface
Modified `src/components/emergency/EmergencyWorkflowInterface.tsx` to:
- Import and use the `useEmergencyContacts` hook
- Replace static contact data with live Supabase data
- Display loading spinner during data fetch
- Show error message if fetch fails
- Display "No contacts available" when list is empty
- Maintain the existing UI layout without changes

## Setup Instructions

### Step 1: Enable Real-time for role_recipients
1. Log into your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the migration file:
   ```
   supabase/migrations/20260318_enable_realtime_role_recipients.sql
   ```
4. Copy and paste the SQL content
5. Click **Run** to execute the migration

**OR** manually enable via Dashboard:
1. Go to **Database** → **Replication**
2. Find `role_recipients` table
3. Toggle **Enable Replication** if not already enabled

### Step 2: Verify the Table
1. Go to **Table Editor** in Supabase
2. Open the `role_recipients` table
3. You should see your existing recipients with phone numbers
4. Verify `is_active = true` for contacts you want to display

### Step 3: Test the Integration
1. Navigate to the Emergency Management page in your application
2. Scroll to the **Emergency Contacts** section
3. Verify contacts are loaded from Supabase
4. Test real-time updates:
   - Open Supabase Table Editor
   - Update a contact's phone number or name:
     ```sql
     UPDATE role_recipients
     SET phone = '+91-9999999999'
     WHERE email = 'principal@hitam.org';
     ```
   - Watch the UI update automatically without refresh

## Real-Time Features

### Automatic Updates
The implementation automatically handles:
- **INSERT**: New recipients appear instantly in the contacts list
- **UPDATE**: Changes to name, phone, role, etc. reflect immediately
- **DELETE**: Removed recipients disappear from the UI

### Performance Optimizations
- Contacts are sorted by role priority for consistent ordering
- Duplicate prevention in real-time updates
- Efficient filtering (only active contacts shown)
- Indexed database queries for fast lookups

## Role Priority Order

Contacts are displayed in this order:
1. **Principal** (highest priority)
2. **Registrar**
3. **HOD** (Head of Department)
4. **Program Department Head**
5. **Employee**
6. **Security Head**
7. **Medical Officer**

You can customize this order by editing the `ROLE_PRIORITY` object in `useEmergencyContacts.ts`.

## Managing Emergency Contacts

### Adding New Contacts (via Supabase Dashboard)
```sql
INSERT INTO role_recipients (name, email, role, phone, department, is_active)
VALUES
  ('Dr. John Smith', 'dean@hitam.org', 'Security Head', '+91-9876543220', 'Security', TRUE);
```

### Updating Contact Phone
```sql
UPDATE role_recipients
SET phone = '+91-9999999999'
WHERE email = 'principal@hitam.org';
```

### Deactivating a Contact (Won't show in emergency list)
```sql
UPDATE role_recipients
SET is_active = FALSE
WHERE email = 'employee@hitam.org';
```

### Changing Role Priority
Edit the `ROLE_PRIORITY` mapping in `src/hooks/useEmergencyContacts.ts`:
```typescript
const ROLE_PRIORITY: Record<string, number> = {
  'Principal': 1,
  'Security Head': 2,  // Move Security Head higher
  'Registrar': 3,
  // ... etc
};
```

## Current Emergency Contacts (from your data)

Based on your `role_recipients` table:

| Name | Role | Phone | Email | Department |
|------|------|-------|-------|------------|
| Dr. S. Srinivasa Rao | Principal | +91-9876543211 | 22e51a6917@hitam.org | Administration |
| Mr. A. Ramesh | Registrar | +91-9876543213 | registrar@hitam.org | Mechanical Engineering |
| Dr. B. Venkateswara Rao | HOD | +91-9876543215 | hod.cse@hitam.org | Computer Science |
| Dr. C. Priyanka | Program Department Head | +91-9876543210 | programhead.cse@hitam.org | Computer Science |
| Mr. D. Naresh Kumar | Employee | +91-9876543214 | employee@hitam.org | Electrical Engineering |

## Advantages of Using role_recipients

✅ **No Data Duplication** - Uses existing recipient data
✅ **Always In Sync** - Changes to recipients automatically reflect in emergency contacts
✅ **Centralized Management** - One table for all recipient data
✅ **Future-Proof** - Easy to add availability status or other fields later
✅ **Simplified Maintenance** - No need to manage separate contact lists

## Adding Availability Status (Optional Enhancement)

If you want to track actual availability (online/offline), add a column:

```sql
ALTER TABLE role_recipients
ADD COLUMN available BOOLEAN DEFAULT TRUE;
```

Then update the hook to use this field instead of defaulting to `true`.

## Troubleshooting

### Contacts Not Appearing
1. **Check Supabase connection:**
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
2. **Check RLS policies:**
   - Ensure policies allow SELECT operations on `role_recipients`
3. **Check browser console:**
   - Look for Supabase errors or RLS policy violations
4. **Verify phone numbers:**
   - Ensure recipients have phone numbers in the database

### Real-Time Not Working
1. **Check Realtime status:**
   - Database → Replication → Verify `role_recipients` is enabled
2. **Check subscription:**
   - Browser console should show subscription status
3. **Check network:**
   - Supabase uses WebSockets for real-time
4. **Run the migration:**
   - Make sure you ran `20260318_enable_realtime_role_recipients.sql`

### Loading State Stuck
1. **Check network requests:**
   - Open DevTools → Network tab
   - Look for failed Supabase requests
2. **Check error state:**
   - The UI will display error messages if fetch fails
3. **Check table name:**
   - Ensure `role_recipients` table exists in Supabase

## API Reference

### EmergencyContact Interface
```typescript
interface EmergencyContact {
  id: string;              // UUID from role_recipients
  name: string;            // Contact name
  role: string;            // Contact role
  phone: string;           // Phone number (or 'N/A' if missing)
  email?: string;          // Email address
  available: boolean;      // Always true for active recipients
  department?: string;     // Department affiliation
  designation?: string;    // Job designation
  is_active: boolean;      // Active status
}
```

### useEmergencyContacts Hook
```typescript
const {
  contacts,    // EmergencyContact[] - Array of contacts
  loading,     // boolean - Loading state
  error        // string | null - Error message
} = useEmergencyContacts();
```

## Testing Checklist

- [ ] Migration runs successfully in Supabase
- [ ] Real-time is enabled for `role_recipients` table
- [ ] Emergency page loads without errors
- [ ] Contacts display correctly in UI
- [ ] Loading spinner appears during fetch
- [ ] Phone numbers display correctly
- [ ] Adding a recipient in Supabase updates UI instantly
- [ ] Updating a recipient in Supabase updates UI instantly
- [ ] Setting `is_active = false` removes contact from UI
- [ ] No duplicate contacts appear
- [ ] Contacts are sorted by role priority
- [ ] Layout matches original design

## Summary

✅ **Completed:**
- Modified `useEmergencyContacts` hook to use `role_recipients` table
- Created real-time enablement migration
- Integrated real-time data into Emergency Management page
- Preserved existing UI/UX design
- Added loading and error handling
- Uses existing recipient data (no duplication)

🎯 **Benefits:**
- Live updates without page refresh
- Leverages existing `role_recipients` table
- Centralized recipient management
- Scalable architecture
- Improved user experience with instant updates
- No data duplication or sync issues

---

**Created:** March 18, 2026
**Author:** Claude Code
**Version:** 2.0 (Updated to use role_recipients table)
