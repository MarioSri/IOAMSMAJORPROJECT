/**
 * TypedSignaturePanel
 * Enhanced typed signature with font selection, ink color presets, and live preview.
 * Generates signature as a canvas-rendered data URL.
 *
 * Fonts loaded from Google Fonts CDN (preloaded for instant rendering).
 *
 * Fix (2026-04-16):
 *  - handleGenerate: measures actual text width first, then sizes the canvas
 *    to fit the full text with padding — no more left/right clipping.
 *  - renderPreview: scales font-size down if text overflows the preview canvas.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** Available signature fonts — must be Google Fonts that look handwritten */
const SIGNATURE_FONTS = [
  { name: 'Pacifico', css: "'Pacifico', cursive", size: 64 },
  { name: 'Dancing Script', css: "'Dancing Script', cursive", size: 64 },
  { name: 'Great Vibes', css: "'Great Vibes', cursive", size: 60 },
  { name: 'Caveat', css: "'Caveat', cursive", size: 68 },
  { name: 'Sacramento', css: "'Sacramento', cursive", size: 72 },
  { name: 'Satisfy', css: "'Satisfy', cursive", size: 64 },
] as const;

/** Ink color presets */
const INK_COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#1e3a5f', label: 'Navy' },
  { value: '#1a1a8a', label: 'Blue' },
  { value: '#8b0000', label: 'Dark Red' },
  { value: '#2d5016', label: 'Forest' },
  { value: '#4a0e4e', label: 'Purple' },
] as const;

interface TypedSignaturePanelProps {
  userName: string;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  onCapture: (dataUrl: string) => void;
  onPlace: () => void;
  hasCapture: boolean;
}

/** Preload Google Fonts */
function preloadFonts() {
  const link = document.getElementById('typed-sig-fonts');
  if (link) return;
  const el = document.createElement('link');
  el.id = 'typed-sig-fonts';
  el.rel = 'stylesheet';
  el.href =
    'https://fonts.googleapis.com/css2?family=Pacifico&family=Dancing+Script:wght@700&family=Great+Vibes&family=Caveat:wght@600&family=Sacramento&family=Satisfy&display=swap';
  document.head.appendChild(el);
}

