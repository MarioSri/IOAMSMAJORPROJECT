# localStorage Usage Rules

## Critical Rule: Identity vs Preferences

### ❌ FORBIDDEN: Identity Data in localStorage

**Never store these in localStorage:**
- `name` - User's full name
- `email` - User's email address
- `role` - User's role/position
- `department` - User's department
- `employee_id` - Employee identification
- `designation` - Job title
- `branch` - Branch/campus assignment

**Why?**
- Identity data must always come from the source of truth (Supabase for real roles, MOCK_RECIPIENTS for demo-work)
- localStorage can become stale and out of sync with database
- Creates confusion about data origin
- Makes debugging difficult

### ✅ ALLOWED: Preference Data in localStorage

**You can store these in localStorage:**
- Notification settings (email, SMS, push preferences)
- Theme preferences (dark mode, light mode)
- UI state (collapsed cards, expanded sections)
- Dashboard layout preferences
- Draft form data (temporary, unsaved work)
- Last viewed pages
- Filter preferences

**Storage Key Naming Convention:**
```typescript
// Good - Scoped to user and clearly preference data
localStorage.setItem(`user-preferences-${userId}`, JSON.stringify(prefs))
localStorage.setItem(`dashboard-layout-${userId}`, JSON.stringify(layout))
localStorage.setItem(`notification-settings-${userId}`, JSON.stringify(settings))

// Good - Role-scoped for demo/real separation
localStorage.setItem(`demo-work:ui-state`, JSON.stringify(state))
localStorage.setItem(`real:notification-settings`, JSON.stringify(settings))

// Bad - Generic keys that could contain identity data
localStorage.setItem('user-profile', JSON.stringify(profile)) // ❌
localStorage.setItem('current-user', JSON.stringify(user)) // ❌
localStorage.setItem('profile-data', JSON.stringify(data)) // ❌
```

## Data Flow Architecture

### Demo Work Role
```
Login (demo-work)
  ↓
AuthContext: Load from MOCK_RECIPIENTS
  ↓
Profile/Dashboard: Use MOCK_RECIPIENTS data
  ↓
localStorage: Only UI preferences
```

### Real Roles (Principal, Registrar, HOD, etc.)
```
Login (Google OAuth)
  ↓
AuthContext: Authenticate with Google
  ↓
Supabase: Fetch user profile by email
  ↓
Profile/Dashboard: Display Supabase data
  ↓
localStorage: Only UI preferences
```

## Implementation Checklist

When adding new features that store data:

- [ ] Is this identity data? → Use Supabase (or MOCK_RECIPIENTS for demo-work)
- [ ] Is this preference data? → Use localStorage with proper key naming
- [ ] Does the key include user ID or role scope?
- [ ] Is the data source tracked with `dataSource` state?
- [ ] Are there proper error states (no silent fallbacks)?
- [ ] Is there a demo mode indicator if showing mock data?

## Migration Notes

### Old Pattern (Deprecated)
```typescript
// ❌ Don't do this
const savedProfile = localStorage.getItem('user-profile')
if (savedProfile) {
  setProfileData(JSON.parse(savedProfile))
}
```

### New Pattern (Correct)
```typescript
// ✅ Do this instead
if (isAllowedMockData(user.role)) {
  // Load from MOCK_RECIPIENTS
  const mockProfile = MOCK_RECIPIENTS.find(r => r.user_id === user.id)
  setProfileData(mockProfile)
  setDataSource('mock')
} else {
  // Fetch from Supabase
  const profile = await userProfileService.fetchProfile(user.id)
  setProfileData(profile)
  setDataSource('real')
}

// Separately load preferences
const prefs = localStorage.getItem(`user-preferences-${user.id}`)
```

## Debugging Tips

### Check Data Source
Every component should log its data source:
```typescript
logDataSource('ComponentName', dataSource, 'additional info')
```

### Verify localStorage Keys
Run in browser console:
```javascript
// List all localStorage keys
Object.keys(localStorage)

// Check for forbidden patterns
Object.keys(localStorage).filter(k => 
  k.includes('profile') || 
  k.includes('user-data') || 
  k === 'current-user'
)
```

### Clear Stale Data
```typescript
// Clear old identity data from localStorage
localStorage.removeItem('user-profile')
localStorage.removeItem('current-user')
localStorage.removeItem('profile-data')
```

## Related Files

- `src/utils/roleUtils.ts` - Role checking utilities
- `src/services/UserProfileService.ts` - Supabase profile fetching
- `src/contexts/AuthContext.tsx` - Authentication and MOCK_RECIPIENTS
- `src/pages/Profile.tsx` - Profile page implementation
- `src/components/dashboard/RoleDashboard.tsx` - Dashboard implementation
