# 📄 Watermark Feature Page - Two-Column Layout Explanation

## 🎯 **Overview**

The Watermark Feature Page needs to be reorganized into a **two-column split-view layout**:
- **Left Column:** Document Viewer (with FileViewer integration)
- **Right Column:** Watermark Settings (existing functionality)

When users upload files from Document Management, Emergency Management, or Approval Routing pages, the uploaded documents should appear in the left column for preview.

---

## 📐 **Current vs Proposed Layout**

### **Current Layout:**
```
┌─────────────────────────────────────────┐
│        Dialog (max-w-4xl)               │
│  ┌───────────────────────────────────┐  │
│  │   Watermark Settings              │  │
│  │   - Tab Navigation                │  │
│  │   - Basic Settings                │  │
│  │   - Style Options                 │  │
│  │   - Preview & Apply               │  │
│  │   - Generate Unique               │  │
│  │   - Action Buttons                │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### **Proposed Layout:**
```
┌─────────────────────────────────────────────────────────┐
│        Dialog (max-w-7xl) - Two Column Grid            │
│  ┌──────────────────────┬──────────────────────────┐   │
│  │  LEFT COLUMN         │  RIGHT COLUMN            │   │
│  │  Document Viewer     │  Watermark Settings      │   │
│  │                      │                          │   │
│  │  ┌────────────────┐  │  ┌──────────────────┐   │   │
│  │  │ FileViewer     │  │  │ Tab Navigation   │   │   │
│  │  │ Integration    │  │  │ - Basic Settings │   │   │
│  │  │                │  │  │ - Style Options  │   │   │
│  │  │ - PDF Preview  │  │  │ - Generate       │   │   │
│  │  │ - Word Preview │  │  │                  │   │   │
│  │  │ - Excel Preview│  │  │ Controls:        │   │   │
│  │  │ - Image Preview│  │  │ - Text           │   │   │
│  │  │                │  │  │ - Location       │   │   │
│  │  │ - Zoom         │  │  │ - Opacity        │   │   │
│  │  │ - Rotate       │  │  │ - Rotation       │   │   │
│  │  │ - Scroll       │  │  │ - Font           │   │   │
│  │  │                │  │  │ - Size           │   │   │
│  │  └────────────────┘  │  │ - Color          │   │   │
│  │                      │  │                  │   │   │
│  │  Smooth scroll       │  │ Action Buttons:  │   │   │
│  │  for long docs       │  │ - Apply          │   │   │
│  │                      │  │ - Cancel         │   │   │
│  │                      │  └──────────────────┘   │   │
│  └──────────────────────┴──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ **Implementation Architecture**

### **Component Structure:**

```typescript
WatermarkFeature.tsx (Modified)
├── Props
│   ├── isOpen: boolean
│   ├── onClose: () => void
│   ├── document: { id, title, content, type }
│   ├── user: { id, name, email, role }
│   └── files: File[]  // NEW - Array of uploaded files
│
├── State
│   ├── Existing watermark settings state
│   ├── viewingFile: File | null  // NEW
│   └── currentFileIndex: number  // NEW
│
└── Layout
    ├── Dialog (max-w-7xl)
    └── DialogContent
        └── Grid (grid-cols-2)
            ├── Left Column (col-span-1)
            │   └── FileViewer Component
            │       ├── PDF rendering (PDF.js)
            │       ├── Word rendering (Mammoth.js)
            │       ├── Excel rendering (SheetJS)
            │       ├── Image rendering (Native)
            │       ├── Zoom controls
            │       ├── Rotate controls
            │       └── Scroll support
            │
            └── Right Column (col-span-1)
                ├── DialogHeader
                ├── Tab Navigation
                ├── Tab Content (scrollable)
                │   ├── Basic Settings
                │   ├── Style Options
                │   ├── Preview (with watermark overlay)
                │   └── Generate Unique
                └── Action Buttons
```

---

## 📦 **Required Changes**

### **1. Update WatermarkFeature Props**

```typescript
interface WatermarkFeatureProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    content: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  files?: File[];  // NEW - Optional array of uploaded files
}
```

**Why:** Need to pass uploaded files from parent components.

---

### **2. Add FileViewer Import and State**

```typescript
import { FileViewer } from '@/components/FileViewer';

export const WatermarkFeature: React.FC<WatermarkFeatureProps> = ({
  isOpen,
  onClose,
  document,
  user,
  files = []  // NEW - Default to empty array
}) => {
  // Existing state...
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  // ... other watermark settings
  
  // NEW state for file viewing
  const [viewingFile, setViewingFile] = useState<File | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  // Set initial viewing file when files prop changes
  useEffect(() => {
    if (files && files.length > 0) {
      setViewingFile(files[0]);
      setCurrentFileIndex(0);
    }
  }, [files]);
```

**Why:** Track which file is currently being previewed.

---

### **3. Modify Dialog Layout to Two Columns**

