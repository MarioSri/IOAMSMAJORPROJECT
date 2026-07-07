/**
 * AdobeRenderEngine
 * Adobe-level signature rendering pipeline:
 *  1. LAB-space adaptive ink extraction (replaces naive global luminance threshold)
 *  2. Paper-brightness matching (multiply blend math)
 *  3. Micro-noise for organic texture
 *  4. Micro-blur for natural anti-aliasing
 *
 * Internal implementation — inspired by professional e-signature rendering techniques.
 * Does NOT use any external APIs.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Color-space helpers
// ──────────────────────────────────────────────────────────────────────────────

/** sRGB → linear RGB */
function linearize(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/** Linear RGB → CIE LAB L* (0-100) */
function rgbToL(r: number, g: number, b: number): number {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);
  // Rec.709 luminance
  const Y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  // LAB f(Y/Yn), Yn=1
  const fy = Y > 0.008856 ? Math.cbrt(Y) : 7.787 * Y + 16 / 116;
  return 116 * fy - 16; // L* in [0, 100]
}

// ──────────────────────────────────────────────────────────────────────────────
// Adaptive local threshold (inspired by Sauvola binarization, CPU-friendly version)
// ──────────────────────────────────────────────────────────────────────────────

function buildIntegralMap(lValues: Float32Array, w: number, h: number): Float64Array {
  const integral = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const val = lValues[idx];
      const left = x > 0 ? integral[idx - 1] : 0;
      const top = y > 0 ? integral[idx - w] : 0;
      const topLeft = x > 0 && y > 0 ? integral[idx - w - 1] : 0;
      integral[idx] = val + left + top - topLeft;
    }
  }
  return integral;
}

function getAreaSum(integral: Float64Array, x1: number, y1: number, x2: number, y2: number, w: number): number {
  const br = integral[y2 * w + x2];
  const bl = x1 > 0 ? integral[y2 * w + (x1 - 1)] : 0;
  const tr = y1 > 0 ? integral[(y1 - 1) * w + x2] : 0;
  const tl = x1 > 0 && y1 > 0 ? integral[(y1 - 1) * w + (x1 - 1)] : 0;
  return br - bl - tr + tl;
}

const WINDOW_RADIUS = 15; // adaptive window half-size
const K_SAUVOLA = 0.18;    // sensitivity (0.1–0.5)
const R_MAX = 128;         // dynamic range normalizer

/**
 * Adaptive per-pixel threshold using local mean via integral image.
 * Returns alpha (0–255) for each pixel: 0 = background, 255 = ink.
 */
function adaptiveThreshold(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  // Step 1: compute L* for every pixel
  const lValues = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lValues[i] = rgbToL(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }

  // Step 2: integral image for fast local mean
  const integral = buildIntegralMap(lValues, w, h);

  // Step 3: build alpha mask
  const alpha = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - WINDOW_RADIUS);
      const y1 = Math.max(0, y - WINDOW_RADIUS);
      const x2 = Math.min(w - 1, x + WINDOW_RADIUS);
      const y2 = Math.min(h - 1, y + WINDOW_RADIUS);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = getAreaSum(integral, x1, y1, x2, y2, w);
      const mean = sum / count;

      // Sauvola: threshold = mean * (1 + k * (std/R - 1))
      // Simplified: use mean-based threshold with sensitivity factor
      const L = lValues[y * w + x];
      const threshold = mean * (1 - K_SAUVOLA) + R_MAX * K_SAUVOLA;
      alpha[y * w + x] = L < threshold ? 255 : 0;
    }
  }
  return alpha;
}

// ──────────────────────────────────────────────────────────────────────────────
// Gaussian micro-blur (1-pass approximation, 3×3 kernel)
// ──────────────────────────────────────────────────────────────────────────────

function applyMicroBlur(alpha: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kSum = 16;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      let ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          acc += alpha[ny * w + nx] * kernel[ki++];
        }
      }
      out[y * w + x] = Math.round(acc / kSum);
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Micro-noise for organic ink texture
// ──────────────────────────────────────────────────────────────────────────────

