# Recipient Data Migration: Mock to Real-Time

## Overview

This migration separates **Demo Work role** (mock data) from **Real roles** (Supabase data) to prevent confusion and ensure data integrity.

---

## ✅ What Was Done

### Phase 1 & 2: Mock Data Isolation
- ✅ Mock recipients now **ONLY** load for Demo Work role
- ✅ Real roles (Principal, Registrar, HOD, etc.) **NEVER** see mock data
- ✅ Added clear empty/loading/error states for real roles
- ✅ No silent fallback to mock data

### Phase 3: Real-Time Data Integration
- ✅ Created `RecipientService` for Supabase integration
- ✅ RecipientSelector fetches from Supabase for real roles
- ✅ Graceful error handling with user-friendly messages

### Phase 5: Storage Isolation
- ✅ Created `RoleScopedStorage` utility
- ✅ All storage keys now prefixed: `demo-work:` or `real:`
- ✅ Automatic migration of old unscoped keys
- ✅ Role-switch cleanup prevents contamination

---

## 🎯 Current Behavior

### Demo Work Role
```
Login as Demo Work
  ↓
Loads mock recipients (Dr. John Doe, etc.)
  ↓
Storage: demo-work:pending-approvals, demo-work:submitted-documents, etc.
  ↓
Demo workflows work independently
```

### Real Roles (Principal, Registrar, HOD, etc.)
```
Login as Real Role
  ↓
Fetches from Supabase
  ↓
If empty → Shows "No recipients available" message
If error → Shows error with retry button
If success → Shows real recipients
  ↓
Storage: real:pending-approvals, real:submitted-documents, etc.
  ↓
Real workflows isolated from demo
```

---

## 🔧 Supabase Setup (Required for Real Roles)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### Step 2: Create Users Table
Run this SQL in Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  branch TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access
CREATE POLICY "Allow read access to all users"
  ON users
  FOR SELECT
  USING (true);

-- Create policy to allow insert/update for authenticated users
CREATE POLICY "Allow insert for authenticated users"
  ON users
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users"
  ON users
  FOR UPDATE
  USING (auth.role() = 'authenticated');
```

### Step 3: Add Sample Real Users
```sql
-- Insert real users (replace with your actual data)
INSERT INTO users (name, email, role, department, branch, is_active) VALUES
  ('Dr. Rajesh Kumar', 'rajesh.kumar@university.edu', 'Principal', 'Administration', 'Main', true),
  ('Prof. Anita Sharma', 'anita.sharma@university.edu', 'Registrar', 'Administration', 'Main', true),
  ('Dr. Suresh Patel', 'suresh.patel@university.edu', 'HOD', 'Computer Science', 'Main', true),
  ('Prof. Priya Reddy', 'priya.reddy@university.edu', 'Program Department Head', 'Computer Science', 'Main', true),
  ('Mr. Amit Singh', 'amit.singh@university.edu', 'Employee', 'Computer Science', 'Main', true);
```

### Step 4: Configure Environment Variables
Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://lyyuslwdibcscpdfzeww.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 5: Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### Step 6: Update RecipientService
Edit `src/services/RecipientService.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Update fetchRecipients method:
async fetchRecipients(): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .order('role', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}
```

---

## 🧪 Testing Checklist

### Demo Work Role
- [ ] Login as Demo Work
- [ ] See mock recipients (Dr. John Doe, Dr. Jane Smith, etc.)
- [ ] Submit document → Stored in `demo-work:submitted-documents`
- [ ] Logout → Demo storage cleared
- [ ] Login again → Demo data reloads

### Real Roles (Before Supabase Setup)
- [ ] Login as Principal
- [ ] See "No recipients available" message
- [ ] No mock data shown
- [ ] Clear message to contact admin

### Real Roles (After Supabase Setup)
- [ ] Login as Principal
- [ ] See real recipients from database
- [ ] Submit document → Stored in `real:submitted-documents`
- [ ] Switch to Demo Work → Real data preserved
- [ ] Switch back to Principal → Real data still there

### Storage Isolation
- [ ] Login as Demo Work → Check localStorage for `demo-work:` keys
- [ ] Login as Principal → Check localStorage for `real:` keys
- [ ] No cross-contamination between scopes

---

## 📊 Storage Key Structure

### Before Migration (Old)
```
localStorage:
  'pending-approvals' → Mixed demo and real data ❌
  'submitted-documents' → Confusion about source ❌