```typescript
return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-7xl max-h-[90vh] p-0 bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden">
      <div className="h-[85vh]">
        {/* Two Column Grid Layout */}
        <div className="grid grid-cols-2 gap-4 p-6 h-full">
          
          {/* LEFT COLUMN - Document Viewer */}
          <div className="col-span-1 h-full overflow-hidden">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm h-full flex flex-col">
              <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Document Preview
                  </h3>
                  {files && files.length > 1 && (
                    <div className="flex gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const prevIndex = currentFileIndex > 0 ? currentFileIndex - 1 : files.length - 1;
                          setCurrentFileIndex(prevIndex);
                          setViewingFile(files[prevIndex]);
                        }}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentFileIndex + 1} / {files.length}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const nextIndex = (currentFileIndex + 1) % files.length;
                          setCurrentFileIndex(nextIndex);
                          setViewingFile(files[nextIndex]);
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>

                {/* FileViewer Integration with Scroll */}
                <div className="flex-1 overflow-y-auto">
                  {viewingFile ? (
                    <FileViewerEmbedded file={viewingFile} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p>No document uploaded</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - Watermark Settings */}
          <div className="col-span-1 h-full overflow-hidden">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm h-full flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col overflow-hidden">
                <DialogHeader className="mb-4 flex-shrink-0">
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Droplets className="h-6 w-6 text-blue-600" />
                    Watermark Settings
                  </DialogTitle>
                </DialogHeader>

                {/* Tab Navigation */}
                <div className="mb-6 flex-shrink-0">
                  <div className="bg-gray-100 rounded-full p-1 flex">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all flex-1 text-center ${
                          activeTab === tab.id
                            ? 'bg-black text-white'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                  {renderTabContent()}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 pt-4 border-t flex-shrink-0">
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={isLocked && !generatedStyle}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Apply Watermark
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
```

**Changes:**
- Dialog width: `max-w-4xl` → `max-w-7xl` (wider to accommodate two columns)
- Added `grid grid-cols-2 gap-4` layout
- Left column: Document viewer with FileViewer
- Right column: Existing watermark settings (unchanged logic)

---

### **4. Create Embedded FileViewer Component**

Since FileViewer is currently a modal dialog, we need an embedded version:

```typescript
// New component within WatermarkFeature.tsx or as separate file
interface FileViewerEmbeddedProps {
  file: File;
}

const FileViewerEmbedded: React.FC<FileViewerEmbeddedProps> = ({ file }) => {
  const [fileType, setFileType] = useState<FileType>('unsupported');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Same file loading logic as FileViewer
  // But render inline instead of in modal

  return (
    <div className="h-full flex flex-col">
      {/* Zoom and Rotate Controls */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <Button size="sm" variant="outline" onClick={() => setZoom(prev => Math.min(prev + 25, 200))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setZoom(prev => Math.max(prev - 25, 50))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Badge variant="secondary" className="text-xs">{zoom}%</Badge>
        <Button size="sm" variant="outline" onClick={() => setRotation(prev => (prev + 90) % 360)}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Document Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {loading && <LoadingSpinner />}
        {error && <ErrorDisplay message={error} />}
        {content && renderContent()}
      </div>
    </div>
  );
};
```

**Why:** Need inline version of FileViewer, not modal popup.

---

### **5. Update Parent Components to Pass Files**

#### **Document Management (DocumentUploader.tsx):**

```typescript
// Current
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{...}}
  user={{...}}
/>

// Updated
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{...}}
  user={{...}}
  files={uploadedFiles}  // NEW - Pass uploaded files
/>
```

#### **Emergency Management (EmergencyWorkflowInterface.tsx):**

```typescript
// Current
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{...}}
  user={{...}}
/>

// Updated
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{...}}
  user={{...}}
  files={emergencyData.uploadedFiles}  // NEW - Pass uploaded files
/>
```

#### **Approval Routing (WorkflowConfiguration.tsx):**

```typescript
// Current
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{...}}
  user={{...}}
/>

// Updated
<WatermarkFeature
  isOpen={showWatermarkModal}
  onClose={() => setShowWatermarkModal(false)}
  document={{...}}
  user={{...}}
  files={uploadedFiles}  // NEW - Pass uploaded files
/>
```

---

## 🎨 **UI/UX Consistency**

### **Left Column Styling:**
```typescript
className="col-span-1 h-full overflow-hidden"
  └── Card
      └── CardContent (p-4)
          ├── Header (flex items-center justify-between mb-4)
          │   ├── Title with Eye icon
          │   └── Navigation buttons (if multiple files)
          └── Content (flex-1 overflow-y-auto)
              └── FileViewerEmbedded or Empty State
```

### **Right Column Styling:**
```typescript
className="col-span-1 h-full overflow-hidden"
  └── Card
      └── CardContent (p-6)
          ├── DialogHeader (mb-4 flex-shrink-0)
          ├── Tab Navigation (mb-6 flex-shrink-0)
          ├── Tab Content (flex-1 overflow-y-auto)
          └── Action Buttons (mt-6 pt-4 border-t flex-shrink-0)
```

