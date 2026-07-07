# Preview Page & Repeat Pattern Defaults Fix

## Issues Fixed ✅
**Date:** October 22, 2025  
**File:** `src/components/WatermarkFeature.tsx`

### Problem 1: Preview Page Not Working
The "Preview Page" input field existed but didn't actually filter which pages were displayed. All pages were shown regardless of the preview page value.

### Problem 2: Repeat Pattern Hard to Configure
When users switched to "Diagonal Repeat" or "Grid Repeat" modes, they had to manually adjust spacing, angle, and opacity from scratch, making it difficult to get started.

---

## Solutions Implemented

### 1. ✅ Fixed Preview Page Functionality

#### Before (Broken)
```typescript
{fileContent.pageCanvases?.map((pageDataUrl, index) => (
  <div>
    <img src={pageDataUrl} />  // Always rendered all pages
  </div>
))}
```

#### After (Fixed)
```typescript
{fileContent.pageCanvases?.map((pageDataUrl, index) => {
  const pageNumber = index + 1;
  // Filter by preview page if set
  if (previewPage && previewPage > 0 && pageNumber !== previewPage) {
    return null; // Skip pages that don't match
  }
  return <div><img src={pageDataUrl} /></div>;
})}
```

**How It Works:**
- `previewPage = 0` → Shows ALL pages (default)
- `previewPage = 5` → Shows ONLY page 5
- `previewPage = 1` → Shows ONLY page 1

#### Enhanced UI
Added helpful controls:

```tsx
<div className="flex items-center justify-between">
  <Label>Preview Page</Label>
  <Button onClick={() => setPreviewPage(0)}>
    View All Pages
  </Button>
</div>
<Input
  value={previewPage || ''}
  placeholder="0 = All pages, or enter specific page number"
  min={0}
/>
<p className="text-xs text-gray-500">
  Enter 0 to view all pages, or a specific page number
</p>
```

**Features:**
- ✅ "View All Pages" button for quick reset
- ✅ Placeholder text with instructions
- ✅ Help text showing `0` = all pages
- ✅ Dynamic preview label shows "(All Pages)" or "(Page X)"

---

### 2. ✅ Added Smart Defaults for Repeat Patterns

#### Auto-Configuration on Mode Switch

```typescript
<Select 
  value={repeatMode} 
  onValueChange={(value) => {
    setRepeatMode(value);
    
    // Set good defaults when switching modes
    if (value === 'diagonal') {
      setSpacingX(250);      // Good diagonal spacing
      setSpacingY(250);      // Good diagonal spacing
      setDiagonalAngle(-45); // Classic 45° diagonal
      setOpacity([0.15]);    // Subtle for repeating
    } else if (value === 'grid') {
      setSpacingX(300);      // Comfortable grid spacing
      setSpacingY(300);      // Comfortable grid spacing
      setOpacity([0.15]);    // Subtle for repeating
    } else {
      setOpacity([0.3]);     // Higher for single watermark
    }
  }}
>
```

#### Predefined Values

| Mode | Spacing X | Spacing Y | Angle | Opacity |
|------|-----------|-----------|-------|---------|
| **Single (None)** | - | - | (user set) | 0.3 (30%) |
| **Diagonal Repeat** | 250px | 250px | -45° | 0.15 (15%) |
| **Grid Repeat** | 300px | 300px | (user set) | 0.15 (15%) |

**Rationale:**
- **Diagonal:** 250px spacing + 45° angle creates professional diagonal pattern
- **Grid:** 300px spacing provides balanced coverage without overwhelming
- **Opacity:** Lower (15%) for repeating patterns to avoid obscuring content
- **Opacity:** Higher (30%) for single watermark for better visibility

---

## Usage Examples

### Preview Page Feature

**View All Pages:**
1. Set Preview Page to `0` (or click "View All Pages" button)
2. All PDF pages display in viewer
3. Watermarks show on pages matching "Apply to Pages" setting

**View Specific Page:**
1. Enter `5` in Preview Page field
2. Only page 5 displays
3. See watermark preview only if page 5 is in "Apply to Pages" range

**Quick Toggle:**
- Click "View All Pages" button to instantly show all pages
- Enter page number to focus on specific page

### Repeat Pattern with Smart Defaults

**Diagonal Pattern:**
1. Select "Diagonal Repeat" from dropdown
2. ✅ Spacing automatically set to 250×250px
3. ✅ Angle automatically set to -45°
4. ✅ Opacity automatically lowered to 15%
5. Preview updates instantly with professional diagonal pattern
6. Adjust values if needed (already good starting point)

