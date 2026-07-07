# Performance Optimization Testing Guide

## Quick Test Steps

### 1. Build the Application
```bash
cd IAOMS-MAIN
npm run build
```

### 2. Check Bundle Sizes
After build completes, check the output for chunk sizes:
- Look for `react-vendor`, `ui-vendor`, `data-vendor` chunks
- Verify `pdf-vendor` and `office-vendor` are separate chunks
- Initial bundle should be < 1.2 MB

### 3. Test Locally
```bash
npm run preview
```

### 4. Test with Chrome DevTools

#### Enable Network Throttling
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Select "Slow 3G" from throttling dropdown
4. Check "Disable cache"

#### Measure Performance
1. Go to Performance tab
2. Click Record
3. Navigate to http://localhost:4173 (or preview port)
4. Wait for page to fully load
5. Stop recording

#### Check Metrics
- **LCP**: Should be 10-15 seconds (down from 56.9s)
- **Network waterfall**: Verify widgets load separately
- **Coverage tab**: Check unused JavaScript (should be much lower)

### 5. Verify Lazy Loading

#### Dashboard Widgets
1. Open Network tab
2. Navigate to Dashboard
3. Verify separate chunk files load for:
   - QuickActionsWidget
   - DocumentsWidget
   - CalendarWidget

#### Heavy Libraries
1. Navigate to Documents page
2. Upload and view a PDF file
3. Verify `pdf-vendor` chunk loads only when viewing PDF
4. Try Excel file - verify `office-vendor` chunk loads

### 6. Lighthouse Audit
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Mobile" device
4. Select "Performance" category
5. Click "Analyze page load"

**Target Scores:**
- Performance: > 70 (up from ~20)
- LCP: < 15s on Slow 3G
- FCP: < 5s on Slow 3G

---

## Expected Results

### Bundle Analysis
```
Initial Chunk:
- index.html: ~5 KB
- main.js: ~300-500 KB (down from 2+ MB)
- react-vendor.js: ~150 KB
- ui-vendor.js: ~200 KB
- data-vendor.js: ~150 KB

Lazy Loaded Chunks:
- QuickActionsWidget: ~20-30 KB
- DocumentsWidget: ~40-50 KB
- CalendarWidget: ~50-60 KB
- pdf-vendor: ~500 KB (loaded on demand)
- office-vendor: ~300 KB (loaded on demand)
```

### Network Timeline (Slow 3G)
```
0-500ms:     HTML loaded
500-3000ms:  Main JS chunks loading
3000-8000ms: React rendering, API calls
8000-12000ms: Widgets lazy loading
12000-15000ms: LCP image rendered
```

---

## Troubleshooting

### Issue: Widgets not loading
**Solution**: Check browser console for import errors. Ensure all widget files export correctly.

### Issue: Heavy libraries still in main bundle
**Solution**: Verify dynamic imports are used. Check vite.config.ts manual chunks.

### Issue: LCP still slow
**Solution**: 
1. Verify preconnect links in index.html
2. Check LCP image is preloaded
3. Ensure network throttling is accurate

### Issue: Build errors
**Solution**: 
1. Clear node_modules and reinstall: `npm ci`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Rebuild: `npm run build`

---

## Performance Comparison

### Before Optimizations
- Initial Bundle: 2+ MB
- LCP (Slow 3G): 56.9 seconds
- TTI (Slow 3G): 57 seconds
- Lighthouse Score: ~20

### After Optimizations (Expected)
- Initial Bundle: 800 KB - 1.2 MB
- LCP (Slow 3G): 10-15 seconds
- TTI (Slow 3G): 12-18 seconds
- Lighthouse Score: 60-75

### Improvement
- **Bundle Size**: 40-50% reduction
- **LCP**: 4-6x faster
- **TTI**: 3-4x faster
- **Lighthouse**: 3-4x better score

---

## Next Steps After Testing

If tests pass:
1. ✅ Commit changes
2. ✅ Deploy to staging
3. ✅ Monitor real-user metrics
4. ✅ Proceed with additional optimizations

If tests fail:
1. ❌ Review console errors
2. ❌ Check network tab for failed requests
3. ❌ Verify all imports are correct
4. ❌ Test individual components in isolation

---

## Monitoring in Production

### Key Metrics to Track
- **LCP**: Should be < 2.5s on 4G, < 15s on 3G
- **FID**: Should be < 100ms
- **CLS**: Should be < 0.1
- **Bundle Size**: Should remain < 1.2 MB

### Tools
- Google Analytics (Web Vitals)
- Sentry Performance Monitoring
- Chrome User Experience Report
- Lighthouse CI in deployment pipeline

---

**Last Updated**: 2026-04-11  
**Status**: Ready for Testing
