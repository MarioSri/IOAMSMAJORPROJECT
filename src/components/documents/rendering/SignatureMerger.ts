/**
 * SignatureMerger — bakes signature overlays into document output
 * Extracted from the monolith's mergeSignaturesWithDocument function.
 * Adds background queue with progress callbacks for 20+ file batch scenarios.
 *
 * Supports:
 *  - PDF  → Real PDF output with embedded signatures via pdf-lib (primary)
 *         → Canvas-based PNG fallback (secondary)
 *  - Image (PNG/JPG) → Canvas merge with multiply blend
 *  - Word/Excel (HTML) → html2canvas capture with signature overlays
 *
 * Coordinate System (DocuSeal-inspired):
 *  - Signatures stored as 0-1 normalized fractions (xPercent, yPercent, widthPercent, heightPercent)
 *  - PDF embedding uses Y-inversion: y = pageHeight - (yPercent * pageHeight) - sigHeight
 *  - Canvas/HTML embedding uses top-left origin (no inversion needed)
 */
import { degrees, PDFDocument } from 'pdf-lib';
import type { SignatureMetadata } from '../signature/useSignatureEngine';

export interface SignedFile {
  name: string;
  type: string;
  size: number;
  data: string; // base64 data URL
}

export interface FileContent {
  type: 'pdf' | 'word' | 'excel' | 'image' | 'unsupported';
  pageCanvases?: string[];
  totalPages?: number;
  url?: string;
  html?: string;
  originalMimeType?: string;
}

export type MergeProgressCallback = (pageIndex: number, totalPages: number) => void;

/** Normalize embedded PDF page rotation to the canonical quarter-turn values. */
export function normalizePdfRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

/**
 * Convert a position in the visually oriented page space into pdf-lib's
 * bottom-left coordinate space. This mirrors the rotation mapping used by
 * Documenso when exporting fields into rotated PDFs.
 */
export function adjustPdfPositionForRotation(
  pageWidth: number,
  pageHeight: number,
  xPos: number,
  yPos: number,
  rotation: 0 | 90 | 180 | 270,
): { xPos: number; yPos: number } {
  if (rotation === 270) {
    xPos = pageWidth - xPos;
    [xPos, yPos] = [yPos, xPos];
  }

  if (rotation === 90) {
    yPos = pageHeight - yPos;
    [xPos, yPos] = [yPos, xPos];
  }

  if (rotation === 180) {
    xPos = pageWidth - xPos;
    yPos = pageHeight - yPos;
  }

  return { xPos, yPos };
}

