# 🧪 Documenso Multi-Page Signature - Quick Test Guide

## ⚡ Quick Test (5 Minutes)

### **Test 1: Multi-Page PDF Signing**

1. **Open Documenso Integration**
   - Navigate to Approvals page
   - Click "Sign Document" on any approval card

2. **Upload Multi-Page PDF**
   - Click "Browse Files"
   - Upload a 3+ page PDF document
   - Wait for pages to load

3. **Verify Page Navigation**
   - ✅ Check for page controls: `◀ Page 1 / X ▶`
   - ✅ Click "Next Page" button
   - ✅ Verify page counter updates (e.g., Page 2 / 5)
   - ✅ Verify document scrolls to Page 2

4. **Sign Page 1**
   - Click "Previous Page" to return to Page 1
   - Select "Draw Signature" method
   - Draw a signature on the canvas
   - Click "Save & Place"
   - ✅ Verify signature appears on Page 1

5. **Navigate to Page 2**
   - Click "Next Page"
   - ✅ **CRITICAL**: Verify Page 1 signature is NOT visible on Page 2

6. **Sign Page 2**
   - Select "Phone Camera" method
   - Capture a signature via camera
   - Click "Place on Document"
   - ✅ Verify signature appears on Page 2

7. **Navigate to Page 3**
   - Click "Next Page"
   - ✅ Verify Page 1 signature NOT visible
   - ✅ Verify Page 2 signature NOT visible

8. **Sign Page 3 (Multiple Signatures)**
   - Select "Upload Image" method
   - Upload a signature image file
   - ✅ Verify first signature placed
   - Upload another signature image
   - ✅ Verify second signature placed on same page
   - ✅ Verify both signatures visible and independent

9. **Navigate Back to Page 1**
   - Click "Previous Page" twice
   - ✅ **CRITICAL**: Verify original Page 1 signature still there
   - ✅ Verify position unchanged

10. **Complete Signing**
    - Click "Sign Document" button
    - Wait for processing
    - ✅ Verify success message
    - ✅ Download signed document
    - ✅ Open in PDF viewer
    - ✅ Verify:
      - Page 1 has 1 signature
      - Page 2 has 1 signature
      - Page 3 has 2 signatures
      - Other pages have 0 signatures

---

## 📋 Expected Results

### ✅ **Page Isolation**
- Signatures on Page 1 should NOT appear on Page 2, 3, etc.
- Each page only shows its own signatures

### ✅ **Multiple Signatures Per Page**
- You can place unlimited signatures on any page
- Each signature can be moved, resized, rotated independently

### ✅ **Position Preservation**
- Navigating away from a page and back preserves all signatures
- Positions, sizes, and rotations remain unchanged

### ✅ **All Signature Methods Work**
- Draw signature ✅
- Camera capture ✅
- Upload image ✅

### ✅ **Final Merged Document**
- Each page contains only its designated signatures
- No spillover or duplication
- Professional, clean output

---

## 🚨 Critical Test Cases

### **Test Case 1: No Spillover**
**Action**: Sign Page 1, navigate to Page 2
**Expected**: Page 1 signature NOT visible on Page 2 ✅

### **Test Case 2: Position Preservation**
**Action**: Sign Page 1, navigate to Page 3, return to Page 1
**Expected**: Page 1 signature still in original position ✅

### **Test Case 3: Multiple Signatures**
**Action**: Place 3 signatures on same page
**Expected**: All 3 visible, movable, independent ✅

### **Test Case 4: Final Merge**
**Action**: Sign different pages, complete signing
**Expected**: Each page has only its signatures in final PDF ✅

---

## 📝 Browser Console Logs

Look for these console messages during testing:

### **Signature Placement**
```
🎨 Placing signature on document: {
  position: { x: 100, y: 300 },
  pageNumber: 1,
  fileType: "pdf"
}
```

### **Page Processing**
```
📄 Processing page 1: 1 signature(s) to merge
📄 Processing page 2: 1 signature(s) to merge
📄 Processing page 3: 2 signature(s) to merge
```

### **Signature Array Update**
```
📝 Updated signatures array - Total signatures: 4
  Signature 1: x=100, y=300, page=1
  Signature 2: x=150, y=250, page=2
  Signature 3: x=200, y=200, page=3
  Signature 4: x=250, y=150, page=3
```

---

## 🔍 Visual Verification

### **Page Navigation Controls**
Should see in toolbar:
```
[🔍-] 100% [🔍+] [🔄] | [◀] Page 2 / 5 [▶] | 5 pages
```

### **Signature on Page**
When signature placed:
- ✅ Blue border when selected
- ✅ Control buttons (Rotate, Delete, Drag)
- ✅ Resize handles on corners
- ✅ Signature image visible

### **Page Badge**
Each page should show:
```
Page 1 of 5  [in top-right corner]
```

---

## 🐛 Troubleshooting

### **Issue**: Signature appears on all pages
**Cause**: Filter not working
**Fix**: Check browser console for errors

### **Issue**: Signature disappears when navigating
**Cause**: Page number not being stored
**Fix**: Verify console log shows `pageNumber: X`

### **Issue**: Can't place signature
**Cause**: Current page tracking error
**Fix**: Refresh page, try again

### **Issue**: Final PDF missing signatures
**Cause**: Merge filter issue
**Fix**: Check console for "Processing page X" messages

---

## ✅ Success Criteria

### **All Must Pass:**
1. ✅ Multi-page PDF loads with page navigation
2. ✅ Page navigation changes current page
3. ✅ Signatures only appear on their designated page
4. ✅ Multiple signatures can be placed on one page
5. ✅ All signature methods work (draw, camera, upload)
6. ✅ Navigating preserves signature positions
7. ✅ Final merged PDF has signatures on correct pages only
8. ✅ No spillover or cross-page contamination

---

## 🎉 Test Complete!

If all test cases pass, the multi-page signature system is working correctly!

**Ready for production use with:**
- 📄 Multi-page contracts
- 📋 Legal documents  
- 📑 Reports and proposals
- 📝 Approval workflows
- 🏢 Enterprise document management