### **Visual Consistency:**
- Both columns: Same `Card` component with `shadow-lg border-0 bg-white/80 backdrop-blur-sm`
- Both columns: Same height (`h-full`)
- Both columns: Flexible layout with scrollable content areas
- Gap between columns: `gap-4`

---

## 📜 **Scroll Support**

### **Left Column (Document Viewer):**
```typescript
<div className="flex-1 overflow-y-auto">
  {/* Scrollable content */}
  <FileViewerEmbedded file={viewingFile} />
</div>
```

- Parent container: `flex-1` (takes remaining space)
- Scroll container: `overflow-y-auto` (vertical scroll when needed)
- Content: Renders full document (PDF all pages, Word full content, etc.)

### **Right Column (Watermark Settings):**
```typescript
<div className="flex-1 overflow-y-auto">
  {/* Scrollable watermark settings */}
  {renderTabContent()}
</div>
```

- Parent container: `flex-1` (takes remaining space)
- Scroll container: `overflow-y-auto` (vertical scroll when needed)
- Content: Tab content with all watermark settings

---

## 🔄 **Data Flow**

```
┌─────────────────────────────────────────┐
│  Document Management Page               │
│  - User uploads files                   │
│  - Files stored in uploadedFiles[]      │
│  - Click "Watermark" button             │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  WatermarkFeature Component             │
│  Props: { files: uploadedFiles }        │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┐
         ↓           ↓
┌────────────┐  ┌───────────────┐
│ Left Col   │  │ Right Col     │
│ Document   │  │ Watermark     │
│ Viewer     │  │ Settings      │
│            │  │               │
│ FileViewer │  │ - Text        │
│ Embedded   │  │ - Style       │
│ - PDF      │  │ - Preview     │
│ - Word     │  │ - Generate    │
│ - Excel    │  │               │
│ - Image    │  │ Apply Button  │
└────────────┘  └───────────────┘
```

---

## 📋 **Implementation Steps**

### **Step 1: Modify WatermarkFeature.tsx**
1. Add `files?: File[]` to props interface
2. Import FileViewer or create embedded version
3. Add state: `viewingFile`, `currentFileIndex`
4. Add useEffect to set initial file
5. Change Dialog width: `max-w-7xl`
6. Replace single column with `grid grid-cols-2 gap-4`
7. Add left column with FileViewerEmbedded
8. Keep right column with existing settings
9. Add file navigation buttons (if multiple files)

### **Step 2: Create FileViewerEmbedded Component**
1. Extract rendering logic from FileViewer.tsx
2. Remove modal wrapper
3. Render inline with scroll support
4. Add zoom/rotate controls at top
5. Ensure proper height management

### **Step 3: Update Parent Components**
1. DocumentUploader.tsx - Pass `files={uploadedFiles}`
2. EmergencyWorkflowInterface.tsx - Pass `files={emergencyData.uploadedFiles}`
3. WorkflowConfiguration.tsx - Pass `files={uploadedFiles}`

### **Step 4: Test Integration**
1. Upload PDF in Document Management → Open Watermark → See preview on left
2. Upload Word in Emergency Management → Open Watermark → See preview on left
3. Upload Excel in Approval Routing → Open Watermark → See preview on left
4. Test scroll with long documents
5. Test file navigation with multiple files
6. Verify watermark settings still work on right

---

## ✅ **Expected Results**

### **After Implementation:**

1. **Upload files** in any page (Document Management, Emergency, Approval)
2. **Click Watermark button**
3. **Watermark dialog opens** with two columns:
   - **Left:** Full document preview with scroll
   - **Right:** Watermark settings (unchanged)
4. **User can:**
   - View document while configuring watermark
   - Navigate between multiple files (if uploaded multiple)
   - Zoom and rotate document
   - Scroll through long documents
   - Configure watermark settings
   - See live preview (in right column)
   - Apply watermark

---

## 🎯 **Benefits**

1. **Better UX:** See document while configuring watermark
2. **No Context Switching:** Don't need to close dialog to view document
3. **Live Preview:** Preview on right shows how watermark will look
4. **Multiple Files:** Easy navigation between uploaded files
5. **Consistent Experience:** Same FileViewer as other pages
6. **Professional Layout:** Split-view like industry-standard tools

---

## 📝 **Summary**

The Watermark Feature Page will have a **professional two-column layout**:

- **Left:** Document Viewer (FileViewer integration with scroll)
- **Right:** Watermark Settings (existing functionality)

Files uploaded from any page (Document Management, Emergency, Approval) will be passed to WatermarkFeature and displayed in the left column for preview while user configures watermark settings on the right.

**Key Technical Changes:**
1. Add `files` prop to WatermarkFeature
2. Create embedded FileViewer (non-modal)
3. Change layout from single column to `grid grid-cols-2`
4. Update all parent components to pass files
5. Add file navigation for multiple files
6. Ensure scroll support in both columns

**This creates a seamless, professional watermark experience! 🎉**
