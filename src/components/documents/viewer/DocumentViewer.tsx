/**
 * DocumentViewer
 * Professional document preview component — Documenso-inspired layout.
 * Features:
 *  - Smooth vertical/horizontal scrolling with momentum
 *  - Keyboard shortcuts: Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 reset
 *  - Mini-map thumbnail strip for PDF multi-page navigation
 *  - Sticky zoom/page toolbar with glassmorphism backdrop
 *  - Hardware-accelerated transforms for smooth zoom
 *  - Drop zone for field placement on every document type
 *
 * Responsive:
 *  - sm: stacked layout, compact toolbar, smaller thumbnails
 *  - md: standard layout with thumbnail strip
 *  - lg: full desktop layout
 */
import React, { useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
} from 'lucide-react';
import { sanitizeForDisplay } from '@/utils/sanitize';
import { FieldOverlay } from '../fields/FieldOverlay';
import type { FileContent } from '../viewer/useDocumentLoader';
import type { SignatureMetadata } from '../signature/useSignatureEngine';

interface DocumentViewerProps {
  fileContent: FileContent | null;
  fileLoading: boolean;
  fileError: string | null;
  currentFile: File | null;
  currentFileIndex: number;
  currentPageNumber: number;
  fileZoom: number;
  fileRotation: number;
  placedSignatures: SignatureMetadata[];
  selectedSignatureId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  currentUser: string;
  signatureMethod: string;

  onZoomChange: (zoom: number) => void;
  onRotationChange: (rotation: number) => void;
  onPageChange: (page: number) => void;
  onFieldDrop: (e: React.DragEvent, pageIndex?: number) => void;
  onSelectSignature: (id: string) => void;
  onSignatureMouseDown: (e: React.PointerEvent, id: string) => void;
  onRotateSignature: (id: string) => void;
  onDeleteSignature: (id: string) => void;
  onResizeMouseDown: (e: React.PointerEvent, id: string, corner: 'tl' | 'tr' | 'bl' | 'br') => void;
  onClearSelection: () => void;
  onMouseMove: (e: React.PointerEvent, rect: DOMRect) => void;
  onMouseUp: () => void;
  onFieldDataChange?: (id: string, value: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onDocumentDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}

const ZOOM_STEP = 10;
const ZOOM_MIN = 30;
const ZOOM_MAX = 300;

function clampZoom(z: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  fileContent,
  fileLoading,
  fileError,
  currentFile,
  currentFileIndex,
  currentPageNumber,
  fileZoom,
  fileRotation,
  placedSignatures,
  selectedSignatureId,
  isDragging,
  isResizing,
  currentUser,
  signatureMethod,
  onZoomChange,
  onRotationChange,
  onPageChange,
  onFieldDrop,
  onSelectSignature,
  onSignatureMouseDown,
  onRotateSignature,
  onDeleteSignature,
  onResizeMouseDown,
  onClearSelection,
  onMouseMove,
  onMouseUp,
  onFieldDataChange,
  containerRef: externalRef,
  onDocumentDimensionsChange,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalRef ?? internalRef;
  const canEdit = useCallback(
    (sig: SignatureMetadata) =>
      signatureMethod === 'fields' || !sig.signedBy || sig.signedBy === currentUser || !!sig.assignedRole,
    [signatureMethod, currentUser],
  );

  // Keep the placement coordinate space tied to the untransformed page
  // surface. This remains stable when the viewport is resized or rotated.
  useEffect(() => {
    if (!onDocumentDimensionsChange || !fileContent) return;

    const measure = () => {
      const page = containerRef.current?.querySelector<HTMLElement>(
        `[data-page-number="${currentPageNumber}"]`,
      );
      const surface = page?.querySelector<HTMLElement>('[data-document-surface]')
        ?? containerRef.current?.querySelector<HTMLElement>('[data-document-surface]');
      if (!surface) return;

      onDocumentDimensionsChange({
        width: surface.clientWidth,
        height: surface.clientHeight,
      });
    };

    const frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [containerRef, currentPageNumber, fileContent, fileZoom, fileRotation, onDocumentDimensionsChange]);

  // Keyboard shortcuts: Ctrl+= / Ctrl+- / Ctrl+0
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        onZoomChange(clampZoom(fileZoom + ZOOM_STEP));
      } else if (e.key === '-') {
        e.preventDefault();
        onZoomChange(clampZoom(fileZoom - ZOOM_STEP));
      } else if (e.key === '0') {
        e.preventDefault();
        onZoomChange(100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fileZoom, onZoomChange]);

  // Wheel zoom with Ctrl held
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      onZoomChange(clampZoom(fileZoom + delta));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [fileZoom, onZoomChange, containerRef]);

