import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Loader2, FileX } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import readXlsxFile from 'read-excel-file/browser';
import { supabaseStorageService } from '@/services/SupabaseStorageService';
import { supabase } from '@/lib/supabase';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

interface FileEntry {
  file_name?: string;
  name?: string;
  file_type?: string;
  type?: string;
  storage_path?: string;
  data?: string;
}

interface Document {
  id: string;
  title: string;
  type: string;
  description: string;
  submittedBy: string;
  date: string;
  approvalCard?: Record<string, unknown>;
}

interface AISummarizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  approvalCard?: {
    id: string;
    title: string;
    description: string;
    files?: FileEntry[];
  };
}

// ---------------------------------------------------------------------------
// Helper: base64 → ArrayBuffer
// ---------------------------------------------------------------------------
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64.split(',')[1] || base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Helper: base64 data URL → Blob
// ---------------------------------------------------------------------------
function base64ToBlob(base64Data: string, mimeType: string): Blob {
  const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ---------------------------------------------------------------------------
// File content extractors (client-side, for text-extractable formats)
// ---------------------------------------------------------------------------

async function extractPDFContent(base64Data: string): Promise<string> {
  try {
    console.log('📄 [AI Summarizer] Extracting PDF content...');
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => (item as { str: string }).str).join(' ');
      fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
    }
    console.log('✅ [AI Summarizer] Extracted PDF content:', fullText.length, 'chars from', pdf.numPages, 'pages');
    return fullText;
  } catch (error) {
    console.error('❌ [AI Summarizer] PDF extraction error:', error);
    return '';
  }
}

async function extractWordContent(base64Data: string): Promise<string> {
  try {
    console.log('📝 [AI Summarizer] Extracting Word document content...');
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    const result = await mammoth.extractRawText({ arrayBuffer });
    console.log('✅ [AI Summarizer] Extracted Word content:', result.value.length, 'chars');
    return result.value;
  } catch (error) {
    console.error('❌ [AI Summarizer] Word extraction error:', error);
    return '';
  }
}

