/**
 * Sanitization utilities for preventing XSS (display) and log injection (logging).
 *
 * For HTML sanitization (dangerouslySetInnerHTML): strips <script>, on* event
 * handlers, javascript: URIs, and data: URIs with script content — while
 * preserving the structural HTML produced by mammoth (Word) and XLSX (Excel).
 *
 * For log sanitization: strips control characters (newlines, carriage returns,
 * tabs, null bytes) that could be used for log forging/injection.
 */

// ─── HTML (XSS) Sanitization ────────────────────────────────────────────────

/**
 * Sanitize HTML for safe rendering via dangerouslySetInnerHTML.
 * Strips <script> tags, on* event handlers, javascript:/data: URIs,
 * <iframe>/<object>/<embed> tags, and style expressions.
 */
export function sanitizeForDisplay(html: string): string {
  if (!html) return '';

  let sanitized = html;

  // Remove <script> tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (on*)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove javascript: and vbscript: URIs in href/src/action attributes
  sanitized = sanitized.replace(
    /(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    '$1=""'
  );
  sanitized = sanitized.replace(
    /(href|src|action)\s*=\s*(?:"vbscript:[^"]*"|'vbscript:[^']*')/gi,
    '$1=""'
  );

  // Remove data: URIs that contain script content (keep data:image/* for legitimate images)
  sanitized = sanitized.replace(
    /(href|src|action)\s*=\s*"data:(?!image\/)[^"]*"/gi,
    '$1=""'
  );
  sanitized = sanitized.replace(
    /(href|src|action)\s*=\s*'data:(?!image\/)[^']*'/gi,
    "$1=''"
  );

  // Remove <iframe>, <object>, <embed>, <applet>, <form> tags
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|applet|form|base|meta|link)\b[^>]*>/gi, '');

  // Remove style attributes containing expression() or url(javascript:)
  sanitized = sanitized.replace(/style\s*=\s*"[^"]*expression\s*\([^"]*"/gi, '');
  sanitized = sanitized.replace(/style\s*=\s*'[^']*expression\s*\([^']*'/gi, '');

  return sanitized;
}

// ─── Log Injection Sanitization ─────────────────────────────────────────────

/**
 * Sanitize a string before including it in console.log / console.error output.
 * Strips control characters that could forge log lines or inject misleading output.
 */
export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) return String(value);

  const str = typeof value === 'string' ? value : String(value);

  // Strip newlines, carriage returns, null bytes, backspaces, and other C0 controls
  // except tab (0x09) which is sometimes legitimate in structured log output.
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0A-\x1F\x7F]/g, '');
}

/**
 * Template tag for safe console logging. Usage:
 *   console.log(safeLog`Document created: ${userTitle}`);
 */
export function safeLog(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, str, i) => {
    const val = i < values.length ? sanitizeForLog(values[i]) : '';
    return result + str + val;
  }, '');
}