/** Draw a single signature onto a canvas context */
async function drawSignatureOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  signature: SignatureMetadata,
): Promise<void> {
  const canvasX = signature.xPercent * canvas.width;
  const canvasY = signature.yPercent * canvas.height;
  const canvasW = signature.widthPercent * canvas.width;
  const canvasH = signature.heightPercent * canvas.height;

  const sigImg = new Image();
  await new Promise<void>((resolve) => {
    sigImg.onload = () => resolve();
    sigImg.onerror = () => resolve(); // Gracefully skip broken images
    sigImg.src = signature.data;
  });

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(canvasX + canvasW / 2, canvasY + canvasH / 2);
  ctx.rotate((signature.rotation * Math.PI) / 180);
  ctx.drawImage(sigImg, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
  ctx.restore();
}

/**
 * Filter signatures that belong to a specific page and file.
 * Handles undefined pageNumber gracefully — treats it as matching any page
 * (critical for single-page PDFs where pageNumber may be undefined).
 */
function filterSignaturesForPage(
  signatures: SignatureMetadata[],
  pageNum: number,
  fileIndex: number,
): SignatureMetadata[] {
  return signatures.filter(
    (sig) =>
      (sig.pageNumber === pageNum || sig.pageNumber === undefined) &&
      (sig.fileIndex === undefined || sig.fileIndex === fileIndex),
  );
}

// ── PDF Merge: Real PDF output via pdf-lib ─────────────────────────────────────

/**
 * Merge signatures into a real PDF file using pdf-lib.
 * Uses Y-inversion for PDF coordinate system (origin = bottom-left).
 * Inspired by DocuSeal's generate_result_attachments.rb coordinate mapping.
 */
export async function mergePdfSignaturesToPdf(
  originalPdfBytes: ArrayBuffer,
  signatures: SignatureMetadata[],
  fileName: string,
  fileIndex: number,
  onProgress?: MergeProgressCallback,
): Promise<SignedFile[]> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const rawPageSize = page.getSize();
    const pageRotation = normalizePdfRotation(page.getRotation().angle);
    const isLandscapeRotation = pageRotation === 90 || pageRotation === 270;
    const pageWidth = isLandscapeRotation ? rawPageSize.height : rawPageSize.width;
    const pageHeight = isLandscapeRotation ? rawPageSize.width : rawPageSize.height;
    const pageNum = pageIdx + 1;

    onProgress?.(pageIdx, pages.length);

    const pageSigs = filterSignaturesForPage(signatures, pageNum, fileIndex);

    for (const sig of pageSigs) {
      if (!sig.data) continue;
      try {
        // Convert base64 data URL to bytes
        const base64Data = sig.data.split(',')[1];
        if (!base64Data) continue;
        const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

        // Try embedding as PNG first, then JPEG
        let pngImage;
        try {
          pngImage = await pdfDoc.embedPng(imgBytes);
        } catch {
          try {
            pngImage = await pdfDoc.embedJpg(imgBytes);
          } catch (embedErr) {
            console.warn('Failed to embed signature image on page', pageNum, embedErr);
            continue;
          }
        }

        const sigWidth = sig.widthPercent * pageWidth;
        const sigHeight = sig.heightPercent * pageHeight;
        const visualSigX = sig.xPercent * pageWidth;
        // Y-inversion: PDF origin is bottom-left (DocuSeal pattern)
        const visualSigY = pageHeight - (sig.yPercent * pageHeight) - sigHeight;
        const adjustedPosition = adjustPdfPositionForRotation(
          pageWidth,
          pageHeight,
          visualSigX,
          visualSigY,
          pageRotation,
        );

        page.drawImage(pngImage, {
          x: adjustedPosition.xPos,
          y: adjustedPosition.yPos,
          width: sigWidth,
          height: sigHeight,
          rotate: degrees((pageRotation + (sig.rotation || 0)) % 360),
          opacity: 1,
        });
      } catch (err) {
        console.warn('Failed to draw signature on page', pageNum, err);
      }
    }
  }

  onProgress?.(pages.length, pages.length);

  const pdfBytes = await pdfDoc.save();
  // Using .buffer to resolve Uint8Array/SharedArrayBuffer type mismatch in strict environments
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  // Clean up file name
  const cleanName = fileName.replace(/\.[^/.]+$/, '');

  return [
    {
      name: `${cleanName}_signed.pdf`,
      type: 'application/pdf',
      size: pdfBytes.length,
      data: dataUrl,
    },
  ];
}

// ── PDF Merge: Canvas-based PNG fallback ───────────────────────────────────────

/**
 * Merge signature overlays into a PDF (each page → PNG output).
 * Uses multiply blend mode for natural ink-on-paper appearance.
 * Fallback when original PDF bytes are not available.
 */
