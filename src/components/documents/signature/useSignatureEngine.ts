/**
 * useSignatureEngine
 * Manages all state and logic for signature placement, drag, resize, rotate, delete.
 * Inspired by Documenso field-engine architecture (internal implementation).
 *
 * Fix (2026-04-16):
 *  - Drag/resize now uses the page element's bounding rect (not the scroll
 *    container) so coordinates stay accurate on long / scrolled documents.
 *  - Image-type signatures (signature, stamp, initials, image) have their
 *    aspect ratio locked during resize — no more vertical stretching.
 *  - aspectRatio stored on placement so lock is stable even after state updates.
 */
import { useState, useRef, useCallback } from 'react';

export interface SignatureMetadata {
  id: string;
  data: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  rotation: number;
  pageNumber?: number;
  fileIndex?: number;
  docWidth: number;
  docHeight: number;
  signedBy?: string;
  signedAt?: string;
  pixelX?: number;
  pixelY?: number;
  /** Natural W:H ratio stored at placement time — used to lock aspect during resize */
  aspectRatio?: number;
  type?:
  | 'signature'
  | 'stamp'
  | 'initials'
  | 'name'
  | 'job_title'
  | 'company'
  | 'date'
  | 'text'
  | 'number'
  | 'phone'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'email'
  | 'image';
  assignedRole?: string;
  timestamp?: string;
  isValid?: boolean;
}

interface DragState {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

interface UseSignatureEngineOptions {
  currentUser: string;
  currentFileIndex: number;
  isMultiFile: boolean;
  fileZoom: number;
  signatureMethod: string;
}

/** Returns true for field types that display image data — aspect ratio must be locked */
function isImageField(type?: string): boolean {
  return !type || ['signature', 'stamp', 'initials', 'image'].includes(type);
}

export function useSignatureEngine({
  currentUser,
  currentFileIndex,
  isMultiFile,
  fileZoom,
  signatureMethod,
}: UseSignatureEngineOptions) {
  const [placedSignatures, setPlacedSignatures] = useState<SignatureMetadata[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const currentDragStateRef = useRef<DragState | null>(null);

  /**
   * Rect of the **page card** element (the direct parent of the signature overlay).
   * Captured on mousedown so all subsequent mousemove calculations use the same
   * reference frame — critical for long / zoomed / scrolled documents.
   */
  const pageRectRef = useRef<DOMRect | null>(null);

  const canEditSignature = useCallback(
    (sig: SignatureMetadata) =>
      signatureMethod === 'fields' || !sig.signedBy || sig.signedBy === currentUser || !!sig.assignedRole,
    [signatureMethod, currentUser],
  );

  /** Place a new signature on the document using normalized coordinates */
  const placeSignature = useCallback(
    async (
      signatureData: string,
      signatureField: { x: number; y: number; width: number; height: number; rotation: number },
      actualDocDimensions: { width: number; height: number },
      currentPageNumber: number | undefined,
      fileContent?: { type: string; totalPages?: number },
      assignedRole?: string | null,
    ) => {
      const docWidth = actualDocDimensions.width;
      const docHeight = actualDocDimensions.height;
      const zoomFactor = fileZoom / 100;

      const xPercent = signatureField.x / zoomFactor / docWidth;
      const yPercent = signatureField.y / zoomFactor / docHeight;
      const widthPercent = signatureField.width / zoomFactor / docWidth;
      const heightPercent = signatureField.height / zoomFactor / docHeight;

      const pageNumber =
        fileContent?.type === 'pdf' && (fileContent.totalPages ?? 0) > 1
          ? currentPageNumber
          : undefined;

      // Read natural aspect ratio from the actual PNG image
      const getNaturalAspect = (dataUrl: string): Promise<number> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalHeight / img.naturalWidth);
          img.onerror = () => resolve(0.4); // fallback 2.5:1 width-to-height
          img.src = dataUrl;
        });
      };

