# Quick Actions Widget Missing from Principal Dashboard - Fix

## Issue Identified
The Quick Actions widget is not appearing on the principal dashboard.

## Root Cause
The `getDefaultWidgets` function in `DynamicDashboard.tsx` correctly includes the Quick Actions widget, but there may be corrupted data in localStorage that is preventing it from displaying.

## Solution

### Option 1: Clear Browser localStorage (Quick Fix)
Ask the user to:
1. Open browser console (F12)
2. Go to Application/Storage tab
3. Clear localStorage for the site
4. Refresh the page

OR run this in console:
```javascript
localStorage.removeItem('dashboard-widgets-principal');
location.reload();
```

### Option 2: Code Fix (Permanent Solution)
Add a reset mechanism to force refresh default widgets for principal role.

## Verification
The Quick Actions widget is defined at line 90-96 in `DynamicDashboard.tsx`:
```typescript
{
  id: 'quickActions',
  type: 'quickActions',
  title: 'Quick Actions',
  position: { x: 0, y: 0, w: isMobile ? 12 : 6, h: 2 },
  visible: true,  // ✅ Always visible
  permissions: []  // ✅ No permission requirements
}
```

The widget should always be visible for principal role as it has:
- `visible: true`
- `permissions: []` (no restrictions)

## Next Steps
1. Clear localStorage to test
2. If issue persists, check for any widget filtering logic
3. Verify QuickActionsWidget component is rendering correctly
