# Quick Start Guide - Recipient Data Migration

## 🚀 For Developers: Get Started in 5 Minutes

### Current Status
✅ **Demo Work Role**: Works immediately (no setup needed)  
⏳ **Real Roles**: Requires Supabase setup (see below)

---

## Option 1: Test Demo Work Role (No Setup)

```bash
# 1. Start the app
npm run dev

# 2. Login as Demo Work role
# You'll see mock recipients immediately

# 3. Test features
# - Select recipients
# - Submit documents
# - Check storage keys (demo-work:*)
```

**Expected Behavior**:
- ✅ See mock recipients (Dr. John Doe, Dr. Jane Smith, etc.)
- ✅ Amber badge: "Demo Mode: Showing mock recipients"
- ✅ All features work with mock data

---

## Option 2: Setup Real Roles (5 Steps)

### Step 1: Create Supabase Project (2 min)
```bash
# 1. Go to https://supabase.com
# 2. Click "New Project"
# 3. Note your project URL and anon key
```

### Step 2: Create Database Table (1 min)
```sql
-- Copy and paste this into Supabase SQL Editor

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  branch TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access" ON users FOR SELECT USING (true);
```

### Step 3: Add Sample Users (1 min)
```sql
-- Add some test users

INSERT INTO users (name, email, role, department, branch) VALUES
  ('Dr. Rajesh Kumar', 'rajesh@university.edu', 'Principal', 'Administration', 'Main'),
  ('Prof. Anita Sharma', 'anita@university.edu', 'Registrar', 'Administration', 'Main'),
  ('Dr. Suresh Patel', 'suresh@university.edu', 'HOD', 'Computer Science', 'Main');
```

### Step 4: Configure Environment (30 sec)
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and add your Supabase credentials
VITE_SUPABASE_URL=https://lyyuslwdibcscpdfzeww.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 5: Install Supabase Client (30 sec)
```bash
npm install @supabase/supabase-js
```

### Step 6: Update RecipientService (30 sec)
Edit `src/services/RecipientService.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

// Add at top of file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Replace fetchRecipients method
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

### Step 7: Test Real Roles
```bash
# Restart dev server
npm run dev

# Login as Principal, Registrar, or HOD
# You should see real users from Supabase!
```

---

## 🧪 Quick Test Checklist

### Demo Work Role
```bash
✅ Login as Demo Work
✅ See mock recipients
✅ See amber "Demo Mode" badge
✅ Submit document
✅ Check localStorage for "demo-work:" keys
✅ Logout and login again - demo data reloads
```

### Real Roles (Before Supabase)
```bash
✅ Login as Principal
✅ See "No recipients available" message
✅ No mock data shown
✅ No amber badge
```

### Real Roles (After Supabase)
```bash
✅ Login as Principal
✅ See real users from database
✅ No amber badge (normal operation)
✅ Submit document
✅ Check localStorage for "real:" keys
✅ Switch to Demo Work - real data preserved
```

---

## 🔍 Debugging Tips

### Check Console Logs
```javascript
// Look for these logs:
🔍 [RecipientSelector] Loading recipients for role: { userRole, isDemoWorkRole }
✅ [RecipientSelector] Loaded mock recipients for Demo Work role: 5
⚠️ [RecipientSelector] Real role detected - fetching from Supabase
✅ [RecipientSelector] Loaded real recipients from Supabase: 3
```

### Check Storage Keys
```javascript
// Open DevTools > Application > Local Storage
// Demo Work should have:
demo-work:pending-approvals
demo-work:submitted-documents

// Real roles should have:
real:pending-approvals
real:submitted-documents
```

### Check Data Source
```javascript
// RecipientSelector shows badge for demo mode
// No badge = real data or empty state
```

---

## 🚨 Common Issues

### "No recipients available" for Real Roles
**Cause**: Supabase not configured  
**Fix**: Follow Option 2 setup steps above

### "Failed to load recipients from database"
**Cause**: Network error or wrong credentials  
**Fix**: 
1. Check `.env` file
2. Verify Supabase project is active
3. Check browser console for details

### Mock data appearing for real roles
**Cause**: Should not happen  
**Fix**: 
1. Clear localStorage
2. Hard refresh (Ctrl+Shift+R)
3. Check console logs

---

## 📚 Documentation

- **Full Migration Guide**: `docs/RECIPIENT_MIGRATION.md`
- **Architecture Diagram**: `docs/DATA_FLOW_ARCHITECTURE.md`
- **Completion Summary**: `docs/MIGRATION_COMPLETE.md`

---

## 🎯 Key Files

### Modified
- `src/components/approval/RecipientSelector.tsx` - Role-based loading
- `src/contexts/AuthContext.tsx` - Storage cleanup

### Created
- `src/services/RecipientService.ts` - Supabase integration
- `src/utils/RoleScopedStorage.ts` - Storage isolation

---

## 💡 Pro Tips

1. **Always test Demo Work first** - It should always work
2. **Check console logs** - They tell you exactly what's happening
3. **Use DevTools** - Inspect localStorage to verify scoping
4. **Start simple** - Add 2-3 users to Supabase first
5. **Read the docs** - Full details in `docs/RECIPIENT_MIGRATION.md`

---

## ✅ Success Indicators

You know it's working when:
- ✅ Demo Work shows mock data with amber badge
- ✅ Real roles show Supabase data (or empty state)
- ✅ Storage keys are properly prefixed
- ✅ No cross-contamination between roles
- ✅ Clear error messages when needed

---

## 🆘 Need Help?

1. Check browser console for detailed logs
2. Review `docs/RECIPIENT_MIGRATION.md`
3. Verify Supabase setup is complete
4. Test with Demo Work role first

---

**Quick Start Complete!** 🎉

Choose your path:
- **Just testing?** → Use Demo Work role (no setup)
- **Production ready?** → Setup Supabase (5 minutes)

Both paths work perfectly - pick what fits your needs!
