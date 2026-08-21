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
const MAX_PROCESS_PIXELS = 12_000_000;
const MAX_PROCESS_SIDE = 6000;
const MIN_COMPONENT_PIXELS = 8;

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

      // Use local contrast rather than an absolute brightness threshold. This
      // suppresses broad shadows because the local mean follows the shadow,
      // while ink remains a sharp negative contrast against the paper.
      const L = lValues[y * w + x];
      const contrast = mean - L;
      const inkThreshold = 2.5 + K_SAUVOLA * 2;
      alpha[y * w + x] = contrast > inkThreshold
        ? Math.min(255, Math.round((contrast - inkThreshold) * 48))
        : 0;
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
      // Deterministic, low-amplitude texture; never use Math.random in a signed artifact.
      const jitter = Math.sin((i + 1) * 12.9898 + w * 78.233 + h * 37.719) * 0.03 * alpha[i];
      out[i] = Math.max(0, Math.min(255, Math.round(alpha[i] + jitter)));
    }
  }
  return out;
}

function filterComponents(alpha: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(alpha.length);
  const visited = new Uint8Array(alpha.length);
  const maxArtifactArea = Math.floor(w * h * 0.02);
  const offsets = [-1, 0, 1];

  for (let start = 0; start < alpha.length; start++) {
    if (visited[start] || alpha[start] < 16) continue;
    const queue = [start];
    const component: number[] = [];
    visited[start] = 1;
    let touchesEdge = false;

    for (let q = 0; q < queue.length; q++) {
      const index = queue[q];
      component.push(index);
      const x = index % w;
      const y = Math.floor(index / w);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;

      for (const dy of offsets) {
        for (const dx of offsets) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const next = ny * w + nx;
          if (!visited[next] && alpha[next] >= 16) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }

    const keep = component.length >= MIN_COMPONENT_PIXELS &&
      component.length <= maxArtifactArea &&
      !(touchesEdge && component.length > w * h * 0.002);
    if (keep) {
      for (const index of component) output[index] = alpha[index];
    }
  }
  return output;
}

function cropTransparentCanvas(source: HTMLCanvasElement, padding = 12): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx) return source;
  const image = ctx.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (image.data[(y * source.width + x) * 4 + 3] >= 12) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return source;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(source.width - 1, maxX + padding);
  maxY = Math.min(source.height - 1, maxY + padding);
  const cropped = document.createElement('canvas');
  cropped.width = maxX - minX + 1;
  cropped.height = maxY - minY + 1;
  cropped.getContext('2d')!.drawImage(source, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped;
}

function autoOrientCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx) return source;
  const data = ctx.getImageData(0, 0, source.width, source.height).data;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (data[(y * source.width + x) * 4 + 3] >= 24) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const inkWidth = maxX - minX + 1;
  const inkHeight = maxY - minY + 1;
  const looksSideways = maxX >= 0 && inkHeight > inkWidth * 1.55 && source.height > source.width;
  if (!looksSideways) return source;

  const rotated = document.createElement('canvas');
  rotated.width = source.height;
  rotated.height = source.width;
  const rotatedContext = rotated.getContext('2d')!;
  rotatedContext.translate(rotated.width, 0);
  rotatedContext.rotate(Math.PI / 2);
  rotatedContext.drawImage(source, 0, 0);
  return rotated;
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
    autoRotate = true,
): Promise<string> {

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        const sourcePixels = sourceWidth * sourceHeight;
        if (!sourceWidth || !sourceHeight || sourcePixels > MAX_PROCESS_PIXELS) {
          throw new Error('Signature image exceeds the safe processing limit');
        }
        const scale = Math.min(1, MAX_PROCESS_SIDE / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
        const filteredMask = filterComponents(alphaMask, w, h);
        let retainedPixels = 0;
        for (const value of filteredMask) retainedPixels += value > 0 ? 1 : 0;
        if (retainedPixels > 32) {
          alphaMask = filteredMask;
        } else {
          // Low-contrast phone photos can defeat local-LAB thresholding. Use a
          // conservative absolute-darkness fallback only when the primary mask
          // found no meaningful ink, then apply the same component cleanup.
          const darkInk = new Uint8ClampedArray(w * h);
          for (let i = 0; i < w * h; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (luminance < 60) darkInk[i] = 255;
          }
          const darkFiltered = filterComponents(darkInk, w, h);
          let darkPixels = 0;
          for (const value of darkFiltered) darkPixels += value > 0 ? 1 : 0;
          alphaMask = darkPixels > 32 ? darkFiltered : darkInk;
        }

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
        const oriented = autoRotate ? autoOrientCanvas(canvas) : canvas;
        const cropped = cropTransparentCanvas(oriented);
        resolve(cropped.toDataURL('image/png'));
      } catch (error) {
        console.error('[SignatureRenderer] processing failed', error);
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