  const handleMouseMoveWrapper = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) onMouseMove(e, rect);
    },
    [onMouseMove, containerRef],
  );

  const signaturesForPage = useCallback(
    (pageNum: number) =>
      placedSignatures.filter(
        (s) =>
          s.pageNumber === pageNum &&
          (s.fileIndex === undefined || s.fileIndex === currentFileIndex),
      ),
    [placedSignatures, currentFileIndex],
  );

  const signaturesForImage = useCallback(
    () =>
      placedSignatures.filter(
        (s) => s.fileIndex === undefined || s.fileIndex === currentFileIndex,
      ),
    [placedSignatures, currentFileIndex],
  );

  // ── Loading / Error states ────────────────────────────────────────────────

  if (fileLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-[300px] sm:min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-blue-500" />
          </div>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">Loading document…</p>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[200px] sm:max-w-none">{currentFile?.name}</p>
        </div>
      </div>
    );
  }

  if (fileError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 min-h-[300px] sm:min-h-[400px]">
        <div className="text-center space-y-2 p-4 sm:p-6">
          <FileText className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-red-400" />
          <p className="text-xs sm:text-sm font-semibold text-red-600">Failed to load document</p>
          <p className="text-[10px] sm:text-xs text-gray-400 max-w-xs break-words">{fileError}</p>
        </div>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 min-h-[300px] sm:min-h-[400px]">
        <div className="text-center space-y-2 p-6 sm:p-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-gray-400">No document selected</p>
          <p className="text-[10px] sm:text-xs text-gray-300">Attach a file to begin signing</p>
        </div>
      </div>
    );
  }

  // ── Document canvas helpers ───────────────────────────────────────────────

  const contentStyle: React.CSSProperties = {
    transform: `scale(${fileZoom / 100}) rotate(${fileRotation}deg)`,
    transformOrigin: 'top center',
    transition: isDragging ? 'none' : 'transform 0.2s ease',
    willChange: 'transform',
  };

  const overlayProps = (sig: SignatureMetadata) => ({
    signature: sig,
    isSelected: selectedSignatureId === sig.id,
    canEdit: canEdit(sig),
    currentUser,
    isDragging,
    isResizing,
    onSelect: onSelectSignature,
    onMouseDown: onSignatureMouseDown,
    onRotate: onRotateSignature,
    onDelete: onDeleteSignature,
    onResizeMouseDown,
    onFieldDataChange,
  });

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg sm:rounded-xl overflow-hidden border border-gray-100 shadow-sm relative">
      {/* Scrollable document area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
        onPointerMove={handleMouseMoveWrapper}
        onPointerUp={onMouseUp}
        onPointerCancel={onMouseUp}
        onPointerLeave={onMouseUp}
        onClick={onClearSelection}
      >
        {fileContent && (
          <div className="flex min-h-full min-w-0 flex-col items-center gap-4 px-2 py-3 sm:gap-6 sm:px-4 sm:py-6">
            {/* ── PDF: one card per page ─────────────────────────────── */}
            {fileContent.type === 'pdf' && fileContent.pageCanvases?.map((pageDataUrl, index) => (
              <div
                key={index}
                id={`pdf-page-${index}`}
                data-page-number={index + 1}
                className="relative w-full min-w-0 max-w-4xl"
                style={contentStyle}
              >
                {/* Page card with drop shadow */}
                <div
                  className="relative mx-auto bg-white rounded-md sm:rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.08)] sm:shadow-[0_4px_24px_rgba(0,0,0,0.12)] overflow-hidden"
                  data-document-surface
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onFieldDrop(e, index)}
                >
                  <img
                    src={pageDataUrl}
                    alt={`Page ${index + 1}`}
                    className="block w-full h-auto select-none"
                    draggable={false}
                  />

                  {/* Page number badge */}
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                    <Badge
                      variant="secondary"
                      className="text-[8px] sm:text-[10px] bg-black/50 text-white border-none backdrop-blur-sm px-1.5 sm:px-2"
                    >
                      {index + 1} / {fileContent.totalPages}
                    </Badge>
                  </div>

                  {/* Signature overlays */}
                  {signaturesForPage(index + 1).map((sig) => (
                    <FieldOverlay key={sig.id} {...overlayProps(sig)} />
                  ))}
                </div>
              </div>
            ))}

            {/* ── Image ──────────────────────────────────────────────── */}
            {fileContent.type === 'image' && fileContent.url && (
              <div 
                className="relative w-full min-w-0 max-w-4xl"
                style={contentStyle}
                data-page-number="1"
                data-doc-type="image"
              >
                <div
                  className="relative mx-auto bg-white rounded-md sm:rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.08)] sm:shadow-[0_4px_24px_rgba(0,0,0,0.12)] overflow-hidden w-fit"
                  data-document-surface
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onFieldDrop(e)}
                >
                  <img
                    src={fileContent.url}
                    alt={currentFile?.name ?? 'Document'}
                    className="block max-w-full h-auto select-none"
                    draggable={false}
                  />
                  {signaturesForImage().map((sig) => (
                    <FieldOverlay key={sig.id} {...overlayProps(sig)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Word / HTML ─────────────────────────────────────────── */}
            {fileContent.type === 'word' && fileContent.html && (
              <div 
                className="relative w-full min-w-0 max-w-4xl"
                style={contentStyle}
                data-page-number="1"
                data-doc-type="word"
              >
                <div
                  className="relative bg-white rounded-md sm:rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.08)] sm:shadow-[0_4px_24px_rgba(0,0,0,0.12)] overflow-hidden"
                  data-document-surface
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onFieldDrop(e)}
                >
                  <div
                    className="prose prose-sm max-w-none p-4 sm:p-8 min-h-[400px] sm:min-h-[600px] break-words"
                    style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                    /* Security: Content sanitized via sanitizeForDisplay() to remove scripts, event handlers, and malicious URIs */
                    dangerouslySetInnerHTML={{ __html: sanitizeForDisplay(fileContent.html) }}
                  />
                  {signaturesForImage().map((sig) => (
                    <FieldOverlay key={sig.id} {...overlayProps(sig)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Excel / Spreadsheet ─────────────────────────────────── */}
            {fileContent.type === 'excel' && fileContent.html && (
              <div 
                className="relative w-full min-w-0"
                style={contentStyle}
                data-page-number="1"
                data-doc-type="excel"
              >
                <div
                  className="relative max-w-full overflow-auto rounded-md bg-white shadow-[0_2px_16px_rgba(0,0,0,0.08)] sm:rounded-lg sm:shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
                  data-document-surface
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onFieldDrop(e)}
                >
                  <div
                    className="min-h-[200px] max-w-full overflow-x-auto p-2 sm:min-h-[300px] sm:p-4 [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-1.5 sm:[&_td]:px-2 [&_td]:py-1 [&_td]:text-[10px] sm:[&_td]:text-xs [&_th]:border [&_th]:border-gray-200 [&_th]:px-1.5 sm:[&_th]:px-2 [&_th]:py-1 [&_th]:text-[10px] sm:[&_th]:text-xs [&_th]:bg-gray-50 [&_th]:font-semibold"
                    /* Security: Content sanitized via sanitizeForDisplay() to remove scripts, event handlers, and malicious URIs */
                    dangerouslySetInnerHTML={{ __html: sanitizeForDisplay(fileContent.html) }}
                  />
                  {signaturesForImage().map((sig) => (
                    <FieldOverlay key={sig.id} {...overlayProps(sig)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Unsupported ─────────────────────────────────────────── */}
            {fileContent.type === 'unsupported' && (
              <div className="flex items-center justify-center w-full min-h-[300px] sm:min-h-[400px]">
                <div className="text-center space-y-2">
                  <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-300" />
                  <p className="text-xs sm:text-sm text-gray-400">Unsupported file type</p>
                  <p className="text-[10px] sm:text-xs text-gray-300 truncate max-w-[200px]">{currentFile?.name}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF thumbnail strip */}
      {fileContent?.type === 'pdf' &&
        fileContent.pageCanvases &&
        fileContent.totalPages &&
        fileContent.totalPages > 1 && (
          <div className="flex gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 overflow-x-auto border-t border-gray-100 bg-white/80 backdrop-blur-sm"
            style={{ scrollbarWidth: 'thin' }}>
            {fileContent.pageCanvases.map((src, i) => (
              <button
                key={i}
                onClick={() => {
                  onPageChange(i + 1);
                  document.getElementById(`pdf-page-${i}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }}
                className={`flex-shrink-0 rounded border-2 overflow-hidden transition-all ${
                  currentPageNumber === i + 1
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ width: 40, height: 54 }}
                title={`Page ${i + 1}`}
              >
                <img src={src} alt={`Page ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        )}

      {/* PDF Page Navigation Overlay */}
      {fileContent?.type === 'pdf' && fileContent.totalPages && fileContent.totalPages > 1 && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-gray-200 bg-white/90 px-2 py-1 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-lg sm:rounded-xl hover:bg-gray-100"
            onClick={() => onPageChange(Math.max(1, currentPageNumber - 1))}
            disabled={currentPageNumber <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
          </Button>
          
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 bg-gray-50 rounded-md sm:rounded-lg border border-gray-100">
            <span className="text-[10px] sm:text-xs font-bold text-gray-700">{currentPageNumber}</span>
            <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium">/</span>
            <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{fileContent.totalPages}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-lg sm:rounded-xl hover:bg-gray-100"
            onClick={() => onPageChange(Math.min(fileContent.totalPages!, currentPageNumber + 1))}
            disabled={currentPageNumber >= fileContent.totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
