# Phase 2: Supabase Integration Checklist

## Prerequisites
- [ ] Phase 1 completed (foundation utilities and components in place)
- [ ] Supabase account created at supabase.com
- [ ] Project created in Supabase dashboard

## Step 1: Install Dependencies

```bash
npm install @supabase/supabase-js
```

**Verification:**
- [ ] Package appears in package.json
- [ ] No installation errors

## Step 2: Configure Environment Variables

Add to `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Get credentials from:**
- Supabase Dashboard → Settings → API
- Copy "Project URL" and "anon public" key

**Verification:**
- [ ] .env file updated
- [ ] .env added to .gitignore (don't commit credentials!)
- [ ] Restart dev server to load new env vars

## Step 3: Create Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  branch TEXT,
  phone TEXT,
  employee_id TEXT,
  designation TEXT,
  bio TEXT,
  avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read
CREATE POLICY "Allow authenticated users to read users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow users to update their own profile
CREATE POLICY "Allow users to update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
```

**Verification:**
- [ ] Table created successfully
- [ ] Indexes created
- [ ] RLS enabled
- [ ] Policies created
- [ ] Check in Supabase Dashboard → Table Editor

## Step 4: Add Sample Users

Insert test users (replace with real data):

```sql
INSERT INTO users (name, email, role, department, branch, employee_id, designation, is_active)
VALUES
  ('Dr. Sarah Johnson', 'sarah.johnson@university.edu', 'Principal', 'Administration', 'Main Campus', 'EMP001', 'Principal', true),
  ('Dr. Michael Chen', 'michael.chen@university.edu', 'Registrar', 'Administration', 'Main Campus', 'EMP002', 'Registrar', true),
  ('Dr. Emily Rodriguez', 'emily.rodriguez@university.edu', 'HOD', 'Computer Science', 'Main Campus', 'EMP003', 'Head of Department', true),
  ('Prof. David Kim', 'david.kim@university.edu', 'Program Head', 'Computer Science', 'Main Campus', 'EMP004', 'Program Department Head', true),
  ('Alice Thompson', 'alice.thompson@university.edu', 'Employee', 'Computer Science', 'Main Campus', 'EMP005', 'Faculty', true);
```

**Verification:**
- [ ] Users inserted successfully
- [ ] Check in Table Editor
- [ ] At least one user per role type

## Step 5: Create Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
```

**Verification:**
- [ ] File created
- [ ] No TypeScript errors
- [ ] Client exports successfully

## Step 6: Update RecipientService

In `src/services/RecipientService.ts`, uncomment and update:

```typescript
import { supabase } from '@/lib/supabase';

async fetchRecipients(): Promise<Recipient[]> {
  if (!this.isConfigured()) {
    console.warn('⚠️ [RecipientService] Supabase not configured');
    return [];
  }

  try {
    console.log('🔄 [RecipientService] Fetching recipients from Supabase...');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    console.log('✅ [RecipientService] Fetched recipients:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ [RecipientService] Failed to fetch recipients:', error);
    throw new Error('Failed to fetch recipients from database');
  }
}
```

**Verification:**
- [ ] Code updated
- [ ] No TypeScript errors
- [ ] Imports correct

## Step 7: Update UserProfileService

In `src/services/UserProfileService.ts`, uncomment and update:

```typescript
import { supabase } from '@/lib/supabase';

async fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!this.isConfigured()) {
    console.warn('⚠️ [UserProfileService] Supabase not configured');
    return null;
  }

  try {
    console.log('🔄 [UserProfileService] Fetching profile for user:', userId);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ [UserProfileService] Profile not found for user:', userId);
        return null;
      }
      throw error;
    }

    console.log('✅ [UserProfileService] Profile fetched successfully');
    return data;

  } catch (error) {
    console.error('❌ [UserProfileService] Failed to fetch profile:', error);
    throw new Error('Failed to fetch user profile from database');
  }
}

async fetchProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!this.isConfigured()) {
    console.warn('⚠️ [UserProfileService] Supabase not configured');
    return null;
  }

  try {
    console.log('🔄 [UserProfileService] Fetching profile by email:', email);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ [UserProfileService] Profile not found for email:', email);
        return null;
      }
      throw error;
    }

    console.log('✅ [UserProfileService] Profile fetched successfully');
    return data;

  } catch (error) {
    console.error('❌ [UserProfileService] Failed to fetch profile by email:', error);
    throw new Error('Failed to fetch user profile from database');
  }
}
```

**Verification:**
- [ ] Code updated
- [ ] No TypeScript errors
- [ ] Imports correct

## Step 8: Test with Demo Work Role

1. Start dev server: `npm run dev`
2. Log in as Demo Work role
3. Check console logs
4. Verify:
   - [ ] Profile shows mock data
   - [ ] Dashboard shows mock name
   - [ ] RecipientSelector shows mock recipients
   - [ ] Demo badges visible
   - [ ] Console shows: "Data source: mock"

## Step 9: Test with Real Roles

### Test Principal Role
1. Log in as Principal
2. Check console logs
3. Verify:
   - [ ] Profile fetches from Supabase
   - [ ] Dashboard shows real name from database
   - [ ] RecipientSelector shows real recipients
   - [ ] No demo badges
   - [ ] Console shows: "Data source: real"
   - [ ] LiveDataIndicator appears

### Test Registrar Role
1. Log in as Registrar
2. Verify same as Principal

### Test HOD Role
1. Log in as HOD
2. Verify same as Principal

### Test Program Head Role
1. Log in as Program Head
2. Verify same as Principal

### Test Employee Role
1. Log in as Employee
2. Verify same as Principal

## Step 10: Test Error Scenarios

### No Internet Connection
1. Disconnect internet
2. Log in as real role
3. Verify:
   - [ ] Error message displays
   - [ ] "Profile data temporarily unavailable"
   - [ ] Retry button appears
   - [ ] No demo data shown
   - [ ] Console shows error

### User Not in Database
1. Log in with email not in users table
2. Verify:
   - [ ] Empty state displays
   - [ ] "Profile not configured" message
   - [ ] No crash or error
   - [ ] Console shows: "Data source: empty"

### Invalid Credentials
1. Remove Supabase credentials from .env
2. Restart server
3. Log in as real role
4. Verify:
   - [ ] Warning in console
   - [ ] Empty state displays
   - [ ] No crash

## Step 11: Verify localStorage

Open browser DevTools → Application → Local Storage:

**Should NOT contain:**
- [ ] 'user-profile'
- [ ] 'current-user'
- [ ] Any keys with identity data (name, email, role)

**Should contain (if set):**
- [ ] 'user-preferences-{userId}'
- [ ] 'notification-settings-{userId}'
- [ ] 'demo-work:*' keys (only when logged in as demo-work)
- [ ] 'real:*' keys (only when logged in as real role)

## Step 12: Final Verification

### Console Logs Check
Look for these patterns:
- [ ] "✅ [Profile] Data source: real - {name}"
- [ ] "✅ [RoleDashboard] Data source: real - {name}"
- [ ] "✅ [RecipientSelector] Data source: real - {count} recipients"
- [ ] "⚠️ [Profile] Data source: mock - Demo Work Role" (only for demo-work)

### Visual Check
- [ ] Demo Work: Amber badges everywhere
- [ ] Real Roles: Green "Live Data" badges (optional)
- [ ] No demo badges for real roles
- [ ] Error states are clear and actionable

### Data Integrity Check
- [ ] Profile data matches Supabase
- [ ] Dashboard name matches Supabase
- [ ] Recipients list matches Supabase
- [ ] No stale data from localStorage

## Troubleshooting

### "Supabase not configured" warning
- Check .env file has correct credentials
- Restart dev server after adding credentials
- Verify credentials are correct in Supabase dashboard

### "Failed to fetch" errors
- Check internet connection
- Verify Supabase project is active
- Check RLS policies allow reading
- Verify users table exists

### Empty recipients list
- Check users table has data
- Verify is_active = true for users
- Check RLS policies
- Look at console logs for errors

### TypeScript errors
- Run `npm install` to ensure dependencies installed
- Check imports are correct
- Verify types match database schema

## Success Criteria

Phase 2 is complete when:
- [ ] All real roles fetch from Supabase
- [ ] Demo Work role still shows mock data
- [ ] No identity data in localStorage
- [ ] Error states work correctly
- [ ] Console logs show correct data sources
- [ ] Visual indicators are consistent
- [ ] All tests pass

## Next Steps

After Phase 2 completion:
1. Add real users to Supabase (replace test data)
2. Implement Google OAuth integration
3. Add profile editing functionality (save to Supabase)
4. Set up real-time subscriptions for live updates
5. Add user management interface for admins

## Documentation

Update these files after completion:
- [ ] README.md with Supabase setup instructions
- [ ] DATA_FLOW_ARCHITECTURE.md with Phase 2 status
- [ ] Create PHASE2_IMPLEMENTATION_SUMMARY.md
