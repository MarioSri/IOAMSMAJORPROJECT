export type DocumentType = 'pdf' | 'word' | 'excel' | 'image' | 'html' | 'unsupported';

export const DOCUMENT_ZOOM_STEP = 10;
export const DOCUMENT_ZOOM_MIN = 30;
export const DOCUMENT_ZOOM_MAX = 300;
export const PDF_RENDER_SCALE = 2;
export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

export interface RenderedDocumentPage {
  label: string;
  html: string;
}

export function clampDocumentZoom(value: number): number {
  return Math.max(DOCUMENT_ZOOM_MIN, Math.min(DOCUMENT_ZOOM_MAX, value));
}

export function detectDocumentType(file: Pick<File, 'name' | 'type'>): DocumentType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/.test(name)) return 'image';
  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml') ||
    name.endsWith('.docx')
  ) return 'word';
  if (
    mime.includes('sheet') ||
    mime.includes('officedocument.spreadsheetml') ||
    /\.(xlsx?|csv)$/.test(name)
  ) return 'excel';
  if (mime.includes('html') || /\.html?$/.test(name)) return 'html';
  return 'unsupported';
}

export function escapeDocumentHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

export function rowsToSpreadsheetHtml(rows: unknown[][]): string {
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeDocumentHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><tbody>${body}</tbody></table>`;
}

export function spreadsheetPageToHtml(label: string, rows: unknown[][]): string {
  return `<section data-sheet-name="${escapeDocumentHtml(label)}"><h2>${escapeDocumentHtml(label)}</h2>${rowsToSpreadsheetHtml(rows)}</section>`;
}
