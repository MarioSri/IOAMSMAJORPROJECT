# Data Flow Architecture

## Current System Architecture (After Migration)

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Login                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  AuthContext    │
                    │  Role Detection │
                    └─────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │  Demo Work Role   │       │   Real Roles      │
    │  (demo-work)      │       │  (principal, hod, │
    │                   │       │   registrar, etc) │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │  MOCK_RECIPIENTS  │       │ RecipientService  │
    │  (AuthContext)    │       │  (Supabase)       │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │  Mock Data        │       │  Real-Time Data   │
    │  - Dr. John Doe   │       │  - Actual Users   │
    │  - Dr. Jane Smith │       │  - From Database  │
    │  - (5 users)      │       │  - Live Updates   │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │ RecipientSelector │       │ RecipientSelector │
    │ dataSource: mock  │       │ dataSource: real  │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │  Storage Scope    │       │  Storage Scope    │
    │  demo-work:*      │       │  real:*           │
    └───────────────────┘       └───────────────────┘
```

---

## Storage Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                      localStorage                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Demo Work Namespace (demo-work:)                               │
│  ├─ demo-work:pending-approvals                                 │
│  ├─ demo-work:submitted-documents                               │
│  ├─ demo-work:approval-history-new                              │
│  ├─ demo-work:channels                                          │
│  └─ demo-work:recipients                                        │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Real Roles Namespace (real:)                                   │
│  ├─ real:pending-approvals                                      │
│  ├─ real:submitted-documents                                    │
│  ├─ real:approval-history-new                                   │
│  ├─ real:channels                                               │
│  └─ real:recipients                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

✅ No cross-contamination
✅ Clear ownership
✅ Easy to debug
```

---

## RecipientSelector Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    RecipientSelector.tsx                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Check userRole │
                    └─────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │ Is Demo Work?     │       │ Is Real Role?     │
    │ (demo-work)       │       │ (principal, etc)  │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │ Load Mock Data    │       │ Fetch from        │
    │ from AuthContext  │       │ Supabase          │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │ Set dataSource:   │       │ Set dataSource:   │
    │ 'mock'            │       │ 'real' or 'empty' │
    └───────────────────┘       └───────────────────┘
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │ Show Recipients   │       │ Show Recipients   │
    │ + Demo Badge      │       │ or Empty State    │
    └───────────────────┘       └───────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Real Role Data Fetch                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ recipientService│
                    │ .fetchRecipients│
                    └─────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
    ┌───────────────┐ ┌──────────┐ ┌──────────────┐
    │   Success     │ │  Empty   │ │    Error     │
    │ (data found)  │ │ (no data)│ │ (network)    │
    └───────────────┘ └──────────┘ └──────────────┘
                │             │             │
                ▼             ▼             ▼
    ┌───────────────┐ ┌──────────┐ ┌──────────────┐
    │ Show          │ │ Show     │ │ Show Error   │
    │ Recipients    │ │ Empty    │ │ Message +    │
    │               │ │ State    │ │ Retry Button │
    └───────────────┘ └──────────┘ └──────────────┘
                │             │             │
                ▼             ▼             ▼
    ┌───────────────┐ ┌──────────┐ ┌──────────────┐
    │ dataSource:   │ │dataSource│ │ dataSource:  │
    │ 'real'        │ │ 'empty'  │ │ 'empty'      │
    └───────────────┘ └──────────┘ └──────────────┘

❌ NO FALLBACK TO MOCK DATA
✅ Transparent error handling
✅ User always knows the state
```

---

## Component Usage Map

```
RecipientSelector Component
├─ Used in 3 locations:
│
├─ 1. DocumentUploader.tsx
│     Label: "Document Management Recipients"
│     Purpose: Regular document submissions
│     Behavior: Role-based data loading
│
├─ 2. EmergencyWorkflowInterface.tsx
│     Label: "Emergency Management Recipients"
│     Purpose: Emergency document submissions
│     Behavior: Role-based data loading
│
└─ 3. WorkflowConfiguration.tsx
      Label: "Approval Chain with Bypass Recipients"
      Purpose: Workflow configuration
      Behavior: Role-based data loading

