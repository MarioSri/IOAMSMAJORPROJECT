# Document Rendering Reference Notes

## Official sources consulted

- Adobe Acrobat e-signature preparation: https://helpx.adobe.com/acrobat/desktop/e-sign-documents/request-e-signatures/send-for-signing.html
  - Supports DOC, DOCX, RTF, XLS, XLSX, PPT, PPTX, TXT, CSV, HTML, TIFF, TIF, BMP, GIF, JPG, JPEG, and PNG.
  - Uses a prepare-document flow where users choose field types, click the document to place fields, drag and drop fields, assign recipients, and customize, copy, clone, or delete fields.

- Zoho Sign PDF signing: https://www.zoho.com/sign/how-to-add-digital-signature-adobe-pdf.html
  - Supports upload/import of PDFs, signature setup by typing, drawing, or uploading an image, drag-and-drop field placement, field auto-detection for fillable PDFs, and recipient assignment.

- OpenSign document editing: https://docs.opensignlabs.com/docs/help/New-Document/edit-document-before-sending/
  - Documents have zoom in/out controls, page add/delete/reorder controls, page rotation, prefill widgets, and signer widgets placed by drag and drop.

- read-excel-file official repository: https://github.com/catamphetamine/read-excel-file
  - The browser package's default export returns all workbook sheets as objects containing sheet name and data; the named readSheet API reads one sheet.
  - Browser parsing supports XLSX, not legacy binary XLS. Large files can affect CPU/memory; the package supports worker-based browser reading.

- Mammoth official repository: https://github.com/mwilliamson/mammoth.js
  - Converts DOCX to HTML and supports headings, lists, tables, images, links, and common text formatting.
  - It does not sanitize source documents; output must be sanitized before insertion into the DOM.
  - Conversion is not a pixel-perfect reproduction of complex DOCX layout.

## Implementation decisions

- PDF.js remains the PDF renderer and now uses the bundled, version-matched worker rather than a CDN worker URL.
- DOCX is rendered through Mammoth HTML and sanitized before display.
- XLSX is parsed with the installed read-excel-file/browser package and all sheets are rendered with escaped values and sheet headings.
- PDF, DOCX, XLSX, and image viewers use the same 30%-300% zoom range and transform-based scaling.
- Signatures use normalized page percentages, measured against the active rendered document surface, so placement remains stable across responsive widths and zoom levels.
- Pointer events replace the duplicate touch-to-mouse bridge for desktop, tablet, and mobile drag/resize behavior.
- PDF signed output remains a real PDF when original bytes are available. Signed DOCX/XLSX outputs are rendered signed copies as PNG because the browser implementation does not modify OOXML binaries; returning the original Office bytes as a signed file would produce an unsigned download.
