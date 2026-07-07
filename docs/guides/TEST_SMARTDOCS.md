# SmartDocs Troubleshooting

## If you see a blank page, follow these steps:

### 1. Check Browser Console
Open browser DevTools (F12) and check the Console tab for errors.

### 2. Common Issues:

**Issue: Module not found errors**
- Run: `npm install`
- Then: `npm run dev`

**Issue: ReactQuill errors**
- The component uses react-quill which requires proper installation
- Already installed via: `npm install quill react-quill quill-delta`

**Issue: CSS import errors**
- Custom CSS is at: `src/styles/smartdocs.css`
- Imported in component as: `import '../styles/smartdocs.css'`

### 3. Test Without SmartDocs

If the entire app is blank, temporarily comment out SmartDocs route in `src/App.tsx`:

```tsx
// <Route path="/smartdocs" element={
//   <ProtectedRoute>
//     <SmartDocs />
//   </ProtectedRoute>
// } />
```

### 4. Access SmartDocs

Once app is running:
1. Login with any role
2. Navigate to sidebar
3. Click "SmartDocs Editor"
4. Or go directly to: `http://localhost:8080/smartdocs`

### 5. Files Created

- `src/types/smartdocs.ts` - Type definitions
- `src/services/SmartDocsAIService.ts` - AI service
- `src/components/SmartDocsEditor.tsx` - Main editor
- `src/pages/SmartDocs.tsx` - Page component
- `src/styles/smartdocs.css` - Custom styles
- `src/types/react-quill.d.ts` - Type declarations

### 6. Dependencies Added

```json
"quill": "latest",
"react-quill": "latest",
"quill-delta": "latest"
```

### 7. Quick Fix

If blank page persists, run:
```bash
npm install
npm run dev
```

Then open: http://localhost:8080
