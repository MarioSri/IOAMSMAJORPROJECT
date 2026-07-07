# 🎨 Watermark Feature - Two-Column Layout Quick Reference

## 📐 **Visual Layout**

```
┌───────────────────────────────────────────────────────────────────┐
│                    WATERMARK FEATURE DIALOG                       │
│                      (max-w-7xl - Wide)                           │
├────────────────────────────┬──────────────────────────────────────┤
│                            │                                      │
│    LEFT COLUMN             │        RIGHT COLUMN                  │
│    Document Viewer         │        Watermark Settings            │
│                            │                                      │
│  ┌──────────────────────┐  │  ┌────────────────────────────────┐ │
│  │ 👁 Document Preview  │  │  │ 💧 Watermark Settings          │ │
│  │  [Prev] 1/3 [Next]   │  │  └────────────────────────────────┘ │
│  └──────────────────────┘  │                                      │
│                            │  ┌────────────────────────────────┐ │
│  ┌──────────────────────┐  │  │ Tab Navigation                 │ │
│  │ Zoom Controls        │  │  │ ○ Basic  ○ Style  ○ Preview   │ │
│  │ [+] [-] 100% [↻]    │  │  └────────────────────────────────┘ │
│  └──────────────────────┘  │                                      │
│                            │  ┌────────────────────────────────┐ │
│  ┌──────────────────────┐  │  │ Settings Content              │ │
│  │                      │  │  │ ┌──────────────────────────┐ │ │
│  │   PDF/Word/Excel     │  │  │ │ Watermark Text:         │ │ │
│  │   Document Preview   │  │  │ │ [CONFIDENTIAL________]  │ │ │
│  │                      │  │  │ └──────────────────────────┘ │ │
│  │   📄                 │  │  │                              │ │
│  │   Page 1             │  │  │ ┌──────────────────────────┐ │ │
│  │   ________________   │  │  │ │ Location: [Centered ▼]  │ │ │
│  │   Content here...    │  │  │ └──────────────────────────┘ │ │
│  │                      │  │  │                              │ │
│  │   📄                 │  │  │ ┌──────────────────────────┐ │ │
│  │   Page 2             │  │  │ │ Opacity: 30%  [─●───]   │ │ │
│  │   ________________   │  │  │ └──────────────────────────┘ │ │
│  │   Content here...    │  │  │                              │ │
│  │                      │  │  │ ┌──────────────────────────┐ │ │
│  │   📄                 │  │  │ │ Rotation: [297°]        │ │ │
│  │   Page 3             │  │  │ └──────────────────────────┘ │ │
│  │   ________________   │  │  │                              │ │
│  │   Content here...    │  │  │ ┌──────────────────────────┐ │ │
│  │                      │  │  │ │ Font: [Helvetica ▼]     │ │ │
│  │   ▼ Scroll more...   │  │  │ └──────────────────────────┘ │ │
│  │                      │  │  │                              │ │
│  └──────────────────────┘  │  │ ▼ Scroll for more options   │ │
│                            │  │                              │ │
│  Smooth vertical scroll    │  └────────────────────────────────┘ │
│  for long documents        │                                      │
│                            │  ┌────────────────────────────────┐ │
│                            │  │ [✓ Apply Watermark] [Cancel]   │ │
│                            │  └────────────────────────────────┘ │
│                            │                                      │
└────────────────────────────┴──────────────────────────────────────┘
```

---

## 🔑 **Key Features**

### **Left Column - Document Viewer:**
- ✅ **FileViewer Integration** - Same as Document Management
- ✅ **File Type Support** - PDF, Word, Excel, Images
- ✅ **Zoom Controls** - 50% to 200%
- ✅ **Rotate Controls** - 0°, 90°, 180°, 270°
- ✅ **Smooth Scroll** - Vertical scrolling for long documents
- ✅ **Multiple Files** - Navigation buttons if multiple files uploaded
- ✅ **Live Preview** - See document while configuring watermark

