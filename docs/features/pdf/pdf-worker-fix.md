# PDF.js Worker Setup Fix

## Issue
PDF.js needs a worker file to render PDFs. The CDN approach may fail due to CORS or network issues.

## Current Solution
Updated `FileViewer.tsx` to use **unpkg.com CDN** which is more reliable:
```tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
```

## Alternative Solutions

### Option 1: Use Local Worker (Recommended for Production)

1. **Copy worker file to public directory:**
```bash
# Windows PowerShell
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.js" -Destination "public\pdf.worker.min.js"

# Linux/Mac
cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/pdf.worker.min.js
```

2. **Update FileViewer.tsx:**
```tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

### Option 2: Use Vite to Handle Worker

1. **Install vite-plugin-static-copy:**
```bash
npm install vite-plugin-static-copy --save-dev
```

2. **Update vite.config.ts:**
```typescript
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
          dest: 'assets'
        }
      ]
    })
  ]
});
```

3. **Update FileViewer.tsx:**
```tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';
```

### Option 3: Dynamic Import (Current Implementation)

Using unpkg.com CDN (already implemented):
```tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
```

**Pros:**
- No build configuration needed
- Works immediately
- Automatically uses correct version

**Cons:**
- Requires internet connection
- Potential CORS issues in some environments
- Slower initial load

## Troubleshooting

### Error: "Failed to fetch dynamically imported module"

**Cause:** CDN blocked, CORS issue, or network problem

**Solution:**
1. Use local worker file (Option 1)
2. Check browser console for specific error
3. Verify network connectivity
4. Try different CDN:
   ```tsx
   // jsdelivr CDN
   pdfjsLib.GlobalWorkerOptions.workerSrc = 
     `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
   
   // unpkg CDN (current)
   pdfjsLib.GlobalWorkerOptions.workerSrc = 
     `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
   ```

### Error: "Worker was destroyed"

**Cause:** Worker initialization failed

**Solution:**
1. Clear browser cache
2. Restart development server
3. Use local worker file

### Error: "Cannot read properties of undefined"

**Cause:** PDF.js not properly initialized

**Solution:**
1. Ensure pdfjs-dist is installed: `npm install pdfjs-dist`
2. Check import statement
3. Verify worker URL is accessible

## Quick Fix Command

Run this to set up local worker (recommended):

```bash
# Windows PowerShell
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.js" -Destination "public\pdf.worker.min.js"
```

Then update `FileViewer.tsx` line 9:
```tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

## Current Status

✅ Updated to use unpkg.com CDN  
✅ Added better error handling  
✅ Added error messages for debugging  

**Should work now!** Try uploading a PDF file and clicking View.

If issues persist, use the local worker option (Option 1) for guaranteed reliability.