function addMicroNoise(alpha: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha.length);
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] > 0) {
      // ±3% random jitter on ink pixels only
      const jitter = (Math.random() - 0.5) * 0.06 * alpha[i];
      out[i] = Math.max(0, Math.min(255, Math.round(alpha[i] + jitter)));
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Paper brightness matching
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Sample average lightness of a region from the document canvas.
 * Returns a factor [0.7-1.0] to darken ink to match paper tone.
 */
export function sampleDocumentBrightness(
  docCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const ctx = docCanvas.getContext('2d');
  if (!ctx) return 1.0;
  const px = Math.max(0, Math.floor(x));
  const py = Math.max(0, Math.floor(y));
  const pw = Math.max(1, Math.floor(w));
  const ph = Math.max(1, Math.floor(h));
  try {
    const data = ctx.getImageData(px, py, pw, ph).data;
    let totalL = 0;
    const count = pw * ph;
    for (let i = 0; i < data.length; i += 4) {
      totalL += rgbToL(data[i], data[i + 1], data[i + 2]);
    }
    const avgL = totalL / count; // 0-100
    // Map: bright paper (L=90+) → factor=0.95, dark area (L=50) → factor=0.75
    return 0.7 + (avgL / 100) * 0.25;
  } catch {
    return 1.0;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * extractInk
 * Full Adobe-level ink extraction pipeline.
 * Works on both uploaded handwritten signatures AND canvas-drawn strokes.
 *
 * For DRAWN signatures:
 *   - Detects ink pixels via adaptive LAB threshold
 *   - Replaces their color with the chosen inkColor
 *   - Background pixels are fully transparent (alpha = 0)
 *
 * For UPLOADED images (skipColorize = true):
 *   - Only removes the white background (transparency extraction)
 *   - NEVER replaces original pixel colors — preserves the real image
 *
 * @param imageDataUrl   - data:image/... URL of the raw signature
 * @param inkColor       - target ink colour hex (default: '#000000')
 * @param brightnessFactor - paper brightness factor from sampleDocumentBrightness
 * @param skipColorize   - when true, only remove white background; keep original colors
 * @returns Promise<string> - transparent PNG data:image/png URL (ink only)
 */
export function extractInk(
  imageDataUrl: string,
  inkColor = '#000000',
  brightnessFactor = 0.95,
  skipColorize = false,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Step 1: adaptive LAB threshold → ink mask (detects dark strokes)
        let alphaMask = adaptiveThreshold(data, w, h);

        // Step 2: micro-blur for natural anti-aliasing at ink edges
        alphaMask = applyMicroBlur(alphaMask, w, h);

        // Step 3: organic micro-noise on ink pixels
        alphaMask = addMicroNoise(alphaMask, w, h);

        if (skipColorize) {
          // ── UPLOAD mode: preserve original colors, only make background transparent ──
          // Apply the alpha mask to the original pixel data without changing RGB
          for (let i = 0; i < w * h; i++) {
            // Keep original R, G, B — only set alpha from the mask
            data[i * 4 + 3] = alphaMask[i];
          }
        } else {
          // ── DRAW / TYPE mode: replace ink pixels with the chosen color ──
          const r = parseInt(inkColor.slice(1, 3), 16);
          const g = parseInt(inkColor.slice(3, 5), 16);
          const b = parseInt(inkColor.slice(5, 7), 16);

          for (let i = 0; i < w * h; i++) {
            const a = alphaMask[i];
            if (a === 0) {
              // Transparent background — clear all channels
              data[i * 4]     = 0;
              data[i * 4 + 1] = 0;
              data[i * 4 + 2] = 0;
              data[i * 4 + 3] = 0;
            } else {
              // Ink pixel — apply chosen color with paper brightness adaptation
              const factor = brightnessFactor;
              data[i * 4]     = Math.round(r * factor);
              data[i * 4 + 1] = Math.round(g * factor);
              data[i * 4 + 2] = Math.round(b * factor);
              data[i * 4 + 3] = a;
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageDataUrl); // Graceful fallback
      }
    };

    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

/**
 * Legacy compatibility shim — same API as the old removeWhiteBackground,
 * now powered by the Adobe-level pipeline.
 */
export const removeWhiteBackground = (imageData: string): Promise<string> =>
  extractInk(imageData);