      const naturalAspect = await getNaturalAspect(signatureData);
      
      // Apply safety constraints to prevent extreme shapes
      const MAX_ASPECT_RATIO = 0.6;  // height can't exceed 60% of width
      const MIN_ASPECT_RATIO = 0.2;  // height must be at least 20% of width
      const aspectRatio = Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, naturalAspect));

      const newSig: SignatureMetadata = {
        id: Date.now().toString(),
        data: signatureData,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
        rotation: signatureField.rotation,
        aspectRatio,
        pageNumber,
        fileIndex: isMultiFile ? currentFileIndex : undefined,
        docWidth,
        docHeight,
        signedBy: currentUser,
        signedAt: new Date().toISOString(),
        assignedRole: assignedRole && assignedRole !== 'any_role' ? assignedRole : undefined,
      };

      setPlacedSignatures((prev) => [...prev, newSig]);
      setSelectedSignatureId(newSig.id);
      return newSig;
    },
    [fileZoom, isMultiFile, currentFileIndex, currentUser],
  );

  /** Place a field (empty, type-tagged) dropped from the field palette */
  const placeField = useCallback(
    (params: {
      type: string;
      xPercent: number;
      yPercent: number;
      widthPercent?: number;
      heightPercent?: number;
      pageNumber?: number;
      selectedRole?: string;
      docWidth: number;
      docHeight: number;
    }) => {
      const {
        type,
        xPercent,
        yPercent,
        pageNumber,
        selectedRole,
        docWidth,
        docHeight,
      } = params;

      // Specialized defaults based on field type
      let widthPercent = params.widthPercent ?? 0.15;
      let heightPercent = params.heightPercent ?? 0.05;

      if (type === 'stamp') {
        widthPercent = 0.18;
        heightPercent = 0.12;
      } else if (type === 'initials') {
        widthPercent = 0.10;
        heightPercent = 0.06;
      }

      const newField: SignatureMetadata = {
        id: crypto.randomUUID(),
        data: '',
        signedBy:
          selectedRole && selectedRole !== 'any_role' ? selectedRole : undefined,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
        rotation: 0,
        timestamp: new Date().toISOString(),
        isValid: true,
        pageNumber,
        fileIndex: isMultiFile ? currentFileIndex : undefined,
        type: type as SignatureMetadata['type'],
        assignedRole:
          selectedRole && selectedRole !== 'any_role' ? selectedRole : undefined,
        docWidth,
        docHeight,
      };

      setPlacedSignatures((prev) => [...prev, newField]);
      return newField;
    },
    [currentUser, isMultiFile, currentFileIndex],
  );

  const rotateSignature = useCallback(
    (sigId: string) => {
      setPlacedSignatures((prev) =>
        prev.map((sig) => {
          if (sig.id !== sigId) return sig;
          if (!canEditSignature(sig)) return sig;
          // Swap W/H percentages so visual proportions stay correct after rotation
          const rotated = (sig.rotation + 90) % 360;
          const newAspect = sig.widthPercent > 0 ? sig.widthPercent / sig.heightPercent : 1;
          return {
            ...sig,
            rotation: rotated,
            aspectRatio: newAspect,
          };
        }),
      );
    },
    [canEditSignature],
  );

  const deleteSignature = useCallback(
    (sigId: string) => {
      const sig = placedSignatures.find((s) => s.id === sigId);
      if (!sig || !canEditSignature(sig)) return false;
      setPlacedSignatures((prev) => prev.filter((s) => s.id !== sigId));
      setSelectedSignatureId(null);
      return true;
    },
    [placedSignatures, canEditSignature],
  );

  const updateSignatureData = useCallback((sigId: string, data: string) => {
    setPlacedSignatures((prev) =>
      prev.map((s) => (s.id === sigId ? { ...s, data } : s)),
    );
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  /**
   * Capture the **page element's** rect (direct parent of the overlay) on mousedown.
   * This ensures drag coordinates are always in the same space as the overlay's
   * percentage positioning — even on scrolled / zoomed / multi-page documents.
   */
  const capturePageRect = useCallback((sigId: string, fallback: DOMRect): DOMRect => {
    const el = document.querySelector<HTMLElement>(`[data-signature-id="${sigId}"]`);
    const pageEl = el?.parentElement;
    const rect = pageEl ? pageEl.getBoundingClientRect() : fallback;
    pageRectRef.current = rect;
    return rect;
  }, []);

  const handleSignatureMouseDown = useCallback(
    (e: React.MouseEvent, sigId: string, parentRect: DOMRect) => {
      e.stopPropagation();
      const signature = placedSignatures.find((s) => s.id === sigId);
      if (!signature) return;

      if (!canEditSignature(signature)) {
        setSelectedSignatureId(sigId);
        return;
      }

      setSelectedSignatureId(sigId);
      setIsDragging(true);

      // Use page element rect (not scroll-container rect) for accurate offset
      const rect = capturePageRect(sigId, parentRect);

      setDragOffset({
        x: (e.clientX - rect.left) / rect.width - signature.xPercent,
        y: (e.clientY - rect.top) / rect.height - signature.yPercent,
      });
    },
    [placedSignatures, canEditSignature, capturePageRect],
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, sigId: string, corner: 'tl' | 'tr' | 'bl' | 'br') => {
      e.stopPropagation();
      setSelectedSignatureId(sigId);
      setIsResizing(true);
      setResizeCorner(corner);

      // Capture page element rect for accurate resize calculations
      const el = document.querySelector<HTMLElement>(`[data-signature-id="${sigId}"]`);
      const pageEl = el?.parentElement;
      if (pageEl) {
        pageRectRef.current = pageEl.getBoundingClientRect();
      }
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, parentRect: DOMRect) => {
      if (!selectedSignatureId) return;
      const signature = placedSignatures.find((s) => s.id === selectedSignatureId);
      if (!signature) return;

      // Use the captured page rect; fall back to parentRect if not yet set
      const rect = pageRectRef.current ?? parentRect;

      const currentX = (e.clientX - rect.left) / rect.width;
      const currentY = (e.clientY - rect.top) / rect.height;

      // Minimum dimensions (as fraction of page)
      const MIN_W = 0.05;
      const MIN_H = 0.02;

      if (isDragging) {
        const newX = Math.max(0, Math.min(1 - signature.widthPercent, currentX - dragOffset.x));
        const newY = Math.max(0, Math.min(1 - signature.heightPercent, currentY - dragOffset.y));
        const el = document.querySelector<HTMLElement>(`[data-signature-id="${selectedSignatureId}"]`);
        if (el) {
          el.style.left = `${newX * 100}%`;
          el.style.top = `${newY * 100}%`;
        }
        currentDragStateRef.current = {
          xPercent: newX,
          yPercent: newY,
          widthPercent: signature.widthPercent,
          heightPercent: signature.heightPercent,
        };
      } else if (isResizing && resizeCorner) {
        // For image-type fields, lock W:H ratio to prevent distortion.
        // Field types (date, text, checkbox, etc.) resize freely.
        const lockAspect = isImageField(signature.type);
        const ar = signature.aspectRatio ?? (signature.heightPercent / Math.max(0.001, signature.widthPercent));

        // ── SIGNATURE BOX CONSTRAINTS ──────────────────────────────────────
        // Enforce horizontal orientation: width must always exceed height.
        // MAX_ASPECT_RATIO = 0.6 means height can be at most 60% of width,
        // preventing tall vertical rectangles while allowing reasonable proportions.
        const MAX_ASPECT_RATIO = 0.6;  // height / width ≤ 0.6 (e.g., 200×120px)
        const MIN_ASPECT_RATIO = 0.2;  // height / width ≥ 0.2 (e.g., 200×40px)

        let nW = signature.widthPercent;
        let nH = signature.heightPercent;
        let nX = signature.xPercent;
        let nY = signature.yPercent;

        switch (resizeCorner) {
          case 'br':
            nW = Math.max(MIN_W, currentX - signature.xPercent);
            if (lockAspect) {
              // Constrain aspect ratio to prevent vertical stretching
              const constrainedAr = Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, ar));
              nH = nW * constrainedAr;
            } else {
              nH = Math.max(MIN_H, currentY - signature.yPercent);
            }
            break;

          case 'bl':
            nW = Math.max(MIN_W, signature.xPercent + signature.widthPercent - currentX);
            if (lockAspect) {
              const constrainedAr = Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, ar));
              nH = nW * constrainedAr;
            } else {
              nH = Math.max(MIN_H, currentY - signature.yPercent);
            }
            nX = signature.xPercent + signature.widthPercent - nW;
            break;

          case 'tr':
            nW = Math.max(MIN_W, currentX - signature.xPercent);
            if (lockAspect) {
              const constrainedAr = Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, ar));
              nH = nW * constrainedAr;
              nY = signature.yPercent + signature.heightPercent - nH;
            } else {
              nH = Math.max(MIN_H, signature.yPercent + signature.heightPercent - currentY);
              nY = signature.yPercent + signature.heightPercent - nH;
            }
            break;

          case 'tl':
            nW = Math.max(MIN_W, signature.xPercent + signature.widthPercent - currentX);
            if (lockAspect) {
              const constrainedAr = Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, ar));
              nH = nW * constrainedAr;
              nY = signature.yPercent + signature.heightPercent - nH;
            } else {
              nH = Math.max(MIN_H, signature.yPercent + signature.heightPercent - currentY);
              nY = signature.yPercent + signature.heightPercent - nH;
            }
            nX = signature.xPercent + signature.widthPercent - nW;
            break;
        }

        // Additional safety: ensure width is always greater than height for signatures
        if (lockAspect && nH > nW * MAX_ASPECT_RATIO) {
          nH = nW * MAX_ASPECT_RATIO;
        }

        const cx = Math.max(0, Math.min(1 - MIN_W, nX));
        const cy = Math.max(0, Math.min(1 - MIN_H, nY));
        const cw = Math.max(MIN_W, Math.min(1, nW));
        const ch = Math.max(MIN_H, Math.min(1, nH));

        const el = document.querySelector<HTMLElement>(`[data-signature-id="${selectedSignatureId}"]`);
        if (el) {
          el.style.left = `${cx * 100}%`;
          el.style.top = `${cy * 100}%`;
          el.style.width = `${cw * 100}%`;
          el.style.height = `${ch * 100}%`;
        }
        currentDragStateRef.current = { xPercent: cx, yPercent: cy, widthPercent: cw, heightPercent: ch };
      }
    },
    [selectedSignatureId, placedSignatures, isDragging, dragOffset, isResizing, resizeCorner],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);

    if (currentDragStateRef.current && selectedSignatureId) {
      const { xPercent, yPercent, widthPercent, heightPercent } = currentDragStateRef.current;
      setPlacedSignatures((prev) =>
        prev.map((sig) =>
          sig.id === selectedSignatureId
            ? {
              ...sig,
              xPercent,
              yPercent,
              widthPercent,
              heightPercent,
              // Update stored aspect ratio after resize completes
              aspectRatio: widthPercent > 0 ? heightPercent / widthPercent : sig.aspectRatio,
            }
            : sig,
        ),
      );
      currentDragStateRef.current = null;
    }
  }, [selectedSignatureId]);

  return {
    placedSignatures,
    setPlacedSignatures,
    selectedSignatureId,
    setSelectedSignatureId,
    isDragging,
    isResizing,
    placeSignature,
    placeField,
    rotateSignature,
    deleteSignature,
    updateSignatureData,
    canEditSignature,
    handleSignatureMouseDown,
    handleResizeMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