```

### After Migration (New)
```
localStorage:
  'demo-work:pending-approvals' → Demo data only ✅
  'demo-work:submitted-documents' → Demo data only ✅
  'real:pending-approvals' → Real data only ✅
  'real:submitted-documents' → Real data only ✅
```

---

## 🚨 Important Notes

### No Silent Fallback
- Real roles will **NEVER** see mock data
- If Supabase fails → Error message shown
- If database empty → Empty state shown
- **Empty is better than incorrect**

### Data Source Indicator
- Demo Work role shows amber badge: "Demo Mode: Showing mock recipients"
- Real roles show no badge (normal operation)

### Migration Safety
- Old unscoped keys automatically migrated to `real:` scope on first login
- Demo storage never touches real storage
- Real storage never touches demo storage

---

## 🔍 Troubleshooting

### "No recipients available" for Real Roles
**Cause**: Supabase not configured or database empty  
**Solution**: 
1. Check `.env` file has correct Supabase credentials
2. Verify users table exists in Supabase
3. Add users to database using SQL above

### "Failed to load recipients from database"
**Cause**: Network error or Supabase connection issue  
**Solution**:
1. Check internet connection
2. Verify Supabase project is active
3. Check browser console for detailed error
4. Click "Retry" button

### Mock Data Appearing for Real Roles
**Cause**: Should not happen after migration  
**Solution**: 
1. Clear browser localStorage
2. Hard refresh (Ctrl+Shift+R)
3. Check console logs for role detection

---

## 📝 Files Modified

### Core Changes
- `src/components/approval/RecipientSelector.tsx` - Role-based data loading
- `src/contexts/AuthContext.tsx` - Storage cleanup on login/logout
- `src/services/RecipientService.ts` - Supabase integration (NEW)
- `src/utils/RoleScopedStorage.ts` - Storage isolation utility (NEW)

### Usage Locations
- `src/components/documents/DocumentUploader.tsx` - Document Management Recipients
- `src/components/emergency/EmergencyWorkflowInterface.tsx` - Emergency Management Recipients
- `src/components/workflow/WorkflowConfiguration.tsx` - Approval Chain with Bypass Recipients

---

## 🎓 For Developers

### Adding New Storage Keys
```typescript
import { roleScopedStorage, STORAGE_KEYS } from '@/utils/RoleScopedStorage';

// Save
roleScopedStorage.setItem(userRole, STORAGE_KEYS.MY_NEW_KEY, JSON.stringify(data));

// Load
const data = roleScopedStorage.getItem(userRole, STORAGE_KEYS.MY_NEW_KEY);
```

### Fetching Recipients in Components
```typescript
import { recipientService } from '@/services/RecipientService';

// Fetch all recipients
const recipients = await recipientService.fetchRecipients();

// Fetch by role
const hods = await recipientService.fetchRecipientsByRole('HOD');

// Search
const results = await recipientService.searchRecipients('kumar');
```

---

## ✅ Success Criteria

Migration is successful when:
1. ✅ Demo Work role sees mock data
2. ✅ Real roles see Supabase data (or empty state)
3. ✅ No cross-contamination between demo and real
4. ✅ Clear error messages when data unavailable
5. ✅ Storage keys properly scoped
6. ✅ No silent fallbacks to mock data

---

## 🆘 Support

If you encounter issues:
1. Check browser console for detailed logs
2. Verify Supabase setup is complete
3. Test with Demo Work role first (should always work)
4. Review this README for troubleshooting steps

---

**Last Updated**: Migration completed - Phases 1, 2, 3, and 5 implemented
**Status**: ✅ Ready for Supabase configuration