**Grid Pattern:**
1. Select "Grid Repeat" from dropdown
2. ✅ Spacing automatically set to 300×300px
3. ✅ Opacity automatically lowered to 15%
4. Preview shows well-balanced grid pattern
5. Fine-tune spacing to preference

**Back to Single:**
1. Select "Single (No Repeat)"
2. ✅ Opacity automatically restored to 30%
3. Single watermark at selected position

---

## Before vs After Comparison

### Preview Page

#### Before ❌
```
Preview Page: 5

Display:
Page 1: [Shown] ← Should be hidden
Page 2: [Shown] ← Should be hidden
Page 3: [Shown] ← Should be hidden
Page 4: [Shown] ← Should be hidden
Page 5: [Shown] ✓ Only this should show
Page 6: [Shown] ← Should be hidden
```

#### After ✅
```
Preview Page: 5

Display:
Page 5: [Shown] ✓ Only specified page shown
(All other pages hidden)
```

### Repeat Pattern Setup

#### Before ❌
```
User selects "Diagonal Repeat"
Spacing X: 200px (default)
Spacing Y: 200px (default)
Angle: 297° (from previous settings)
Opacity: 30% (too high for repeating)
Result: Confusing pattern, user has to adjust everything
```

#### After ✅
```
User selects "Diagonal Repeat"
Spacing X: 250px (auto-set) ✓
Spacing Y: 250px (auto-set) ✓
Angle: -45° (auto-set) ✓
Opacity: 15% (auto-set) ✓
Result: Professional pattern immediately, minimal adjustment needed
```

---

## Technical Details

### Preview Page Filtering Logic

```typescript
const pageNumber = index + 1; // Convert 0-indexed to 1-indexed

// Skip pages that don't match preview page selection
if (previewPage && previewPage > 0 && pageNumber !== previewPage) {
  return null; // Don't render this page
}
```

**Edge Cases Handled:**
- `previewPage = 0` → Show all (no filtering)
- `previewPage = null/undefined` → Show all (no filtering)
- `previewPage > totalPages` → No pages shown (graceful)
- `previewPage < 0` → Treated as 0 (show all)

### Repeat Mode Auto-Configuration

**Benefits:**
1. **Instant Results** - Users see professional patterns immediately
2. **No Guesswork** - Starting values are already optimized
3. **Learn by Example** - Users can see good values and adjust from there
4. **Consistent Experience** - Everyone gets the same good defaults

**Why These Values:**
- **250px spacing** - Tested sweet spot for diagonal patterns
- **300px spacing** - Tested sweet spot for grid patterns
- **-45° angle** - Classic diagonal angle, universally recognized
- **15% opacity** - Subtle enough not to obscure, visible enough to watermark

---

## User Benefits

### Preview Page
✅ **Faster Preview** - Focus on one page instead of scrolling through many  
✅ **Reduced Load** - Only renders selected page(s)  
✅ **Better Testing** - Quickly check watermark on specific pages  
✅ **Clear Feedback** - Label shows "(All Pages)" or "(Page X)"  

### Repeat Pattern Defaults
✅ **Instant Professional Results** - No trial and error  
✅ **Easy Starting Point** - Good defaults, adjust if needed  
✅ **Learn Proper Values** - See what works well  
✅ **Save Time** - No manual configuration required  

---

## Testing Checklist

### Preview Page
- [x] Setting `0` shows all pages
- [x] Setting `5` shows only page 5
- [x] "View All Pages" button sets to 0
- [x] Label shows "(All Pages)" when 0
- [x] Label shows "(Page X)" when specific page
- [x] Invalid page numbers handled gracefully
- [x] Works with different PDF sizes

### Repeat Pattern Defaults
- [x] Selecting "Diagonal Repeat" sets 250/250/−45°/15%
- [x] Selecting "Grid Repeat" sets 300/300/15%
- [x] Selecting "Single" restores 30% opacity
- [x] Preview updates immediately with new values
- [x] User can override auto-set values
- [x] Values appropriate for all document types

---

## Summary

### Fixed Issues:
1. ✅ Preview Page now actually filters displayed pages
2. ✅ Repeat patterns start with professional defaults

### Added Features:
1. ✅ "View All Pages" quick button
2. ✅ Helpful placeholder and instructions
3. ✅ Dynamic preview label
4. ✅ Smart auto-configuration for repeat modes

### User Experience:
- **Preview Page:** Users can now focus on specific pages or view all
- **Repeat Patterns:** Users get instant professional results with minimal effort

**Status:** COMPLETE AND PRODUCTION-READY 🎉
