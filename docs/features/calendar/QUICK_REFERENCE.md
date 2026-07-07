# Calendar - Quick Reference

## 🚀 3-Step Setup

### Step 1: Run Migration
```sql
-- In Supabase SQL Editor:
supabase/migrations/20240130_calendar_meetings.sql
```

### Step 2: Verify Table
```sql
SELECT * FROM meetings LIMIT 5;
```

### Step 3: Test
1. Open Calendar page
2. Create a meeting
3. Watch real-time updates!

---

## 📊 What Changed

### Before (localStorage):
```typescript
// Direct localStorage writes
localStorage.setItem('meetings', JSON.stringify(meetings));
```

### After (Supabase):
```typescript
// Supabase with real-time
const { data } = await supabase.from('meetings').insert(meeting);
// Real-time subscription auto-updates UI
```

---

## 🔄 Real-Time Updates

**Automatic UI updates when:**
- ✅ New meetings created
- ✅ Meetings updated/deleted
- ✅ Status changes
- ✅ Any user makes changes

---

## 💾 Cache Behavior

**localStorage = Cache Only**
- Used when offline
- Auto-syncs when online
- Never source of truth

---

## 🎨 UI Status

**All UI Preserved:**
- ✅ Meeting scheduler form
- ✅ Calendar grid view
- ✅ List view
- ✅ Meeting cards
- ✅ Stats display
- ✅ All action buttons

---

## 🔍 Troubleshooting

**Data not updating?**
→ Verify real-time enabled in Supabase

**Seeing cached data?**
→ Normal when offline, syncs when reconnected

**Migration errors?**
→ Check Supabase credentials in `.env`

---

## 📁 Key Files

- `src/services/CalendarService.ts` - Data layer
- `src/hooks/useCalendar.ts` - React hook
- `src/components/meetings/MeetingScheduler.tsx` - UI

---

## 🔌 Integration Example

```typescript
import { useCalendar } from '@/hooks/useCalendar';

function MyComponent() {
  const { meetings, createMeeting, isConnected } = useCalendar();
  
  // meetings auto-update in real-time
  // isConnected shows Supabase status
}
```

---

**Status:** ✅ Production Ready  
**Real-time:** Enabled  
**Cache:** localStorage (fallback only)