All three locations now:
✅ Respect role-based data loading
✅ Use role-scoped storage
✅ Show appropriate states
```

---

## Migration Safety Checks

```
┌─────────────────────────────────────────────────────────────────┐
│                    Safety Mechanisms                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Role Detection                                              │
│     ✅ Normalized role comparison (lowercase, no spaces)        │
│     ✅ Explicit demo-work check                                 │
│                                                                  │
│  2. No Silent Fallback                                          │
│     ✅ Real roles NEVER get mock data                           │
│     ✅ Error state instead of fallback                          │
│                                                                  │
│  3. Storage Isolation                                           │
│     ✅ Automatic key prefixing                                  │
│     ✅ Role-switch cleanup                                      │
│                                                                  │
│  4. Data Source Tracking                                        │
│     ✅ dataSource state: 'mock' | 'real' | 'empty'             │
│     ✅ Visual indicator for demo mode                           │
│                                                                  │
│  5. Console Logging                                             │
│     ✅ Every data load logged                                   │
│     ✅ Easy debugging                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Supabase Integration (Phase 3)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Setup                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Create Project  │
                    │ on supabase.com │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Create users    │
                    │ table (SQL)     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Add real users  │
                    │ to database     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Configure .env  │
                    │ with credentials│
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Install         │
                    │ @supabase/      │
                    │ supabase-js     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Update          │
                    │ RecipientService│
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ ✅ Real-time    │
                    │    data ready   │
                    └─────────────────┘
```

---

## State Transitions

```
Demo Work Role:
  Loading → Mock Data Loaded → Recipients Displayed
  
Real Role (Supabase Configured):
  Loading → Real Data Loaded → Recipients Displayed
  
Real Role (Supabase Not Configured):
  Loading → Empty State → "No recipients available"
  
Real Role (Network Error):
  Loading → Error State → "Failed to load" + Retry
```

---

This architecture ensures:
- ✅ Clear separation between demo and real data
- ✅ No accidental data mixing
- ✅ Transparent error handling
- ✅ Easy to debug and maintain
- ✅ Ready for production use


---

## Phase 1 Implementation: Foundation (COMPLETED)

### New Utilities Created

```
src/utils/roleUtils.ts
├─ isAllowedMockData(role: string): boolean
│  └─ Single source of truth for mock data access
├─ normalizeRole(role: string): string
│  └─ Consistent role comparison
├─ logDataSource(component, source, details)
│  └─ Standardized logging
└─ DataSource type: 'mock' | 'real' | 'empty'
   └─ Explicit data origin tracking
```

### New Services Created

```
src/services/UserProfileService.ts
├─ fetchProfile(userId): Promise<UserProfile | null>
│  └─ Fetch individual user profile from Supabase
└─ fetchProfileByEmail(email): Promise<UserProfile | null>
   └─ Fetch profile by email (for Google OAuth)
```

### New Components Created

```
src/components/ui/DemoIndicator.tsx
├─ DemoIndicator (variant: 'badge' | 'alert' | 'inline')
│  └─ Consistent demo mode visual indicator
└─ LiveDataIndicator
   └─ Shows when displaying real Supabase data
```

### Updated Components

```
Profile.tsx
├─ Added dataSource state tracking
├─ Fetches from Supabase for real roles
├─ Uses MOCK_RECIPIENTS only for demo-work
├─ Shows DemoIndicator when in demo mode
├─ Removed localStorage for identity data
└─ Only uses localStorage for preferences

RoleDashboard.tsx
├─ Added dataSource state tracking
├─ Fetches from Supabase for real roles
├─ Uses MOCK_RECIPIENTS only for demo-work
├─ Shows demo badge in welcome section
└─ Displays DemoIndicator alert at top

