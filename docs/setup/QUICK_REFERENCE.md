# Quick Reference: Data Source Architecture

## When Adding New Components That Display User Data

### 1. Import Required Utilities
```typescript
import { isAllowedMockData, logDataSource, DataSource } from '@/utils/roleUtils';
import { userProfileService } from '@/services/UserProfileService';
import { DemoIndicator, LiveDataIndicator } from '@/components/ui/DemoIndicator';
```

### 2. Add State
```typescript
const [dataSource, setDataSource] = useState<DataSource>('empty');
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### 3. Load Data Pattern
```typescript
useEffect(() => {
  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (isAllowedMockData(user.role)) {
        // Demo Work: Load from MOCK_RECIPIENTS
        const { MOCK_RECIPIENTS } = await import('@/contexts/AuthContext');
        const mockData = MOCK_RECIPIENTS.find(r => r.user_id === user.id);
        
        setData(mockData);
        setDataSource('mock');
        logDataSource('ComponentName', 'mock', mockData?.name);
      } else {
        // Real Roles: Fetch from Supabase
        const realData = await userProfileService.fetchProfile(user.id);
        
        if (realData) {
          setData(realData);
          setDataSource('real');
          logDataSource('ComponentName', 'real', realData.name);
        } else {
          setData(null);
          setDataSource('empty');
          logDataSource('ComponentName', 'empty', 'No data found');
        }
      }
    } catch (error) {
      console.error('❌ [ComponentName] Error loading data:', error);
      setError('Failed to load data');
      setDataSource('empty');
    } finally {
      setLoading(false);
    }
  };
  
  loadData();
}, [user]);
```

### 4. Display Indicators
```typescript
return (
  <div>
    {/* Demo Mode Alert */}
    {dataSource === 'mock' && (
      <DemoIndicator variant="alert" location="profile" className="mb-6" />
    )}
    
    {/* Header with Badge */}
    <div className="flex items-center justify-between">
      <h1>Component Title</h1>
      {dataSource === 'mock' && <DemoIndicator variant="badge" />}
      {dataSource === 'real' && <LiveDataIndicator />}
    </div>
    
    {/* Your content */}
  </div>
);
```

## Common Patterns

### Check if Demo Work Role
```typescript
// ✅ Correct
if (isAllowedMockData(user.role)) {
  // Load mock data
}

// ❌ Wrong - Don't do inline checks
if (user.role === 'demo-work') {
  // This bypasses centralized logic
}
```

### localStorage Usage
```typescript
// ✅ Correct - Preferences only
localStorage.setItem(`user-preferences-${userId}`, JSON.stringify(prefs));
localStorage.setItem(`notification-settings-${userId}`, JSON.stringify(settings));

// ❌ Wrong - Identity data
localStorage.setItem('user-profile', JSON.stringify(profile));
localStorage.setItem('user-name', name);
```

### Logging
```typescript
// ✅ Correct - Use utility
logDataSource('ComponentName', 'mock', 'Additional info');

// ❌ Wrong - Inconsistent logging
console.log('Loaded data from mock');
```

### Error Handling
```typescript
// ✅ Correct - Clear, actionable
setError('Profile data temporarily unavailable');

// ❌ Wrong - Confusing
setError('Authentication failed');
```

## Component Checklist

When creating/updating components that display user data:

- [ ] Imported roleUtils and DemoIndicator
- [ ] Added dataSource state
- [ ] Used isAllowedMockData() for role check
- [ ] Fetches from Supabase for real roles
- [ ] Uses MOCK_RECIPIENTS only for demo-work
- [ ] Logs data source with logDataSource()
- [ ] Shows DemoIndicator when dataSource === 'mock'
- [ ] Has proper error states (no silent fallbacks)
- [ ] Does NOT store identity data in localStorage
- [ ] Only stores preferences in localStorage with scoped keys

## Data Source States

### 'mock'
- User is demo-work role
- Data from MOCK_RECIPIENTS
- Show DemoIndicator
- Log with ⚠️ emoji

### 'real'
- User is real role (Principal, Registrar, etc.)
- Data from Supabase
- Optionally show LiveDataIndicator
- Log with ✅ emoji

### 'empty'
- No data available
- Show empty state or error message
- Provide retry button if error
- Log with ❌ emoji

## Quick Debugging

### Check Data Source in Console
```javascript
// Look for these logs
"✅ [ComponentName] Data source: real - John Doe"
"⚠️ [ComponentName] Data source: mock - Demo Work Role"
"❌ [ComponentName] Data source: empty - No data found"
```

### Check localStorage
```javascript
// In browser console
Object.keys(localStorage).filter(k => 
  k.includes('profile') || 
  k.includes('user-data')
)
// Should return empty array (no identity data)
```

### Verify Role Check
```javascript
// In browser console
import { isAllowedMockData } from './src/utils/roleUtils'
isAllowedMockData('demo-work')  // true
isAllowedMockData('principal')  // false
```

## Common Mistakes to Avoid

### ❌ Storing Identity in localStorage
```typescript
// DON'T
localStorage.setItem('user-profile', JSON.stringify({
  name: 'John Doe',
  role: 'Principal'
}));
```

### ❌ Inline Role Checks
```typescript
// DON'T
if (user.role.toLowerCase() === 'demo-work') {
  // Use isAllowedMockData() instead
}
```

### ❌ Silent Fallbacks
```typescript
// DON'T
try {
  const data = await fetchFromSupabase();
} catch (error) {
  // Silently fall back to mock data
  const data = MOCK_RECIPIENTS[0];
}
```

### ❌ Missing Data Source Tracking
```typescript
// DON'T
const [data, setData] = useState(null);
// Missing: const [dataSource, setDataSource] = useState<DataSource>('empty');
```

### ❌ Inconsistent Indicators
```typescript
// DON'T - Use DemoIndicator component
<div className="bg-yellow-100">Demo Mode</div>
```

## File Locations

- **Utilities**: `src/utils/roleUtils.ts`
- **Services**: `src/services/UserProfileService.ts`
- **Components**: `src/components/ui/DemoIndicator.tsx`
- **Mock Data**: `src/contexts/AuthContext.tsx` (MOCK_RECIPIENTS)
- **Documentation**: `docs/LOCALSTORAGE_RULES.md`

## Need Help?

1. Check `docs/DATA_FLOW_ARCHITECTURE.md` for architecture overview
2. Check `docs/LOCALSTORAGE_RULES.md` for storage rules
3. Check `docs/PHASE1_IMPLEMENTATION_SUMMARY.md` for implementation details
4. Look at existing implementations:
   - `src/pages/Profile.tsx`
   - `src/components/dashboard/RoleDashboard.tsx`
   - `src/components/approval/RecipientSelector.tsx`
