# Demo Role Isolation

## Overview
The Demo role (`demo-work`) is completely isolated from real-time data reception, Supabase interactions, and all other roles/services.

**CRITICAL: Non-demo roles NEVER fall back to mock data under any condition. They use ONLY real, live data from Supabase.**

## Strict Separation Rules

### Demo Role (demo-work)
- ✅ Uses `MOCK_RECIPIENTS` from AuthContext
- ✅ Uses localStorage for documents
- ✅ No Supabase connections
- ✅ No WebSocket connections
- ✅ Completely sandboxed

### Non-Demo Roles (Principal, Registrar, HOD, Program Head, Employee)
- ✅ ALWAYS fetch from Supabase `role_recipients` table
- ✅ ALWAYS use real-time WebSocket connections
- ✅ ALWAYS use Supabase auth sessions
- ❌ NEVER fall back to mock data
- ❌ NEVER use `MOCK_RECIPIENTS`
- ❌ If Supabase fails, show error state (NOT mock data)

## Isolation Points

### 1. Authentication (AuthContext.tsx)
- **Supabase Session Checks**: Demo role skips all `getSession()` and `onAuthStateChange()` calls
- **Token Refresh**: No JWT refresh for demo role
- **Session Persistence**: Uses sessionStorage only, no Supabase auth tokens

```typescript
// Early exit for demo role in useEffect
if (hadPersistedUser && isAllowedMockData(loadPersistedUser()?.role || '')) {
  console.log('[AuthContext] Demo role detected — skipping Supabase session checks');
  setIsLoading(false);
  return;
}
```

### 2. Real-Time WebSocket (useSocket.ts)
- **Connection**: Demo role never establishes WebSocket connections
- **Subscriptions**: All subscription methods return no-op functions
- **Events**: No real-time document updates or notifications

```typescript
// Demo role check in useEffect
if (user && isAllowedMockData(user.role)) {
  console.log('[useSocket] Demo role detected — skipping WebSocket connection');
  return;
}
```

### 3. Data Sources (RecipientSelector.tsx)
- **Demo Role**: Uses `MOCK_RECIPIENTS` from AuthContext
- **Non-Demo Roles**: Calls `recipientService.fetchRecipients()` (Supabase only)
- **No Fallback**: If Supabase fails, shows error state

```typescript
const isDemoWorkRole = isAllowedMockData(userRole);
if (isDemoWorkRole) {
  const { MOCK_RECIPIENTS } = await import('@/contexts/AuthContext');
  // Use mock data only
} else {
  // Real roles: Supabase ONLY, no fallback
  const realRecipients = await recipientService.fetchRecipients();
  if (realRecipients.length === 0) {
    // Show empty state, NOT mock data
  }
}
```

### 4. Profile Data (Profile.tsx)
- **Demo Role**: Uses `MOCK_RECIPIENTS` profile data
- **Non-Demo Roles**: Fetches from Supabase `role_recipients` table
- **No Fallback**: If profile not found, shows empty state

```typescript
if (isDemoWork) {
  const { MOCK_RECIPIENTS } = await import('@/contexts/AuthContext');
  // Use mock profile
} else {
  const profile = await userProfileService.fetchProfileByEmail(emailKey);
  if (!profile) {
    // Show empty state, NOT mock data
    setDataSource('empty');
  }
}
```

### 5. Document Management (RealTimeDocumentService.ts)
- **Storage**: Demo role uses localStorage only (no Supabase tables)
- **Events**: Uses browser CustomEvents, not WebSocket
- **Workflow**: All workflow logic is client-side only

## Mock Data
Demo role has access to:
- 6 mock recipients (defined in `MOCK_RECIPIENTS`)
- Local document storage
- Client-side workflow engine
- No external API calls

## Verification
To verify isolation:
1. Login as demo-work role
2. Check browser console for:
   - `[AuthContext] Demo role detected — skipping Supabase session checks`
   - `[useSocket] Demo role detected — skipping WebSocket connection`
   - `[RecipientSelector] Data source: mock`
3. Check Network tab: No Supabase API calls
4. Check WebSocket tab: No active connections

To verify non-demo roles:
1. Login as any non-demo role (Principal, Registrar, etc.)
2. Check browser console for:
   - `[RecipientSelector] Data source: real`
   - `[Profile] Data source: real`
3. Check Network tab: Supabase API calls present
4. If Supabase is down: Error states shown, NO mock data fallback

## Adding New Demo Roles
1. Add role to `MOCK_DATA_ROLES` in `utils/roleUtils.ts`
2. Add mock recipients to `MOCK_RECIPIENTS` in `contexts/AuthContext.tsx`
3. Test all isolation points

## Security
- Demo role cannot access real user data
- Demo role cannot modify real database records
- Demo role cannot receive real-time updates from other users
- Demo role operates in complete sandbox environment
- Non-demo roles cannot access mock data under any condition
- No shared data sources between demo and non-demo roles
- No side effects between demo and non-demo roles
