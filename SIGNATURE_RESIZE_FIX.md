# Signature Box Resize Behavior Fix

## Problem
The signature box was stretching into tall vertical rectangles during resize, causing:
- Distorted and compressed signature appearance
- Poor alignment within the field
- Unintuitive and unusable resizing experience

## Solution Implemented

### 1. Aspect Ratio Constraints
Added strict aspect ratio limits to prevent vertical stretching:

```typescript
const MAX_ASPECT_RATIO = 0.6;  // height / width ≤ 0.6 (e.g., 200×120px)
const MIN_ASPECT_RATIO = 0.2;  // height / width ≥ 0.2 (e.g., 200×40px)
```

This ensures:
- Height can be at most 60% of width (prevents tall rectangles)
- Height must be at least 20% of width (prevents overly flat boxes)
- Maintains professional horizontal signature orientation

### 2. Enhanced Minimum Width
Increased minimum width threshold from 5% to 8% of page width:

```typescript
const MIN_W = 0.08;  // 8% of page width minimum
```

This prevents signatures from becoming too narrow to be usable.

### 3. Constrained Resize Logic
Updated all four corner resize handlers (tl, tr, bl, br) to:
- Apply aspect ratio constraints during resize
- Prioritize width scaling over height
- Maintain horizontal orientation at all times

### 4. Initial Placement Constraints
Applied aspect ratio limits when signatures are first placed:

```typescript
let aspectRatio = widthPercent > 0 ? heightPercent / widthPercent : 0.4;
aspectRatio = Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, aspectRatio));
```

This ensures even newly placed signatures start with proper proportions.

### 5. Safety Check
Added final validation after resize calculations:

```typescript
if (lockAspect && nH > nW * MAX_ASPECT_RATIO) {
  nH = nW * MAX_ASPECT_RATIO;
}
```

This catches any edge cases where the aspect ratio might exceed limits.

## File Modified
- `IAOMS-MAIN/src/components/documents/signature/useSignatureEngine.ts`

## Compatibility
This fix works consistently across all supported formats:
- ✅ PDF files
- ✅ Images (PNG, JPG)
- ✅ DOCX files
- ✅ Spreadsheets
- ✅ Google Docs exports
- ✅ Long documents with scrollable content

## Technical Details

### Aspect Ratio Locking
Only applies to image-type fields (signature, stamp, initials, image).
Text fields (date, name, text, etc.) resize freely without constraints.

### Coordinate System
Uses percentage-based positioning relative to document dimensions, ensuring:
- Consistent behavior across different zoom levels
- Proper scaling on different screen sizes
- Accurate positioning on scrolled/multi-page documents

## Result
Users now experience:
- Smooth, natural, and proportional resizing
- Professional horizontal signature layout
- Consistent appearance across all document types
- Intuitive drag-resize behavior similar to modern e-signature platforms
