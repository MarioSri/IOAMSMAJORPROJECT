# Interactive Signature Field Implementation

## Overview
The signature field box (green dashed border) on the left-side document preview in DocumensoIntegration is now fully interactive with resize, move, rotate, and reset capabilities.

## Features Implemented

### 1. **Interactive Signature Field**
The green signature field box is now a fully interactive element that users can customize to their needs.

### 2. **Visual States**
- **Default State**: Green dashed border with "Sign Here" text
- **Selected State**: Blue ring (ring-4 ring-blue-500) appears when field is clicked
- **With Signatures**: Shows "Signature Field" text when signatures are placed

### 3. **Interactive Controls**

#### **Move/Drag** 
- **Action**: Click and drag the signature field box
- **Visual**: Cursor changes to `cursor-move`
- **Function**: `handleFieldMouseDown()` - Initiates drag mode
- **Behavior**: Field follows mouse cursor maintaining offset

#### **Resize (Corner Handles)**
- **Visual**: Four blue circular handles at corners when field is selected
- **Corners**: Top-left, Top-right, Bottom-left, Bottom-right
- **Function**: `handleFieldResizeMouseDown(corner)` - Initiates resize mode
- **Constraints**: Minimum width: 100px, Minimum height: 50px
- **Behavior**: 
  - Bottom-right: Expands/shrinks from top-left anchor
  - Bottom-left: Expands/shrinks from top-right anchor
  - Top-right: Expands/shrinks from bottom-left anchor
  - Top-left: Expands/shrinks from bottom-right anchor

#### **Rotate (⟳ Icon)**
- **Visual**: Circular arrow button above field when selected
- **Function**: `rotateSignatureField()` - Rotates field by 90°
- **Behavior**: Rotates through 0° → 90° → 180° → 270° → 0°
- **Transform**: Uses CSS `transform: rotate()` with center origin

#### **Reset (↺ Icon)**
- **Visual**: Counter-clockwise arrow button (red) above field when selected
- **Function**: `deleteSignatureField()` - Resets to default state
- **Default Position**: x: 100, y: 300, width: 200, height: 80, rotation: 0
- **Toast**: Shows "Signature Field Reset" confirmation

### 4. **Selection Management**
- **Click Field**: Selects field, deselects any placed signatures
- **Click Signature**: Selects signature, deselects field
- **Click Background**: Deselects everything
- **State**: `isFieldSelected` boolean controls visibility of handles/buttons

### 5. **Mouse Event Handling**

#### **Combined Mouse Handlers**
```typescript
handleCombinedMouseMove(e) - Routes to field or signature handlers
handleCombinedMouseUp() - Clears all drag/resize states
```

#### **Field-Specific Handlers**
```typescript
handleFieldMouseDown(e) - Starts field drag
handleFieldResizeMouseDown(e, corner) - Starts field resize
handleFieldMouseMove(e) - Updates field position/size during drag/resize
rotateSignatureField() - Rotates field 90° clockwise
deleteSignatureField() - Resets field to default
```

## State Management

### Signature Field State
```typescript
signatureField: {
  x: number;        // Left position (px)
  y: number;        // Top position (px)
  width: number;    // Width (px)
  height: number;   // Height (px)
  rotation: number; // Rotation angle (0-270)
}
```

### Interaction States
```typescript
isFieldSelected: boolean;      // Field is selected
isFieldDragging: boolean;      // Field is being dragged
isFieldResizing: boolean;      // Field is being resized
fieldResizeCorner: 'tl'|'tr'|'bl'|'br'|null; // Active corner
fieldDragOffset: { x, y };     // Mouse offset for smooth dragging
```

## User Flow

### Customize Signature Field
1. **Click** on green signature field box → Field becomes selected (blue ring appears)
2. **Drag** field to desired position on document
3. **Resize** field using corner handles to match signature size
4. **Rotate** field using ⟳ button if needed (for landscape documents)
5. **Sign** using draw/camera/upload → Signature appears in field area
6. **Reset** field using ↺ button if repositioning is needed

### Visual Feedback
- **Hover**: Cursor changes to `cursor-move` over field
- **Selected**: Blue ring-4 border appears
- **Dragging**: Field follows cursor smoothly
- **Resizing**: Field dimensions update in real-time
- **Controls**: Buttons only visible when field is selected

## Technical Implementation

### CSS Positioning
- **Position**: `absolute` within preview container
- **Z-Index**: 60 when selected, 30 when not selected
- **Transform Origin**: `center` for rotation
- **Pointer Events**: Enabled for interaction

### Event Propagation
- `e.stopPropagation()` on all control buttons to prevent field drag
- Click on preview background deselects field
- Field selection deselects placed signatures

### Coordinate System
- **Relative to**: Preview container (`previewContainerRef`)
- **Mouse Position**: Calculated using `getBoundingClientRect()`
- **Drag Offset**: Maintained for smooth dragging experience

## Integration Points

### With Signature Placement
- Field and placed signatures share same preview container
- Independent selection states
- Field remains visible even when signatures are placed
- Field provides visual guide for signature placement area

### With Document Preview
- Field overlays document content
- Maintains position during zoom (50%-200%)
- Maintains position during rotation (0°-270°)
- Scrollable with document content

## Benefits

1. **Customizable Placement**: Users can position signature field exactly where needed
2. **Flexible Sizing**: Resize to accommodate different signature sizes
3. **Document Compatibility**: Rotate for landscape/portrait documents
4. **Easy Reset**: Quick return to default if needed
5. **Visual Guidance**: Clear indication of where signature will appear
6. **Professional Look**: Smooth interactions with visual feedback

## Testing Recommendations

### Interaction Testing
- ✅ Click field to select/deselect
- ✅ Drag field to different positions
- ✅ Resize from each corner handle
- ✅ Rotate through all angles (0°, 90°, 180°, 270°)
- ✅ Reset to default position
- ✅ Sign after field positioning
- ✅ Select field while signature is placed

### Edge Cases
- ✅ Minimum size constraints (100x50)
- ✅ Field at document edges
- ✅ Rotated field interactions
- ✅ Multiple signatures with field visible
- ✅ Field visibility during zoom
- ✅ Field position during document rotation

## Future Enhancements

### Potential Additions
1. **Multiple Fields**: Support for multiple signature fields on same document
2. **Field Templates**: Preset field sizes for common signature types
3. **Snap to Grid**: Align field to document grid for precise placement
4. **Field Labels**: Add custom text labels to fields
5. **Field Colors**: Different colors for different signature types
6. **Keyboard Shortcuts**: Arrow keys for fine positioning

## Conclusion

The signature field is now a fully interactive element that provides users with complete control over signature placement. Users can easily customize the field position, size, and rotation to match their document requirements, ensuring professional and accurate signature placement every time.
