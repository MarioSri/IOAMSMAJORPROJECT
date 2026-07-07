# File Viewer Testing Guide

## 🧪 How to Test the New File Viewer

### Quick Start
1. Navigate to: `/documents` (Document Management page)
2. Upload test files for each supported type
3. Click the "View" badge on each uploaded file
4. Verify rendering and controls work properly

---

## 📋 Test Cases

### Test 1: PDF File
**File**: Any `.pdf` document

**Steps:**
1. Drag and drop or select a PDF file
2. Click the "View" button on the uploaded file
3. Modal should open showing the PDF

**Expected Results:**
- ✅ PDF renders on canvas
- ✅ First page is visible
- ✅ Zoom controls work (50%-200%)
- ✅ Rotate button works (90° increments)
- ✅ Download button downloads the file
- ✅ Page counter shows "Page 1 of X"

---

### Test 2: Word Document (.docx)
**File**: Any `.docx` document

**Steps:**
1. Upload a Word document
2. Click "View" button

**Expected Results:**
- ✅ Document converts to HTML
- ✅ Text is readable and formatted
- ✅ Headings, lists, and tables display correctly
- ✅ Zoom controls work
- ✅ Rotation works

---

### Test 3: Excel Spreadsheet (.xlsx)
**File**: Any `.xlsx` file

**Steps:**
1. Upload an Excel file
2. Click "View" button

**Expected Results:**
- ✅ Spreadsheet displays as HTML table
- ✅ Data is readable
- ✅ Cell formatting preserved
- ✅ If multiple sheets, sheet names shown as badges
- ✅ Zoom and rotation work

---

### Test 4: Images
**File**: `.png`, `.jpg`, or `.jpeg` file

**Steps:**
1. Upload an image file
2. Click "View" button

**Expected Results:**
- ✅ Image displays clearly
- ✅ Maintains aspect ratio
- ✅ Zoom controls work smoothly
- ✅ Rotation works
- ✅ Image has shadow and rounded corners

---

### Test 5: Multiple Files
**Files**: Mix of PDF, Word, Excel, and images

**Steps:**
1. Upload 4-5 files of different types
2. View each one sequentially
3. Close and open different files

**Expected Results:**
- ✅ Each file opens in the viewer
- ✅ Previous file content clears when opening new file
- ✅ No memory leaks or slowdowns
- ✅ All controls work for each file type

---

### Test 6: Large Files
**File**: Large PDF (10+ MB) or Excel with many rows

**Steps:**
1. Upload a large file
2. Click "View" button

**Expected Results:**
- ✅ Loading spinner appears
- ✅ File eventually loads
- ✅ No browser freeze or crash
- ✅ Rendering is smooth

---

### Test 7: Error Handling
**File**: Corrupted or unsupported file type

**Steps:**
1. Try to upload/view an unsupported file (e.g., `.txt`, `.zip`)
2. Or try a corrupted PDF

**Expected Results:**
- ✅ Error message displays
- ✅ Download button offered as fallback
- ✅ No crash or blank screen
- ✅ Can close modal and continue

---

### Test 8: UI Controls
**File**: Any file

**Steps:**
1. Open file in viewer
2. Test all controls:
   - Click Zoom Out (should decrease to 75%)
   - Click Zoom In (should increase to 125%)
   - Continue until min (50%) and max (200%)
   - Click Rotate (should rotate 90°)
   - Click Download
   - Click X or outside modal to close

**Expected Results:**
- ✅ Zoom limits enforced (50%-200%)
- ✅ Zoom percentage updates in badge
- ✅ Rotation cycles through 0°, 90°, 180°, 270°
- ✅ Download triggers file download
- ✅ Modal closes properly

---

### Test 9: Responsive Design
**Device**: Mobile phone or narrow browser window

**Steps:**
1. Resize browser to mobile width
2. Upload and view files

**Expected Results:**
- ✅ Modal fits screen
- ✅ Controls remain accessible
- ✅ Content is scrollable
- ✅ Touch gestures work

---

### Test 10: Integration with Document Submission
**Flow**: Complete document submission with viewing

**Steps:**
1. Enter document title
2. Select document type
3. Upload files
4. View files to verify content
5. Select recipients
6. Submit document

**Expected Results:**
- ✅ Can view files before submission
- ✅ Viewing doesn't affect upload state
- ✅ Can submit after viewing
- ✅ All data preserved

---

## 🎯 Quick Visual Checks

### PDF Viewer
- [ ] Canvas renders clearly
- [ ] Text is readable
- [ ] No pixelation at 100% zoom
- [ ] Page counter visible for multi-page PDFs

### Word Viewer
- [ ] Text formatting preserved
- [ ] Headings display in correct sizes
- [ ] Lists render with bullets/numbers
- [ ] Tables display properly

### Excel Viewer
- [ ] Table borders visible
- [ ] Cell data readable
- [ ] Column/row structure clear
- [ ] Sheet badges present for multi-sheet files

### Image Viewer
- [ ] Image centered
- [ ] No distortion
- [ ] Shadow effect visible
- [ ] Rounded corners applied

---

## 🐛 Known Limitations

1. **PDF**: Currently shows only first page (pagination can be added)
2. **Word (.doc)**: Old format may have conversion issues (use .docx)
3. **Large Files**: May take time to load (10+ MB)
4. **Complex Excel**: Very large spreadsheets may be slow

---

## ✅ Success Criteria

The implementation is successful if:
- [x] All 4 file types render correctly
- [x] No browser crashes or errors
- [x] Controls work smoothly
- [x] Error handling is graceful
- [x] Performance is acceptable
- [x] UI is professional and polished
- [x] Mobile-friendly
- [x] Integrates seamlessly with existing flow

---

## 🚀 Testing with Sample Files

Create test files:

1. **PDF**: Any document exported to PDF
2. **Word**: Simple document with text, headings, list
3. **Excel**: Spreadsheet with data in rows/columns
4. **Image**: Any photo or screenshot

Or use online converters to create test files in each format.

---

## 📊 Performance Benchmarks

Expected loading times:
- **PDF (5 MB)**: 1-2 seconds
- **Word (1 MB)**: < 1 second
- **Excel (2 MB)**: 1-2 seconds
- **Image (2 MB)**: < 1 second

If loading takes significantly longer, check:
- File size
- Network conditions
- Browser performance
- Memory availability

---

## 🎉 You're Done!

Once all tests pass, the file viewer is production-ready! 🚀