export async function mergePdfSignatures(
  pageCanvases: string[],
  signatures: SignatureMetadata[],
  fileName: string,
  fileIndex: number,
  onProgress?: MergeProgressCallback,
): Promise<SignedFile[]> {
  const signedFiles: SignedFile[] = [];

  for (let pageIdx = 0; pageIdx < pageCanvases.length; pageIdx++) {
    const pageNum = pageIdx + 1;
    onProgress?.(pageIdx, pageCanvases.length);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Load page image
    const pageImg = new Image();
    await new Promise<void>((resolve, reject) => {
      pageImg.onload = () => resolve();
      pageImg.onerror = reject;
      pageImg.src = pageCanvases[pageIdx];
    });

    canvas.width = pageImg.width;
    canvas.height = pageImg.height;
    ctx.drawImage(pageImg, 0, 0);

    // Draw matching signatures for this page and file
    // Uses filterSignaturesForPage which handles undefined pageNumber
    const pageSigs = filterSignaturesForPage(signatures, pageNum, fileIndex);

    for (const sig of pageSigs) {
      await drawSignatureOnCanvas(ctx, canvas, sig);
    }

    signedFiles.push({
      name: `${fileName}_signed_page_${pageNum}.png`,
      type: 'image/png',
      size: 0,
      data: canvas.toDataURL('image/png'),
    });
  }

  onProgress?.(pageCanvases.length, pageCanvases.length);
  return signedFiles;
}

// ── Image Merge ────────────────────────────────────────────────────────────────

/**
 * Merge signature overlays into an image file.
 */
export async function mergeImageSignatures(
  imageUrl: string,
  signatures: SignatureMetadata[],
  fileName: string,
  fileIndex: number,
  originalMimeType: string = 'image/png'
): Promise<SignedFile[]> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = imageUrl;
  });

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);

  const imageSigs = signatures.filter(
    (sig) => sig.fileIndex === undefined || sig.fileIndex === fileIndex,
  );
  for (const sig of imageSigs) {
    await drawSignatureOnCanvas(ctx, canvas, sig);
  }

  const targetType = originalMimeType === 'image/jpeg' || originalMimeType === 'image/jpg' ? 'image/jpeg' : 'image/png';
  const targetExt = targetType === 'image/jpeg' ? 'jpg' : 'png';
  const cleanName = fileName.replace(/\.[^/.]+$/, '');

  return [
    {
      name: `${cleanName}_signed.${targetExt}`,
      type: targetType,
      size: 0,
      data: canvas.toDataURL(targetType, 0.95),
    },
  ];
}

// ── Word/Excel HTML Merge ──────────────────────────────────────────────────────

/**
 * Merge signature overlays into HTML content (DOCX/XLSX rendered as HTML).
 * Creates an off-screen container, overlays signatures at percentage positions,
 * and captures via html2canvas.
 */
export async function mergeHtmlSignatures(
  htmlContent: string,
  signatures: SignatureMetadata[],
  fileName: string,
  fileIndex: number,
): Promise<SignedFile[]> {
  const fileSigs = signatures.filter(
    (sig) => (sig.fileIndex === undefined || sig.fileIndex === fileIndex) && sig.data,
  );
  if (fileSigs.length === 0) return [];

  // Create off-screen container
  const container = document.createElement('div');
  // Match the signing viewer's Office-document coordinate space so the
  // persisted percentages map to the same visible page geometry.
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1200px;background:white;';

  // Create wrapper with relative positioning for signature overlays.
  const contentWrapper = document.createElement('div');
  contentWrapper.style.cssText =
    'position:relative;width:1200px;min-height:1600px;box-sizing:border-box;padding:40px;background:white;';
  contentWrapper.innerHTML = htmlContent;

  // Add signature overlays
  for (const sig of fileSigs) {
    const sigContainer = document.createElement('div');
    sigContainer.style.cssText = `position:absolute;left:${sig.xPercent * 100}%;top:${sig.yPercent * 100}%;width:${sig.widthPercent * 100}%;height:${sig.heightPercent * 100}%;pointer-events:none;`;

    const imgEl = document.createElement('img');
    imgEl.src = sig.data;
    imgEl.style.cssText =
      'width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;';
    sigContainer.appendChild(imgEl);
    contentWrapper.appendChild(sigContainer);
  }

  container.appendChild(contentWrapper);
  document.body.appendChild(container);

  try {
    // Dynamic import — html2canvas only loaded when needed
    const { default: html2canvas } = await import('html2canvas');
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    }));

    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2, // 2× for crisp output
      useCORS: true,
      logging: false,
    });

    return [
      {
        name: `${fileName.replace(/\.[^/.]+$/, '')}_signed.png`,
        type: 'image/png',
        size: 0,
        data: canvas.toDataURL('image/png'),
      },
    ];
  } catch (err) {
    console.warn('html2canvas merge failed:', err);
    return [];
  } finally {
    container.remove();
  }
}

