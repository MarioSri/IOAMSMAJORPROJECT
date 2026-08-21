/**
 * useDocumentLoader
 * Extracts all file parsing logic from the monolith.
 * Handles: PDF, DOCX, XLSX, Images, HTML.
 */
import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import readXlsxFile from 'read-excel-file/browser';
import {
  detectDocumentType,
  MAX_SPREADSHEET_BYTES,
  PDF_RENDER_SCALE,
  spreadsheetPageToHtml,
  type DocumentType,
} from './documentFormat';

// PDF.js worker (singleton setup — safe to call multiple times). Keeping the
// worker local guarantees it stays version-matched with the bundled renderer.
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

export interface FileContent {
  type: 'pdf' | 'word' | 'excel' | 'image' | 'unsupported';
  pageCanvases?: string[];
  totalPages?: number;
  url?: string;
  html?: string;
  originalMimeType?: string;
  sheetNames?: string[];
}

export async function parsePDF(file: File): Promise<FileContent> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCanvases: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({
      canvasContext: ctx,
      viewport,
    } as import('pdfjs-dist/types/src/display/api').RenderParameters).promise;
    pageCanvases.push(canvas.toDataURL('image/png'));
  }

  return { type: 'pdf', pageCanvases, totalPages: pdf.numPages };
}

export async function parseWord(file: File): Promise<FileContent> {
  if (file.name.toLowerCase().endsWith('.doc')) {
    throw new Error('Legacy .doc files are not browser-renderable. Export the document as .docx or PDF and upload it again.');
  }
  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return { type: 'word', html: result.value };
}

export async function parseExcel(file: File): Promise<FileContent> {
  if (file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('Legacy .xls files are not browser-renderable. Export the workbook as .xlsx or PDF and upload it again.');
  }
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new Error('Spreadsheet exceeds the 10 MB browser parsing limit');
  }
  const sheets = await readXlsxFile(file);
  const sheetNames = sheets.map((sheet) => sheet.sheet);
  const html = sheets
    .map((sheet) => spreadsheetPageToHtml(sheet.sheet, sheet.data as unknown[][]))
    .join('');
  return { type: 'excel', html, sheetNames };
}

export function parseImage(file: File): FileContent {
  return { type: 'image', url: URL.createObjectURL(file) };
}

export function detectFileType(file: File): DocumentType {
  return detectDocumentType(file);
}

export function useDocumentLoader() {
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [actualDocDimensions, setActualDocDimensions] = useState({ width: 800, height: 1200 });

  const loadFile = useCallback(async (file: File) => {
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);

    try {
      const kind = detectFileType(file);
      let content: FileContent;

      switch (kind) {
        case 'pdf':
          content = await parsePDF(file);
          break;
        case 'word':
          content = await parseWord(file);
          break;
        case 'excel':
          content = await parseExcel(file);
          break;
        case 'image':
          content = parseImage(file);
          content.originalMimeType = file.type;
          break;
        case 'html': {
          const text = await file.text();
          content = { type: 'word', html: text, originalMimeType: file.type };
          break;
        }
        default:
          content = { type: 'unsupported' };
      }

      if (content.type === 'word' || content.type === 'excel' || content.type === 'pdf') {
        content.originalMimeType = file.type;
      }

      setFileContent(content);

      // Calculate actual document dimensions for coordinate mapping
      if (content.type === 'pdf' && content.pageCanvases?.length) {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = content.pageCanvases![0];
        });
        setActualDocDimensions({ width: img.width, height: img.height });
      } else if (content.type === 'image' && content.url) {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = content.url!;
        });
        setActualDocDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      } else if (content.type === 'word' || content.type === 'excel') {
        setActualDocDimensions({ width: 1200, height: 1600 });
      } else {
        setActualDocDimensions({ width: 800, height: 1200 });
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, []);

  const updateActualDocDimensions = useCallback((dimensions: { width: number; height: number }) => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      setActualDocDimensions(dimensions);
    }
  }, []);

  const clearFile = useCallback(() => {
    setFileContent(null);
    setFileError(null);
    setActualDocDimensions({ width: 800, height: 1200 });
  }, []);

  return {
    fileContent,
    fileLoading,
    fileError,
    actualDocDimensions,
    updateActualDocDimensions,
    loadFile,
    clearFile,
  };
}