async function extractExcelContent(base64Data: string): Promise<string> {
  try {
    console.log('📊 [AI Summarizer] Extracting Excel content...');
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    if (arrayBuffer.byteLength > MAX_SPREADSHEET_BYTES) {
      throw new Error('Spreadsheet exceeds the 10 MB browser parsing limit');
    }
    const rows = await readXlsxFile(arrayBuffer);
    const fullText = rows
      .map((row) => row.map((cell) => String(cell ?? '')).join(','))
      .join('\n');
    console.log('✅ [AI Summarizer] Extracted Excel content:', fullText.length, 'chars');
    return fullText;
  } catch (error) {
    console.error('❌ [AI Summarizer] Excel extraction error:', error instanceof Error ? error.message : 'unknown error');
    return '';
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AISummarizerModal: React.FC<AISummarizerModalProps> = ({
  isOpen,
  onClose,
  document,
  approvalCard,
}) => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [animatedText, setAnimatedText] = useState('');
  const [fileContent, setFileContent] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [fileInfo, setFileInfo] = useState<string>('');
  const [summaryFailed, setSummaryFailed] = useState(false);

  // Track animation interval so we can clear it on unmount / re-generate
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAnimation = () => {
    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
  };

  // ---------------------------------------------------------------------------
  // Resolve the file from the approval card (storage_path OR base64 data)
  // Returns { blob, fileName, mimeType, extractedText }
  // ---------------------------------------------------------------------------
  const resolveApprovalFile = async (): Promise<{
    blob: Blob;
    fileName: string;
    mimeType: string;
    extractedText: string;
  } | null> => {
    const files = approvalCard?.files;
    if (!files || files.length === 0) return null;

    const fileEntry = files[0];
    const fileName = String(fileEntry.file_name || fileEntry.name || 'document');
    const mimeType = String(fileEntry.file_type || fileEntry.type || 'application/octet-stream');

    // ── Supabase Storage path ────────────────────────────────────────────────
    if (fileEntry.storage_path) {
      try {
        console.log('🌐 [AI Summarizer] Fetching from Supabase Storage:', fileName);
        const downloadedBlob = await supabaseStorageService.downloadFile(String(fileEntry.storage_path));
        const resolvedMime = downloadedBlob.type || mimeType;
        setFileInfo(`${fileName}`);

        // Client-side text extraction for text-extractable types
        let extractedText = '';
        const lowerMime = resolvedMime.toLowerCase();
        const lowerName = fileName.toLowerCase();

        if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
          const arrayBuffer = await downloadedBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          extractedText = await extractPDFContent(`data:application/pdf;base64,${base64}`);
        } else if (
          lowerMime.includes('word') || lowerMime.includes('officedocument.wordprocessingml') ||
          lowerName.endsWith('.docx') || lowerName.endsWith('.doc')
        ) {
          const arrayBuffer = await downloadedBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          extractedText = await extractWordContent(`data:${resolvedMime};base64,${base64}`);
        } else if (
          lowerMime.includes('sheet') || lowerMime.includes('excel') ||
          lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')
        ) {
          const arrayBuffer = await downloadedBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          extractedText = await extractExcelContent(`data:${resolvedMime};base64,${base64}`);
        }
        // For images: no client extraction — backend Groq vision handles it

        return { blob: downloadedBlob, fileName, mimeType: resolvedMime, extractedText };
      } catch (err) {
        console.warn('⚠️ [AI Summarizer] Supabase Storage fetch failed:', err);
        return null;
      }
    }

    // ── Legacy base64 data ───────────────────────────────────────────────────
    if (fileEntry.data) {
      try {
        const lowerMime = mimeType.toLowerCase();
        const lowerName = fileName.toLowerCase();
        let extractedText = '';

        if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
          extractedText = await extractPDFContent(String(fileEntry.data));
        } else if (
          lowerMime.includes('word') || lowerMime.includes('officedocument') ||
          lowerName.endsWith('.docx') || lowerName.endsWith('.doc')
        ) {
          extractedText = await extractWordContent(String(fileEntry.data));
        } else if (
          lowerMime.includes('sheet') || lowerMime.includes('excel') ||
          lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')
        ) {
          extractedText = await extractExcelContent(String(fileEntry.data));
        }

        const blob = base64ToBlob(String(fileEntry.data), mimeType);
        setFileInfo(`${fileName}`);
        return { blob, fileName, mimeType, extractedText };
      } catch (err) {
        console.warn('⚠️ [AI Summarizer] base64 decode failed:', err);
        return null;
      }
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Animate summary text word by word
  // ---------------------------------------------------------------------------
  const animateText = (text: string) => {
    stopAnimation();
    setAnimatedText('');
    const words = text.split(' ');
    let currentIndex = 0;

    animIntervalRef.current = setInterval(() => {
      if (currentIndex < words.length) {
        setAnimatedText(prev => prev + (currentIndex === 0 ? '' : ' ') + words[currentIndex]);
        currentIndex++;
      } else {
        stopAnimation();
      }
    }, 60);
  };

  // ---------------------------------------------------------------------------
  // Core summarization function
  // ---------------------------------------------------------------------------
  const generateSummary = async () => {
    setLoading(true);
    setSummary('');
    setAnimatedText('');
    setSummaryFailed(false);
    stopAnimation();

    try {
      const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001/api';
      
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const metadata = {
        title: document.title,
        type: document.type,
        submittedBy: document.submittedBy,
        date: document.date,
        description: document.description,
      };

      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));

      // ── Resolve file from approval card ────────────────────────────────────
      setExtracting(true);
      let resolvedFile: { blob: Blob; fileName: string; mimeType: string; extractedText: string } | null = null;

      try {
        resolvedFile = await resolveApprovalFile();
      } finally {
        setExtracting(false);
      }

      if (resolvedFile) {
        // Attach extracted text if available (helps Groq even for image uploads)
        if (resolvedFile.extractedText) {
          formData.append('extractedText', resolvedFile.extractedText);
          setFileContent(resolvedFile.extractedText);
        }
        // Attach the raw file so backend can run OCR / vision if needed
        formData.append('file', resolvedFile.blob, resolvedFile.fileName);
      } else {
        // No uploaded file — send a minimal title-only placeholder so multer is satisfied.
        // Per spec: do NOT include document.description in the payload when no real file exists.
        const placeholder = new Blob([document.title || 'Document'], { type: 'text/plain' });
        formData.append('file', placeholder, `${document.title || 'document'}.txt`);
      }

      console.log('🤖 [AI Summarizer] Sending request to /api/summarize...');

      const response = await fetch(`${apiUrl}/summarize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof errorData.error === 'string' ? errorData.error : `Server returned ${response.status}`);
      }

      const data = await response.json() as { success: boolean; summary?: string; processingMethod?: string };

      if (!data.success || !data.summary) {
        throw new Error('Backend returned no summary');
      }

      console.log(`✅ [AI Summarizer] Summary generated via ${data.processingMethod} (${data.summary.length} chars)`);

      setSummary(data.summary);
      animateText(data.summary);
    } catch (error) {
      console.error('❌ [AI Summarizer] Summary generation error:', error);
      // Per spec: DO NOT fall back to description or any document text.
      // Show a clean empty / failed state only.
      setSummaryFailed(true);
      setSummary('');
      setAnimatedText('');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Trigger on open
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setFileContent('');
      setFileInfo('');
      setSummaryFailed(false);
      generateSummary();
    }

    return () => {
      stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document.id]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-2xl border-0 p-0 overflow-hidden [&>button]:hidden">
        <div className="relative flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-8 pb-4 sm:pb-6 bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                AI Document Summarizer
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-full hover:bg-white/50"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <DialogDescription className="sr-only">
              AI-powered document analysis and summarization tool
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
            {/* File extraction status */}
            {extracting && (
              <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm text-blue-700">Extracting file content…</span>
              </div>
            )}

            {/* File info (once resolved) */}
            {fileInfo && !extracting && (
              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-sm text-green-700">
                  ✅ Analysing file: <strong>{fileInfo}</strong>
                  {fileContent && ` (${fileContent.length.toLocaleString()} characters extracted)`}
                </p>
              </div>
            )}

            {/* Summary panel */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 min-h-[200px] max-h-[500px] overflow-y-auto">
              <h3 className="font-semibold text-lg text-gray-800 mb-4 flex items-center gap-2 sticky top-0 bg-gradient-to-br from-blue-50 to-purple-50 pb-2 z-10">
                <Sparkles className="w-5 h-5 text-blue-500" />
                AI-Generated Summary
              </h3>

              {/* Loading state */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">Generating summary…</span>
                </div>
              )}

              {/* Empty / failed state — per spec: no fallback content shown */}
              {!loading && summaryFailed && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div className="p-3 bg-gray-100 rounded-full">
                    <FileX className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Summary unavailable for this document.
                  </p>
                </div>
              )}

              {/* Generated summary */}
              {!loading && !summaryFailed && animatedText && (
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {animatedText}
                  </p>
                </div>
              )}
            </div>

            {/* Regenerate button */}
            <div className="flex justify-end sticky bottom-0 bg-white pt-4">
              <Button
                onClick={generateSummary}
                disabled={loading}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate Summary
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};