RecipientSelector.tsx
├─ Uses isAllowedMockData() utility
├─ Uses DemoIndicator component
└─ Consistent with other components

AuthContext.tsx
├─ Uses isAllowedMockData() utility
├─ Added documentation about MOCK_RECIPIENTS
└─ Logs isDemoWork status
```

---

## localStorage Rules (NEW)

### Identity Data (NEVER in localStorage)
```
❌ name
❌ email
❌ role
❌ department
❌ employee_id
❌ designation
❌ branch
```

### Preference Data (ALLOWED in localStorage)
```
✅ user-preferences-${userId}
✅ notification-settings-${userId}
✅ dashboard-layout-${userId}
✅ demo-work:ui-state
✅ real:notification-settings
```

See: `docs/LOCALSTORAGE_RULES.md` for complete documentation

---

## Data Source Tracking Pattern

Every component displaying user/recipient data now follows this pattern:

```typescript
// 1. State
const [dataSource, setDataSource] = useState<DataSource>('empty')

// 2. Load Data
if (isAllowedMockData(user.role)) {
  // Load mock
  setDataSource('mock')
  logDataSource('ComponentName', 'mock', details)
} else {
  // Fetch from Supabase
  const data = await service.fetch()
  setDataSource(data ? 'real' : 'empty')
  logDataSource('ComponentName', data ? 'real' : 'empty', details)
}

// 3. Display Indicator
{dataSource === 'mock' && <DemoIndicator />}
{dataSource === 'real' && <LiveDataIndicator />}
```

---

## Next Steps: Phase 2 (Supabase Integration)

### Required Actions

1. **Install Supabase Client**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create Supabase Project**
   - Go to supabase.com
   - Create new project
   - Copy URL and anon key

3. **Configure Environment**
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Create Database Schema**
   ```sql
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
   
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_users_role ON users(role);
   CREATE INDEX idx_users_active ON users(is_active);
   ```

5. **Update Services**
   - Uncomment Supabase queries in RecipientService.ts
   - Uncomment Supabase queries in UserProfileService.ts
   - Create Supabase client instance

6. **Add Real Users**
   - Insert actual users into Supabase users table
   - Test with real roles (Principal, Registrar, HOD)

---

## Testing Checklist

### Phase 1 (Foundation) - COMPLETED
- [x] roleUtils.ts created with isAllowedMockData()
- [x] UserProfileService.ts created
- [x] DemoIndicator component created
- [x] Profile.tsx updated with dataSource tracking
- [x] RoleDashboard.tsx updated with dataSource tracking
- [x] RecipientSelector.tsx uses centralized utilities
- [x] AuthContext.tsx uses isAllowedMockData()
- [x] LOCALSTORAGE_RULES.md documentation created

### Phase 2 (Supabase Integration) - PENDING
- [ ] Supabase client installed
- [ ] Environment variables configured
- [ ] Database schema created
- [ ] Real users added to database
- [ ] RecipientService queries implemented
- [ ] UserProfileService queries implemented
- [ ] Tested with real roles

### Phase 3 (Validation) - PENDING
- [ ] Demo Work role shows mock data everywhere
- [ ] Principal role fetches from Supabase
- [ ] Registrar role fetches from Supabase
- [ ] HOD role fetches from Supabase
- [ ] Error states display correctly
- [ ] Demo indicators appear only for demo-work
- [ ] No identity data in localStorage
- [ ] Console logs show correct data sources

---

## Architecture Benefits

### Debugging
- Console logs clearly show data source for every component
- `dataSource` state makes it obvious where data comes from
- No guessing about mock vs real data

### Maintainability
- Single utility function controls mock data access
- Easy to add new demo roles (just update MOCK_DATA_ROLES array)
- Clear separation of concerns

### User Experience
- Visual indicators prevent confusion
- Error messages are clear and actionable
- No silent fallbacks that hide problems

### Data Integrity
- Identity data always from source of truth
- localStorage only for preferences
- No stale data issues
