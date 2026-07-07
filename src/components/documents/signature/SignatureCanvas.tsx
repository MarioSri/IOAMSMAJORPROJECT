/**
 * SignatureCanvas
 * Draw-pad component with Bézier smoothing.
 * Uses unified pointer events (mouse + touch) for clean cross-device support.
 *
 * Design: strokes are drawn directly on a transparent canvas (no white fill),
 * so the captured PNG already has a transparent background and colored ink strokes.
 * Cropped to the ink bounding box on capture for a natural aspect ratio.
 *
 * Responsive:
 *  - sm: compact controls, smaller canvas height
 *  - md+: full controls, standard canvas height
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface SignatureCanvasProps {
  brushSize?: number;
  brushColor?: string;
  onCapture: (dataUrl: string) => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushColorChange?: (color: string) => void;
}

const BRUSH_SIZES = [1, 2, 4, 6] as const;

/** Preset ink colors */
const INK_COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#1e3a5f', label: 'Navy' },
  { value: '#1a1a8a', label: 'Blue' },
  { value: '#8b0000', label: 'Dark Red' },
  { value: '#2d5016', label: 'Forest' },
  { value: '#4a0e4e', label: 'Purple' },
] as const;

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  brushSize = 2,
  brushColor = '#000000',
  onCapture,
  onBrushSizeChange,
  onBrushColorChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  // HiDPI scaling for crisp signature capture (DocuSeal uses 3× pattern)
  const DPR = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;

  // Reset when mounted — ensure canvas is fully transparent (no white fill)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Apply HiDPI scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * DPR;
    canvas.height = rect.height * DPR;
    ctx.scale(DPR, DPR);
    // Explicitly clear to transparent (default for canvas, but be explicit)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  }, [DPR]);

  const getCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      // Return CSS-pixel coordinates — ctx.scale(DPR) handles the device scaling
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const drawSmooth = useCallback(
    (pts: Array<{ x: number; y: number }>) => {
      const canvas = canvasRef.current;
      if (!canvas || pts.length < 2) return;
      const ctx = canvas.getContext('2d')!;

      // Clear to transparent (NOT white) so ink-only PNG is captured
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize; // DPR scaling handles resolution — no manual 2× needed
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // No shadow — shadows bleed into background and confuse bounding-box crop
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 2; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }

      const last = pts.length - 1;
      if (pts.length > 2) {
        ctx.quadraticCurveTo(pts[last - 1].x, pts[last - 1].y, pts[last].x, pts[last].y);
      } else {
        ctx.lineTo(pts[last].x, pts[last].y);
      }

      ctx.stroke();
    },
    [brushColor, brushSize],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      const pt = getCoords(e);
      setPoints([pt]);
      setHasContent(true);
    },
    [getCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      e.preventDefault();
      setPoints((prev) => {
        const next = [...prev, getCoords(e)];
        drawSmooth(next);
        return next;
      });
    },
    [isDrawing, getCoords, drawSmooth],
  );

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
    if (points.length > 0) drawSmooth(points);
  }, [points, drawSmooth]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Save/restore to clear without DPR scaling interfering
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setPoints([]);
    setHasContent(false);
  }, []);

  /**
   * Crop the transparent canvas to the tight bounding box of ink pixels,
   * then export. This gives a naturally-proportioned PNG with transparent
   * background and colored strokes only — no post-processing needed.
   */
  const cropToInkBounds = useCallback((src: HTMLCanvasElement): string => {
    const ctx = src.getContext('2d')!;
    const { width: w, height: h } = src;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = d[(y * w + x) * 4 + 3];
        if (a > 10) { // ink pixel
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // No ink found — return the full canvas
    if (maxX < minX) return src.toDataURL('image/png');

    // Add a small padding around the ink
    const PAD = 8;
    const cx = Math.max(0, minX - PAD);
    const cy = Math.max(0, minY - PAD);
    const cw = Math.min(w, maxX + PAD + 1) - cx;
    const ch = Math.min(h, maxY + PAD + 1) - cy;

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d')!;
    octx.drawImage(src, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL('image/png');
  }, []);

  const capture = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);
    try {
      // Crop to ink bounding box — gives correct aspect ratio and transparent bg
      const cropped = cropToInkBounds(canvas);
      onCapture(cropped);
    } finally {
      setIsProcessing(false);
    }
  }, [cropToInkBounds, onCapture]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-xl border border-gray-100">
        {/* Brush size */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label className="text-[10px] sm:text-xs text-gray-500 font-medium">Size</Label>
          <div className="flex gap-0.5 sm:gap-1">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => onBrushSizeChange?.(s)}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full aspect-square shrink-0 text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center ${
                  brushSize === s
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Ink color presets */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label className="text-[10px] sm:text-xs text-gray-500 font-medium">Color</Label>
          <div className="flex gap-1">
            {INK_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => onBrushColorChange?.(c.value)}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full aspect-square shrink-0 border-2 transition-all ${
                  brushColor === c.value
                    ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                    : 'border-gray-200 hover:border-gray-400 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
            {/* Custom color picker */}
            <label className="w-5 h-5 sm:w-6 sm:h-6 rounded-full aspect-square shrink-0 border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center"
              title="Custom color">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => onBrushColorChange?.(e.target.value)}
                className="w-8 h-8 -m-1 cursor-pointer opacity-0 absolute"
              />
              <span className="text-[8px] text-gray-400 font-bold pointer-events-none">+</span>
            </label>
          </div>
        </div>
      </div>

      {/* Canvas pad */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white relative hover:border-blue-300 transition-colors">
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] sm:text-xs text-gray-300 select-none">Draw your signature here</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={240}
          style={{
            width: '100%',
            height: 140,
            touchAction: 'none',
            display: 'block',
            // Transparent canvas background — ink strokes only
            background: 'transparent',
          }}
          className="cursor-crosshair sm:!h-[160px]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={clear} className="rounded-lg text-xs">
          Clear
        </Button>
        <Button
          size="sm"
          onClick={capture}
          disabled={!hasContent || isProcessing}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex-1 text-xs"
        >
          {isProcessing ? 'Processing…' : 'Add Signature'}
        </Button>
      </div>
    </div>
  );
};

export default SignatureCanvas;
