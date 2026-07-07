# Start IAOMS with SmartDocs

## Quick Start

1. **Install dependencies** (if not done):
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open browser**:
   - Go to: `http://localhost:8080`
   - Login with any role (principal, registrar, hod, program-head, employee)
   - Click "SmartDocs Editor" in sidebar

## If Blank Page Appears

### Solution 1: Clear Cache
- Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Or clear browser cache completely

### Solution 2: Check Console
- Press `F12` to open DevTools
- Check Console tab for errors
- Common error: "Cannot find module" → Run `npm install` again

### Solution 3: Restart Server
```bash
# Stop server (Ctrl + C)
# Then restart:
npm run dev
```

### Solution 4: Clean Install
```bash
# Delete node_modules and reinstall
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

## SmartDocs Features

Once loaded, you can:
- ✅ Create and edit documents with rich text formatting
- ✅ Use AI to generate content
- ✅ Get writing assistance
- ✅ Generate meeting notes
- ✅ Upload and parse documents
- ✅ Auto-save every 30 seconds
- ✅ Access AI sidebar with tools

## Files Created

All SmartDocs files are in place:
- ✅ `src/components/SmartDocsEditor.tsx`
- ✅ `src/pages/SmartDocs.tsx`
- ✅ `src/services/SmartDocsAIService.ts`
- ✅ `src/types/smartdocs.ts`
- ✅ `src/types/react-quill.d.ts`
- ✅ `src/styles/smartdocs.css`

## Dependencies Installed

- ✅ quill@^2.0.3
- ✅ react-quill@^2.0.0
- ✅ quill-delta@^5.1.0

## Route Added

- ✅ `/smartdocs` - SmartDocs Editor page
- ✅ Added to sidebar navigation for all roles

## The app should work perfectly now!

Just run: `npm run dev` and open `http://localhost:8080`