### **Right Column - Watermark Settings:**
- ✅ **Tab Navigation** - Basic, Style, Preview, Generate
- ✅ **Watermark Text** - Custom text input
- ✅ **Location** - Centered, Left, Right, Top, Bottom
- ✅ **Opacity** - Slider from 10% to 100%
- ✅ **Rotation** - Angle input
- ✅ **Font** - Helvetica, Arial, Times New Roman, etc.
- ✅ **Font Size** - Size slider
- ✅ **Color** - Color picker
- ✅ **Preview** - Live watermark preview
- ✅ **Generate Unique** - Auto-generate unique watermarks
- ✅ **Apply Button** - Apply watermark to document

---

## 📊 **Data Flow**

```
Upload Files                Pass Files              Display Files
    ↓                           ↓                        ↓
┌─────────────┐          ┌──────────────┐        ┌──────────────┐
│ Document    │  files→  │ Watermark    │  file→ │ FileViewer   │
│ Management  │──────────→ Feature      │────────→ Embedded     │
└─────────────┘          │ Component    │        │ (Left Col)   │
                         └──────────────┘        └──────────────┘
┌─────────────┐                 │
│ Emergency   │  files→         │                ┌──────────────┐
│ Management  │─────────────────┤                │ Watermark    │
└─────────────┘                 │                │ Settings     │
                                │                │ (Right Col)  │
┌─────────────┐                 │                └──────────────┘
│ Approval    │  files→         │
│ Routing     │─────────────────┘
└─────────────┘
```

---

## 🎯 **Implementation Checklist**

### **WatermarkFeature.tsx Changes:**
- [ ] Add `files?: File[]` to props interface
- [ ] Import FileViewer or create embedded version
- [ ] Add state: `viewingFile`, `currentFileIndex`
- [ ] Change Dialog `max-w-4xl` → `max-w-7xl`
- [ ] Replace layout with `grid grid-cols-2 gap-4`
- [ ] Add left column with document viewer
- [ ] Keep right column with watermark settings
- [ ] Add file navigation (Prev/Next buttons)
- [ ] Ensure scroll support in both columns

### **Parent Components Updates:**
- [ ] DocumentUploader.tsx → Pass `files={uploadedFiles}`
- [ ] EmergencyWorkflowInterface.tsx → Pass `files={emergencyData.uploadedFiles}`
- [ ] WorkflowConfiguration.tsx → Pass `files={uploadedFiles}`

### **Testing:**
- [ ] Upload PDF → Open Watermark → See preview on left
- [ ] Upload Word → Open Watermark → See preview on left
- [ ] Upload Excel → Open Watermark → See preview on left
- [ ] Test scroll with 10+ page PDF
- [ ] Test multiple files navigation
- [ ] Test zoom controls in left column
- [ ] Test rotate controls in left column
- [ ] Apply watermark and verify it works

---

## 💡 **Quick Tips**

### **Responsive Design:**
```typescript
// Left Column
<div className="col-span-1 h-full overflow-hidden">
  <Card className="h-full flex flex-col">
    <CardContent className="flex-1 overflow-y-auto">
      {/* Scrollable content */}
    </CardContent>
  </Card>
</div>
```

### **File Navigation:**
```typescript
{files && files.length > 1 && (
  <div className="flex gap-2">
    <Button onClick={goToPrevFile}>Previous</Button>
    <span>{currentFileIndex + 1} / {files.length}</span>
    <Button onClick={goToNextFile}>Next</Button>
  </div>
)}
```

### **Embedded FileViewer:**
```typescript
// Inline version (not modal)
const FileViewerEmbedded = ({ file }) => {
  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <ZoomControls />
        <RotateControls />
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {renderFileContent()}
      </div>
    </div>
  );
};
```

---

## 📝 **Summary**

**Two-Column Layout:**
- **Left (50%):** Document viewer with FileViewer integration
- **Right (50%):** Watermark settings (existing functionality)

**Benefits:**
- See document while configuring watermark
- Professional split-view interface
- Smooth scrolling for long documents
- Multiple file support with navigation
- Consistent with industry standards

**Technical:**
- Grid layout: `grid-cols-2`
- Both columns: Full height with scroll
- FileViewer: Embedded (non-modal) version
- Props: Pass files from parent components

---

For detailed implementation steps, see:
**WATERMARK_TWO_COLUMN_LAYOUT_EXPLANATION.md**
