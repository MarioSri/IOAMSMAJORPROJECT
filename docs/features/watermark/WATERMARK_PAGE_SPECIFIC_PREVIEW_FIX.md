# Watermark Preview Page-Specific Fix

## Issue Fixed ✅
**Date:** October 22, 2025  
**File:** `src/components/WatermarkFeature.tsx`

### Problem
When a user specified a particular page to watermark (e.g., "1" or "5"), the watermark preview was showing on **ALL pages** in the document viewer, not just the specified page(s).

**Example:**
- User enters: `5` (only page 5)
- Expected: Watermark preview shows only on page 5
- Actual (before fix): Watermark preview shows on ALL pages ❌

---

## Root Cause

The `WatermarkOverlay` component was being rendered on every PDF page without checking if that specific page was included in the `pageRange`. The component had no awareness of which page it was being displayed on.

```typescript
// BEFORE (Broken)
<WatermarkOverlay />  // Always rendered on every page
```

---

## Solution Implemented

### 1. Updated WatermarkOverlay Component

Added `pageNumber` parameter to the component and page range validation:

```typescript
const WatermarkOverlay = ({ pageNumber }: { pageNumber?: number }) => {
  if (watermarkType === 'text' && !watermarkText.trim()) return null;
  if (watermarkType === 'image' && !watermarkImage) return null;

  // NEW: Check if this page should have a watermark
  if (pageNumber !== undefined && fileContent?.type === 'pdf' && fileContent.totalPages) {
    try {
      const pagesToWatermark = parsePageRange(pageRange, fileContent.totalPages);
      if (!pagesToWatermark.includes(pageNumber)) {
        return null; // Don't show watermark on this page
      }
    } catch {
      // If parsing fails, show watermark (default behavior)
    }
  }

  // ... rest of rendering logic
}
```

**Key Changes:**
- ✅ Accepts `pageNumber` as optional prop
- ✅ Parses `pageRange` to get list of pages to watermark
- ✅ Returns `null` if current page is NOT in the range
- ✅ Only renders watermark on specified pages

### 2. Updated PDF Rendering

Pass the page number when rendering PDF pages:

```typescript
{fileContent.type === 'pdf' && fileContent.pageCanvases?.map((pageDataUrl: string, index: number) => (
  <div key={index} className="relative mb-6 overflow-hidden">
    {/* Pass page number (1-indexed) */}
    <WatermarkOverlay pageNumber={index + 1} />
    <img src={pageDataUrl} alt={`Page ${index + 1}`} />
  </div>
))}
```

**Note:** Used `index + 1` because PDF pages are 1-indexed (page 1, page 2, etc.) but array indices are 0-indexed.

---

## Before vs After

### Before (Broken) ❌

```
User Input: "5"  (only page 5)

Preview Display:
Page 1: [WATERMARK] ❌ Should not show
Page 2: [WATERMARK] ❌ Should not show
Page 3: [WATERMARK] ❌ Should not show
Page 4: [WATERMARK] ❌ Should not show
Page 5: [WATERMARK] ✓ Correct
Page 6: [WATERMARK] ❌ Should not show
```

### After (Fixed) ✅

```
User Input: "5"  (only page 5)

Preview Display:
Page 1: [NO WATERMARK] ✓
Page 2: [NO WATERMARK] ✓
Page 3: [NO WATERMARK] ✓
Page 4: [NO WATERMARK] ✓
Page 5: [WATERMARK] ✓ Only this page shows it
Page 6: [NO WATERMARK] ✓
```

---

## Test Cases

### Single Page
```
Input: "5"
Result: Watermark preview shows ONLY on page 5 ✓
```

### Multiple Specific Pages
```
Input: "1,3,5"
Result: Watermark preview shows ONLY on pages 1, 3, and 5 ✓
```

### Page Range
```
Input: "3-7"
Result: Watermark preview shows on pages 3, 4, 5, 6, 7 ✓
```

### Mixed Range
```
Input: "1-3,8,10-12"
Result: Watermark preview shows on pages 1, 2, 3, 8, 10, 11, 12 ✓
```

### All Pages
```
Input: "1-" or click "All Pages"
Result: Watermark preview shows on all pages ✓
```

---

## Component Behavior

### For PDF Files with pageNumber prop
- Parses page range
- Checks if current page is in range
- Shows watermark only if page is included

### For Non-PDF Files (Word, Excel, Images)
- `pageNumber` is `undefined`
- Skips page range check
- Always shows watermark (default behavior)

### Error Handling
- If page range parsing fails, defaults to showing watermark
- Prevents preview from breaking due to invalid input

---

## Benefits

1. **Accurate Preview** - Users see exactly which pages will have watermarks
2. **Better UX** - Visual confirmation before applying
3. **No Surprises** - What you see in preview is what you get in export
4. **Consistent** - Preview matches actual watermark application logic

---

## Technical Notes

- Uses existing `parsePageRange()` function for consistency
- Maintains backwards compatibility with non-PDF file types
- Optional parameter ensures existing calls still work
- Try-catch prevents invalid page ranges from breaking UI

---

## Summary

The watermark preview now correctly shows watermarks **only on the specified pages** in the page range, providing accurate visual feedback before the user applies the watermark.

✅ **Preview accuracy fixed**  
✅ **Page-specific watermark display**  
✅ **Consistent with export behavior**  
✅ **Better user experience**

**Status:** FIXED AND PRODUCTION-READY 🚀
