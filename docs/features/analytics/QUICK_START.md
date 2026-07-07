# Analytics Dashboard - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Run Database Migration

Open Supabase SQL Editor and execute:

```bash
supabase/migrations/20240128_analytics_dashboard.sql
```

This creates:
- `analytics_metrics` table
- `department_stats` table
- `monthly_trends` table
- `user_activity` table

### Step 2: Verify Setup

Check that tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('analytics_metrics', 'department_stats', 'monthly_trends', 'user_activity');
```

### Step 3: Test Real-Time

1. Open your app at `/analytics`
2. Look for the green pulsing dot next to metrics
3. Open another tab and submit/approve a document
4. Watch the analytics update automatically!

## ✅ What to Expect

### Live Indicators
- 🟢 Green pulsing dot = Connected to Supabase
- "Supabase Realtime" badge on metrics
- Instant updates when data changes

### Data Sources
- **Primary:** Supabase database
- **Fallback:** localStorage cache (offline only)

### Real-Time Updates
- Document submissions
- Approvals/rejections
- Department statistics
- Monthly trends

## 🎨 UI Features (All Preserved)

✅ All metric cards functional  
✅ Department stats display  
✅ Monthly trends charts  
✅ Filters and tabs working  
✅ Navigation intact  
✅ Card creation UI unchanged  

## 🔧 Troubleshooting

**No green dot?**
→ Check `.env` for Supabase credentials

**Data not updating?**
→ Verify real-time enabled in Supabase dashboard

**Seeing cached data?**
→ Normal when offline, will sync when reconnected

## 📊 Key Files

- `src/services/AnalyticsService.ts` - Data layer
- `src/hooks/useAnalytics.ts` - React hook
- `src/pages/Analytics.tsx` - Main page
- `src/components/dashboard/widgets/AnalyticsWidget.tsx` - Widget

## 🎯 Success!

You now have a production-ready Analytics Dashboard with:
- Real-time Supabase integration
- Automatic UI updates
- Offline resilience
- Clean architecture

---

**Need Help?** Check `ANALYTICS_SUPABASE_INTEGRATION.md` for detailed documentation.