export const TypedSignaturePanel: React.FC<TypedSignaturePanelProps> = ({
  userName,
  brushColor,
  onBrushColorChange,
  onCapture,
  onPlace,
  hasCapture,
}) => {
  const [typedText, setTypedText] = useState('');
  const [selectedFont, setSelectedFont] = useState<(typeof SIGNATURE_FONTS)[number]>(SIGNATURE_FONTS[0]);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Preload fonts on mount
  useEffect(() => {
    preloadFonts();
  }, []);

  // Re-render preview whenever text, font, or color changes.
  // Font size is scaled down automatically if the text is wider than the canvas.
  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const text = typedText || userName;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.offsetWidth || 320;
    const displayH = canvas.offsetHeight || 120;

    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, displayW, displayH);

    // Baseline guide
    const baseY = displayH * 0.72;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(16, baseY);
    ctx.lineTo(displayW - 16, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Scale font to fit ──────────────────────────────────────────────────
    const SIDE_PAD = 20; // px padding each side
    const maxTextW = displayW - SIDE_PAD * 2;
    let fontSize: number = selectedFont.size;

    // Measure at nominal size
    ctx.font = `${fontSize}px ${selectedFont.css}`;
    const measured = ctx.measureText(text).width;
    if (measured > maxTextW && measured > 0) {
      fontSize = Math.max(18, Math.floor(fontSize * (maxTextW / measured)));
    }

    ctx.font = `${fontSize}px ${selectedFont.css}`;
    ctx.fillStyle = brushColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, displayW / 2, baseY);
  }, [typedText, userName, selectedFont, brushColor]);

  useEffect(() => {
    // Delay slightly to allow font loading
    const t = setTimeout(renderPreview, 120);
    return () => clearTimeout(t);
  }, [renderPreview]);

  /**
   * Generate the exportable signature data URL.
   *
   * Fix: measure actual text width at the target font size FIRST, then
   * allocate a canvas large enough to hold the full text plus padding.
   * This guarantees no left/right clipping regardless of name length.
   */
  const handleGenerate = useCallback(() => {
    const text = typedText || userName;
    if (!text) return;

    const fontSize = selectedFont.size * 1.5; // high-res render

    // ── Step 1: measure text in a temporary canvas ────────────────────────
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d')!;
    measureCtx.font = `${fontSize}px ${selectedFont.css}`;
    const metrics = measureCtx.measureText(text);

    // Use font-metric bounds if available, fall back to width heuristic
    const textW = Math.ceil(metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent ?? fontSize * 0.8);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent ?? fontSize * 0.25);
    const textH = ascent + descent;

    const PAD_H = Math.round(fontSize * 0.5); // proportional horizontal padding
    const PAD_V = Math.round(fontSize * 0.35); // proportional vertical padding

    const canvasW = textW + PAD_H * 2;
    const canvasH = Math.max(textH + PAD_V * 2, Math.round(fontSize * 1.5));

    // ── Step 2: render on correctly-sized canvas ──────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    ctx.font = `${fontSize}px ${selectedFont.css}`;
    ctx.fillStyle = brushColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasW / 2, canvasH / 2);

    onCapture(canvas.toDataURL('image/png'));
  }, [typedText, userName, selectedFont, brushColor, onCapture]);

  return (
    <div className="space-y-3">
      {/* Text input */}
      <div className="space-y-1.5">
        <Label className="text-[10px] sm:text-xs font-semibold text-gray-600">Type your name</Label>
        <input
          type="text"
          value={typedText}
          placeholder={userName}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 sm:py-2.5 text-base sm:text-lg text-gray-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          style={{ fontFamily: selectedFont.css }}
          onChange={(e) => {
            setTypedText(e.target.value);
          }}
        />
      </div>

      {/* Font selector */}
      <div className="space-y-1.5">
        <Label className="text-[10px] sm:text-xs font-semibold text-gray-500">Font Style</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {SIGNATURE_FONTS.map((font) => (
            <button
              key={font.name}
              onClick={() => setSelectedFont(font)}
              className={`px-2 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all truncate ${
                selectedFont.name === font.name
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-100 hover:border-blue-300 hover:bg-blue-50/30'
              }`}
              style={{
                fontFamily: selectedFont.name === font.name ? undefined : font.css,
              }}
            >
              {font.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ink color presets */}
      <div className="space-y-1.5">
        <Label className="text-[10px] sm:text-xs font-semibold text-gray-500">Ink Color</Label>
        <div className="flex gap-1.5 items-center">
          {INK_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => onBrushColorChange(c.value)}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full aspect-square shrink-0 border-2 transition-all ${
                brushColor === c.value
                  ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                  : 'border-gray-200 hover:border-gray-400 hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
          {/* Custom color */}
          <label
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full aspect-square shrink-0 border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center relative"
            title="Custom color"
          >
            <input
              type="color"
              value={brushColor}
              onChange={(e) => onBrushColorChange(e.target.value)}
              className="w-10 h-10 -m-2 cursor-pointer opacity-0 absolute"
            />
            <span className="text-[8px] text-gray-400 font-bold pointer-events-none">+</span>
          </label>
        </div>
      </div>

      {/* Live preview — font scales to fit canvas width */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white hover:border-blue-300 transition-colors">
        <canvas
          ref={previewCanvasRef}
          style={{ width: '100%', height: 100, display: 'block' }}
          className="sm:!h-[120px]"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg text-xs"
          onClick={() => {
            setTypedText('');
          }}
        >
          Clear
        </Button>
        <Button
          size="sm"
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex-1 text-xs"
          onClick={handleGenerate}
        >
          Generate Signature
        </Button>
      </div>

      {/* Place on document */}
      {hasCapture && (
        <Button
          size="sm"
          className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs"
          onClick={onPlace}
        >
          ✓ Add to Document
        </Button>
      )}
    </div>
  );
};

export default TypedSignaturePanel;
