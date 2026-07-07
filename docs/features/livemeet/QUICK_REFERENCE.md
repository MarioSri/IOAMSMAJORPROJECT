# LiveMeet+ - Quick Reference

## 🚀 3-Step Setup

### Step 1: Run Migration
```sql
-- In Supabase SQL Editor:
supabase/migrations/20240129_livemeet_plus.sql
```

### Step 2: Verify Table
```sql
SELECT * FROM live_meeting_requests LIMIT 5;
```

### Step 3: Test
1. Open Messages → LiveMeet+
2. Look for 🟢 green dot (Supabase connected)
3. Create meeting request
4. Watch real-time updates!

---

## 📊 What Changed

### Before (localStorage):
```typescript
// Direct localStorage writes
localStorage.setItem('live_meeting_requests', JSON.stringify(requests));
```

### After (Supabase):
```typescript
// Supabase with real-time
const { data } = await supabase.from('live_meeting_requests').insert(request);
// Real-time subscription auto-updates UI
```

---

## 🔄 Real-Time Updates

**Automatic UI updates when:**
- ✅ New requests created
- ✅ Requests accepted/declined
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
- ✅ Meeting request cards
- ✅ Accept/Decline buttons
- ✅ Stats display
- ✅ Filters & search
- ✅ Priority badges

---

## 🔍 Troubleshooting

**No green dot?**
→ Check Supabase credentials in `.env`

**Data not updating?**
→ Verify real-time enabled in Supabase

**Seeing cached data?**
→ Normal when offline, syncs when reconnected

---

## 📁 Key Files

- `src/services/LiveMeetingService.ts` - Data layer
- `src/hooks/useLiveMeeting.ts` - React hook
- `src/components/meetings/LiveMeetingRequestManager.tsx` - UI

---

**Status:** ✅ Production Ready  
**Real-time:** Enabled  
**Cache:** localStorage (fallback only)
