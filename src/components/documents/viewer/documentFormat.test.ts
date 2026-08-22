import { describe, expect, it } from 'vitest';
import {
  clampDocumentZoom,
  detectDocumentType,
  rowsToSpreadsheetHtml,
} from './documentFormat';

describe('document format helpers', () => {
  it('detects the supported document families from extension or MIME type', () => {
    expect(detectDocumentType(new File(['%PDF'], 'agreement.pdf', { type: 'application/pdf' }))).toBe('pdf');
    expect(detectDocumentType(new File(['docx'], 'agreement.docx', { type: '' }))).toBe('word');
    expect(detectDocumentType(new File(['xlsx'], 'budget.xlsx', { type: '' }))).toBe('excel');
    expect(detectDocumentType(new File(['image'], 'signature.png', { type: 'image/png' }))).toBe('image');
    expect(detectDocumentType(new File(['html'], 'export.html', { type: 'text/html' }))).toBe('html');
    expect(detectDocumentType(new File(['rtf'], 'legacy.rtf', { type: 'application/rtf' }))).toBe('unsupported');
  });

  it('clamps zoom to the shared viewer range', () => {
    expect(clampDocumentZoom(0)).toBe(30);
    expect(clampDocumentZoom(130)).toBe(130);
    expect(clampDocumentZoom(999)).toBe(300);
  });

  it('escapes spreadsheet values before they reach sanitized HTML rendering', () => {
    const html = rowsToSpreadsheetHtml([['Name', '<script>alert(1)</script>'], ['A', '&']]);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<script>');
  });
});
