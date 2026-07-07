# 🎨 Watermark Feature Two-Column Layout - Quick Reference

## Visual Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                    Watermark Feature Modal                       │
│                      (max-w-7xl, 85vh)                          │
├─────────────────────────────┬────────────────────────────────────┤
│  LEFT COLUMN (50%)          │  RIGHT COLUMN (50%)                │
│  Document Preview           │  Watermark Settings                │
├─────────────────────────────┼────────────────────────────────────┤
│ 📄 Document Preview  [1/3]  │ 💧 Watermark Settings              │
│                             │                                    │
│ ┌─────────────────────────┐ │ ┌──────────────────────────────┐  │
│ │                         │ │ │ [Basic|Advanced|AI|Preview]  │  │
│ │   File Preview Area     │ │ ├──────────────────────────────┤  │
│ │                         │ │ │                              │  │
│ │   • Images: <img>       │ │ │   Tab Content (Scrollable)   │  │
│ │   • PDFs: <iframe>      │ │ │                              │  │
│ │   • Others: File info   │ │ │   • Text input               │  │
│ │                         │ │ │   • Location select          │  │
│ └─────────────────────────┘ │ │   • Opacity slider           │  │
│                             │ │   • Font controls            │  │
│ [◄ Previous] filename       │ │   • Color picker             │  │
│                    [Next ►] │ │   • Rotation slider          │  │
│                             │ │                              │  │
│                             │ ├──────────────────────────────┤  │
│                             │ │ [Apply Watermark] [Cancel]   │  │
│                             │ └──────────────────────────────┘  │
└─────────────────────────────┴────────────────────────────────────┘
```

---

## Key Props & State

### Props Interface
```typescript
interface WatermarkFeatureProps {
  isOpen: boolean;
  onClose: () => void;
  document: { id: string; title: string; content: string; type: string };
  user: { id: string; name: string; email: string; role: string };
  files?: File[];  // NEW - Array of uploaded files
}
```

### State Variables
```typescript
const [viewingFile, setViewingFile] = useState<File | null>(null);
const [currentFileIndex, setCurrentFileIndex] = useState(0);
const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
```

---

## File Preview Logic

### Supported File Types
- **Images**: PNG, JPG, JPEG → `<img>` tag preview
- **PDFs**: application/pdf → `<iframe>` preview
- **Others**: Show file name, size, type

### Preview Code
```typescript
{viewingFile && filePreviewUrl ? (
  <div className="h-full flex items-center justify-center p-4">
    {viewingFile.type.startsWith('image/') ? (
      <img src={filePreviewUrl} alt={viewingFile.name} />
    ) : viewingFile.type === 'application/pdf' ? (
      <iframe src={filePreviewUrl} className="w-full h-full" />
    ) : (
      <div className="text-center">
        <FileText className="h-16 w-16" />
        <p>{viewingFile.name}</p>
        <p>{(viewingFile.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>
    )}
  </div>
) : (
  <div className="text-center">No document selected</div>
)}
```

---

## Navigation Controls

### Previous Button
```typescript
<Button
  onClick={() => {
    const newIndex = Math.max(0, currentFileIndex - 1);
    setCurrentFileIndex(newIndex);
    setViewingFile(files[newIndex]);
  }}
  disabled={currentFileIndex === 0}
>
  <ChevronLeft className="h-4 w-4 mr-1" />
  Previous
</Button>
```

### Next Button
```typescript
<Button
  onClick={() => {
    const newIndex = Math.min(files.length - 1, currentFileIndex + 1);
    setCurrentFileIndex(newIndex);
    setViewingFile(files[newIndex]);
  }}
  disabled={currentFileIndex === files.length - 1}
>
  Next
  <ChevronRight className="h-4 w-4 ml-1" />
</Button>
```

### File Counter Badge
```typescript
{files && files.length > 0 && (
  <Badge variant="secondary">
    {currentFileIndex + 1} / {files.length}
  </Badge>
)}
```

---

## Parent Component Integration

### DocumentUploader.tsx
```typescript
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{ /* ... */ }}
  user={{ /* ... */ }}
  files={uploadedFiles}  // Pass uploaded files array
/>
```

### EmergencyWorkflowInterface.tsx
```typescript
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{ /* ... */ }}
  user={{ /* ... */ }}
  files={emergencyData.uploadedFiles}  // Pass emergency files
/>
```

### WorkflowConfiguration.tsx
```typescript
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{ /* ... */ }}
  user={{ /* ... */ }}
  files={uploadedFiles}  // Pass bypass files
/>
```

---

## Effects & Lifecycle

### Initialize First File
```typescript
useEffect(() => {
  if (files && files.length > 0) {
    setViewingFile(files[0]);
    setCurrentFileIndex(0);
  } else {
    setViewingFile(null);
    setCurrentFileIndex(0);
  }
}, [files]);
```

### Create Object URL
```typescript
useEffect(() => {
  if (!viewingFile) {
    setFilePreviewUrl(null);
    return;
  }

  const url = URL.createObjectURL(viewingFile);
  setFilePreviewUrl(url);

  // Cleanup
  return () => {
    URL.revokeObjectURL(url);
  };
}, [viewingFile]);
```

---

## Grid Layout Classes

### Dialog Container
```typescript
className="max-w-7xl max-h-[90vh] p-0 bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden"
```

### Two-Column Grid
```typescript
className="grid grid-cols-2 gap-4 p-6 h-full"
```

### Column Cards
```typescript
className="flex-1 shadow-lg border-0 bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col"
```

---

## Quick Testing

1. **Upload Files**: Go to Document Management → Upload 2-3 files (mix of images and PDFs)
2. **Open Watermark**: Click "Add Watermark" button
3. **Verify Layout**: Check two-column split-view appears
4. **Test Navigation**: Click Previous/Next to cycle through files
5. **Check Preview**: Verify images and PDFs display correctly
6. **Test Settings**: Configure watermark in right column
7. **Apply**: Click "Apply Watermark" and verify submission

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Files not showing | Verify parent component passes `files` prop |
| Navigation disabled | Check `files.length > 1` condition |
| Preview not loading | Ensure Object URL created correctly |
| Layout broken | Verify `grid-cols-2` class on container |
| Modal too narrow | Check `max-w-7xl` on DialogContent |

---

## Class Reference

### Tailwind Classes Used
- `grid-cols-2` - Two equal columns
- `max-w-7xl` - Extra wide modal (1280px)
- `h-[85vh]` - 85% viewport height
- `overflow-y-auto` - Vertical scroll
- `backdrop-blur-sm` - Glassmorphism effect
- `shadow-lg` - Large shadow
- `rounded-lg` - Large border radius

---

## Files Modified

1. ✅ `src/components/WatermarkFeature.tsx` - Core layout
2. ✅ `src/components/DocumentUploader.tsx` - Added files prop
3. ✅ `src/components/EmergencyWorkflowInterface.tsx` - Added files prop
4. ✅ `src/components/WorkflowConfiguration.tsx` - Added files prop

---

**Status**: ✅ Complete & Ready for Testing  
**Documentation**: See `WATERMARK_TWO_COLUMN_IMPLEMENTATION_COMPLETE.md`