// ── Master Dispatcher ──────────────────────────────────────────────────────────

/**
 * Master merge dispatcher.
 * Supports: PDF (real PDF via pdf-lib, or PNG fallback), Image, Word, Excel.
 *
 * @param originalFileBytes - If provided for a PDF, produces a real PDF output
 *   with embedded signatures. For DOCX/XLSX, the bytes are retained for batch
 *   preservation while the signed target is emitted from the sanitized render.
 */
export async function mergeSignaturesWithDocument(
  fileContent: FileContent,
  signatures: SignatureMetadata[],
  fileName: string,
  fileIndex: number,
  onProgress?: MergeProgressCallback,
  originalFileBytes?: ArrayBuffer,
): Promise<SignedFile[]> {
  if (signatures.length === 0) return [];

  if (fileContent.type === 'pdf') {
    // Prefer real PDF output if original bytes available
    if (originalFileBytes) {
      return mergePdfSignaturesToPdf(
        originalFileBytes,
        signatures,
        fileName,
        fileIndex,
        onProgress,
      );
    }
    // Fallback to canvas-based PNG pages
    if (fileContent.pageCanvases) {
      return mergePdfSignatures(
        fileContent.pageCanvases,
        signatures,
        fileName,
        fileIndex,
        onProgress,
      );
    }
  }

  if (fileContent.type === 'image' && fileContent.url) {
    return mergeImageSignatures(fileContent.url, signatures, fileName, fileIndex, fileContent.originalMimeType);
  }

  // DOCX/XLSX are rendered through the same sanitized HTML surface used by
  // the signing viewer. Their original OOXML bytes are not returned as a
  // "signed" file because that would preserve an unsigned binary artifact.
  if ((fileContent.type === 'word' || fileContent.type === 'excel') && fileContent.html) {
    return mergeHtmlSignatures(fileContent.html, signatures, fileName, fileIndex);
  }

  return [];
}

// ── Batch Merge ────────────────────────────────────────────────────────────────

/**
 * Background batch merge for 20+ files.
 * Uses a microtask queue to yield between files and keep UI responsive.
 */
export async function batchMergeFiles(params: {
  files: Array<{
    fileContent: FileContent;
    fileName: string;
    fileIndex: number;
    originalFileBytes?: ArrayBuffer;
  }>;
  signatures: SignatureMetadata[];
  onFileProgress: (fileIndex: number, totalFiles: number, pageDone: number, totalPages: number) => void;
}): Promise<SignedFile[][]> {
  const { files, signatures, onFileProgress } = params;
  const results: SignedFile[][] = [];

  for (let i = 0; i < files.length; i++) {
    const { fileContent, fileName, fileIndex, originalFileBytes } = files[i];

    // Yield to UI thread between files
    await new Promise((r) => setTimeout(r, 0));

    const fileSigs = signatures.filter(
      (s) => s.fileIndex === undefined || s.fileIndex === fileIndex,
    );

    const signedPages = await mergeSignaturesWithDocument(
      fileContent,
      fileSigs,
      fileName,
      fileIndex,
      (pageIdx, totalPages) => onFileProgress(i, files.length, pageIdx, totalPages),
      originalFileBytes,
    );

    results.push(signedPages);
  }

  return results;
}
