# 🔍 PDF Viewer Troubleshooting Guide

## Current Issue
PDF files still not viewing after worker fix.

---

## Step-by-Step Debugging

### Step 1: Test Worker File Accessibility

**Open this URL in your browser:**
```
http://localhost:5173/test-worker.html
```

**Expected Result:**
- ✅ Green message: "Worker file is accessible!"
- Browser console shows: "Worker file found: 200 OK"

**If you see an error:**
- ❌ Worker file is not being served
- Try restarting the dev server: `Ctrl+C` then `npm run dev`

---

### Step 2: Check Browser Console

**When viewing a PDF:**
1. Open the Document Management page
2. Upload a PDF file
3. Click "View" button
4. **Immediately press F12** to open DevTools
5. Go to **Console tab**

**Look for these logs:**

✅ **Success logs:**
```
PDF.js version: [version number]
Setting worker source to: /pdf.worker.min.mjs
Starting PDF load for file: [filename]
ArrayBuffer created, size: [number]
PDF loaded successfully! Pages: [number]
Page rendered successfully!
```

❌ **Error logs:**
```
PDF loading error: [error message]
Error details: [error object]
```

**Share the error message** - it will tell us exactly what's wrong!

---

### Step 3: Check Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Try to view a PDF
4. Look for request to `/pdf.worker.min.mjs`

**Expected:**
- Status: `200 OK`
- Type: `javascript`
- Size: ~1 MB

**If you see:**
- `404 Not Found` - Worker file not in public directory
- `CORS error` - Server configuration issue
- No request - Worker not being loaded

---

### Step 4: Verify File Installation

**Check if worker file exists:**

**In PowerShell:**
```powershell
Test-Path "public\pdf.worker.min.mjs"
Get-Item "public\pdf.worker.min.mjs" | Select-Object Length
```

**Expected Output:**
```
True
Length: 1046214
```

**If False or smaller size:**
```powershell
# Re-copy the file
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" -Destination "public\pdf.worker.min.mjs" -Force

# Verify
Get-Item "public\pdf.worker.min.mjs"
```

---

### Step 5: Clear Cache and Restart

Sometimes the browser caches the old worker configuration.

**Clear everything:**
1. **Clear browser cache:**
   - Press `Ctrl+Shift+Delete`
   - Select "Cached images and files"
   - Select "All time"
   - Click "Clear data"

2. **Hard refresh:**
   - Press `Ctrl+Shift+R` (Windows/Linux)
   - Or `Cmd+Shift+R` (Mac)

3. **Restart dev server:**
   ```powershell
   # In terminal, press Ctrl+C to stop
   # Then restart:
   npm run dev
   ```

4. **Close and reopen browser completely**

---

## Common Issues & Fixes

### Issue 1: "Canvas element not found"
**Cause:** Modal opened before canvas was rendered

**Fix:** Already handled in code, but if you see this:
- Close modal
- Wait 1 second
- Click View again

### Issue 2: "Worker was destroyed"
**Cause:** Worker file not loading or wrong version

**Fix:**
```powershell
# Delete old worker
Remove-Item "public\pdf.worker.min.mjs" -Force

# Copy fresh worker
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" -Destination "public\pdf.worker.min.mjs" -Force

# Restart server
# Ctrl+C then npm run dev
```

### Issue 3: "Failed to fetch module"
**Cause:** Server not serving the file

**Fix:** Check `vite.config.ts` - public files should be served automatically

### Issue 4: Blank modal or infinite loading
**Cause:** Silent error in rendering

**Fix:** Check console for errors (Step 2 above)

---

## Alternative: Use CDN Worker

If local worker still doesn't work, try CDN:

**Edit `FileViewer.tsx` line ~8-13:**

```tsx
// Replace this:
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// With this:
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

**Save and test again.**

---

## Test with Sample PDF

Try with a simple PDF first:

1. Create a simple text file
2. Use online converter: https://smallpdf.com/word-to-pdf (or similar)
3. Convert to PDF
4. Upload and test

**Don't test with:**
- Very large PDFs (>10 MB)
- Encrypted/password-protected PDFs
- Scanned PDFs (images only)
- Corrupted PDFs

---

## Still Not Working?

### Please share these details:

1. **Browser Console Output**
   - Copy all logs when clicking View
   - Include any errors in red

2. **Network Tab**
   - Screenshot of `/pdf.worker.min.mjs` request
   - Status code shown

3. **File Check**
   - Run: `Get-Item "public\pdf.worker.min.mjs" | Select-Object Length`
   - Share output

4. **Test Worker HTML**
   - Visit: `http://localhost:5173/test-worker.html`
   - Share what you see

5. **PDF File Info**
   - File size
   - Where it came from (created how?)
   - Can it open in Adobe Reader/browser normally?

---

## Quick Diagnostic Script

Run this in PowerShell to check everything:

```powershell
Write-Host "`n=== PDF.js Diagnostic ===" -ForegroundColor Cyan

# Check worker file
Write-Host "`nWorker File:" -ForegroundColor Yellow
if (Test-Path "public\pdf.worker.min.mjs") {
    $file = Get-Item "public\pdf.worker.min.mjs"
    Write-Host "  ✅ Exists: $($file.Length) bytes" -ForegroundColor Green
    Write-Host "  Modified: $($file.LastWriteTime)" -ForegroundColor Green
} else {
    Write-Host "  ❌ NOT FOUND!" -ForegroundColor Red
    Write-Host "  Run: Copy-Item 'node_modules\pdfjs-dist\build\pdf.worker.min.mjs' -Destination 'public\pdf.worker.min.mjs' -Force" -ForegroundColor Yellow
}

# Check node_modules
Write-Host "`nPDF.js Package:" -ForegroundColor Yellow
if (Test-Path "node_modules\pdfjs-dist") {
    $pkg = Get-Content "node_modules\pdfjs-dist\package.json" | ConvertFrom-Json
    Write-Host "  ✅ Installed: v$($pkg.version)" -ForegroundColor Green
} else {
    Write-Host "  ❌ NOT INSTALLED!" -ForegroundColor Red
    Write-Host "  Run: npm install pdfjs-dist" -ForegroundColor Yellow
}

# Check dev server
Write-Host "`nDev Server:" -ForegroundColor Yellow
$node = Get-Process -Name node -ErrorAction SilentlyContinue
if ($node) {
    Write-Host "  ✅ Running (PID: $($node.Id -join ', '))" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Not running" -ForegroundColor Yellow
    Write-Host "  Run: npm run dev" -ForegroundColor Yellow
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Visit: http://localhost:5173/test-worker.html"
Write-Host "2. Open browser DevTools (F12)"
Write-Host "3. Try viewing a PDF"
Write-Host "4. Check Console tab for errors"
Write-Host "`n"
```

---

## Success Checklist

When PDF viewing works, you should see:

- ✅ Worker test page shows green checkmark
- ✅ Console shows PDF loading logs
- ✅ Network tab shows worker file loaded (200)
- ✅ PDF renders in modal
- ✅ Zoom/rotate controls work
- ✅ No errors in console

---

**Run the diagnostic script above and share the results!** 🔍
