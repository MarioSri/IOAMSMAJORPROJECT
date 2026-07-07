import { Response } from 'express';
import { AuthRequest } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessingMethod =
  | 'groq-text'
  | 'groq-vision'
  | 'nanonets+groq'
  | 'vision+groq'
  | 'nanonets+gemini'
  | 'vision+gemini'
  | 'gemini-direct';

interface SummarizeResponse {
  success: boolean;
  summary?: string;
  processingMethod?: ProcessingMethod;
  extractedTextLength?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ── Primary — Groq ──────────────────────────────────────────────────────────
const GROQ_API_KEY_TEXT   = process.env.GROQ_API_KEY_TEXT || '';
const GROQ_API_KEY_VISION = process.env.GROQ_API_KEY_VISION || '';
const GROQ_TEXT_MODEL     = 'llama-3.3-70b-versatile'; // Reliable, fast model
const GROQ_TEXT_MODEL_FALLBACK = 'llama-3.1-8b-instant'; // Fast fallback
const GROQ_FALLBACK_API_KEY = process.env.GROQ_FALLBACK_API_KEY || '';
const GROQ_VISION_MODEL   = 'llama-3.2-11b-vision-preview';
const GROQ_BASE_URL       = 'https://api.groq.com/openai/v1/chat/completions';

// ── Fallback — NanoNets OCR ─────────────────────────────────────────────────
const NANONETS_API_KEY = process.env.NANONETS_API_KEY || '';

// ── Fallback — Google Cloud Vision ─────────────────────────────────────────
const VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY || '';

// ── Last resort — Gemini ────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/bmp', 'image/tiff', 'image/webp',
]);

const CHUNK_SIZE = 15_000; // Conservative limit for token safety across all models
const BATCH_SIZE = 5; // Process chunks in batches to avoid rate limits
const MAX_RETRIES = 2; // Retry failed requests

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Retry wrapper for API calls (production-grade error handling)
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) {
      console.error('[Summarizer] All retries exhausted:', (err as Error).message);
      throw err;
    }
    console.warn(`[Summarizer] Retry attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} after error:`, (err as Error).message);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

// ---------------------------------------------------------------------------
// Process large documents via parallel chunking (ensures complete coverage)
// ---------------------------------------------------------------------------
async function summarizeLargeText(
  text: string,
  metadata: Record<string, string>
): Promise<string> {
  if (text.length <= CHUNK_SIZE) {
    // Small document - process directly
    const prompt = buildSummaryPrompt(text, metadata);
    return summarizeWithGroq(prompt);
  }

  console.log(`[Summarizer] Large document detected (${text.length} chars) - using parallel chunking strategy`);

  // Split into chunks
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  console.log(`[Summarizer] Processing ${chunks.length} chunks in batches of ${BATCH_SIZE}...`);

  // ✅ OPTIMIZATION: Batched parallel processing with rate limit protection
  const chunkSummaries: string[] = [];
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
    
    console.log(`[Summarizer] Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);
    
    // Process batch in parallel with retry logic
    const batchResults = await Promise.all(
      batch.map((chunk, idx) =>
        withRetry(() =>
          summarizeWithGroq(buildChunkPrompt(chunk, metadata, i + idx + 1, chunks.length))
        )
      )
    );
    
    chunkSummaries.push(...batchResults);
    console.log(`[Summarizer] ✅ Batch ${batchNum}/${totalBatches} completed`);
  }

  // ✅ VALIDATION: Ensure all chunks were processed
  if (chunkSummaries.length !== chunks.length) {
    throw new Error(`Chunk processing incomplete: expected ${chunks.length}, got ${chunkSummaries.length}`);
  }

  // Verify no empty summaries
  const emptySummaries = chunkSummaries.filter(s => !s || s.trim().length === 0);
  if (emptySummaries.length > 0) {
    throw new Error(`${emptySummaries.length} chunks returned empty summaries`);
  }

  console.log(`[Summarizer] ✅ All ${chunks.length} chunks summarized successfully`);

  // Combine chunk summaries into final summary (with retry)
  const finalPrompt = buildMergePrompt(chunkSummaries, metadata);
  const finalSummary = await withRetry(() => summarizeWithGroq(finalPrompt));

  console.log(`[Summarizer] ✅ Final summary generated from ${chunks.length} chunks`);
  return finalSummary;
}

// ---------------------------------------------------------------------------
// Build prompt for individual chunk
// ---------------------------------------------------------------------------
function buildChunkPrompt(
  chunkText: string,
  metadata: Record<string, string>,
  chunkNum: number,
  totalChunks: number
): string {
  const { title = '', type = '' } = metadata;
  return `You are analyzing part ${chunkNum} of ${totalChunks} from document "${title}" (${type}).

CONTENT SECTION ${chunkNum}:
${chunkText}

Provide a brief summary (50-100 words) of this section's key points, data, and conclusions.
Focus on factual content - no metadata repetition.`;
}

// ---------------------------------------------------------------------------
// Build prompt for merging chunk summaries
// ✅ OPTIMIZATION: Anti-repetition instructions
// ---------------------------------------------------------------------------
function buildMergePrompt(
  chunkSummaries: string[],
  metadata: Record<string, string>
): string {
  const { title = '', type = '', submittedBy = '', date = '', description = '' } = metadata;
  return `You are a professional document analyst. Combine the following section summaries into ONE cohesive, complete summary.

Document Metadata:
- Title: ${title}
- Type: ${type}
- Submitted by: ${submittedBy}
- Date: ${date}
- Description: ${description}

SECTION SUMMARIES:
${chunkSummaries.map((s, i) => `\nSection ${i + 1}:\n${s}`).join('\n')}

Instructions:
- Write a single cohesive summary of 150–250 words covering the ENTIRE document
- Include: main purpose, key points from ALL sections, important data/numbers, action items, and conclusions
- Remove redundancy and merge overlapping information from different sections
- Synthesize related concepts that appear across multiple sections
- Be concise, professional, and context-aware
- Do NOT repeat the document metadata verbatim
- Do NOT split your response into sections or bullet points — write flowing prose
- Ensure NO content from any section is omitted`;
}

// ---------------------------------------------------------------------------
// Build prompt for small documents (no chunking needed)
// ---------------------------------------------------------------------------
function buildSummaryPrompt(extractedText: string, metadata: Record<string, string>): string {
  const { title = '', type = '', submittedBy = '', date = '', description = '' } = metadata;
  return `You are a professional document analyst. Provide a concise, accurate, context-aware summary of the following document content.

Document Metadata:
- Title: ${title}
- Type: ${type}
- Submitted by: ${submittedBy}
- Date: ${date}
- Description: ${description}

FULL DOCUMENT CONTENT:
${extractedText}

Instructions:
- Analyze ALL content thoroughly
- Write a single cohesive summary of 150–250 words
- Include: main purpose, key points, important data/numbers, action items, and conclusions
- Be concise, professional, and context-aware
- Do NOT repeat the document metadata verbatim
- Do NOT split your response into sections or bullet points — write flowing prose`;
}

function buildVisionPrompt(metadata: Record<string, string>): string {
  const { title = '', type = '', submittedBy = '', date = '', description = '' } = metadata;
  return `You are a professional document analyst reviewing an image document.

Document Metadata:
- Title: ${title}
- Type: ${type}
- Submitted by: ${submittedBy}
- Date: ${date}
- Description: ${description}

Analyze the image document carefully and provide a concise professional summary of 150–250 words.
Include: main purpose, key points, visible text/data, action items, and conclusions.
Write flowing prose — no bullet points or section headers.`;
}

// ---------------------------------------------------------------------------
// Groq text summarizer — PRIMARY for text content
// Uses GPT OSS 120B (primary) with Qwen 3 32B fallback
// ---------------------------------------------------------------------------

async function summarizeWithGroq(prompt: string): Promise<string> {
  if (!GROQ_API_KEY_TEXT) throw new Error('GROQ_API_KEY_TEXT not configured');

  // Try primary model (GPT OSS 120B)
  try {
    const response = await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY_TEXT}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const text: string = data?.choices?.[0]?.message?.content ?? '';
      if (text) return text;
    }

    console.warn(`[Summarizer] Primary model (${GROQ_TEXT_MODEL}) failed with ${response.status}, trying fallback...`);
  } catch (err) {
    console.warn(`[Summarizer] Primary model error:`, (err as Error).message);
  }

  // Fallback to Qwen 3 32B
  if (!GROQ_FALLBACK_API_KEY) throw new Error('No fallback API key configured');

  const fallbackResponse = await fetch(GROQ_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_FALLBACK_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL_FALLBACK,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!fallbackResponse.ok) {
    const body = await fallbackResponse.text();
    throw new Error(`Fallback model returned ${fallbackResponse.status}: ${body}`);
  }

  const data = await fallbackResponse.json() as any;
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Fallback model returned empty response');
  
  console.log(`[Summarizer] ✅ Fallback model (${GROQ_TEXT_MODEL_FALLBACK}) succeeded`);
  return text;
}

// ---------------------------------------------------------------------------
// Groq vision summarizer — PRIMARY for image content
// ---------------------------------------------------------------------------

async function summarizeImageWithGroq(
  fileBuffer: Buffer,
  mimetype: string,
  metadata: Record<string, string>,
): Promise<string> {
  if (!GROQ_API_KEY_VISION) throw new Error('GROQ_API_KEY_VISION not configured');

  const base64Data = fileBuffer.toString('base64');
  const textPrompt = buildVisionPrompt(metadata);

  const response = await fetch(GROQ_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY_VISION}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimetype};base64,${base64Data}`,
              },
            },
            {
              type: 'text',
              text: textPrompt,
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq vision returned ${response.status}: ${body}`);
  }

  const data = await response.json() as any;
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq vision returned empty response');
  return text;
}

// ---------------------------------------------------------------------------
// NanoNets OCR — fallback text extractor
// ---------------------------------------------------------------------------

async function extractWithNanoNets(
  fileBuffer: Buffer,
  originalname: string,
  mimetype: string,
): Promise<string> {
  if (!NANONETS_API_KEY) throw new Error('NANONETS_API_KEY not configured');

  const form = new FormData();
  form.set('file', new Blob([fileBuffer], { type: mimetype }), originalname);

  const credentials = Buffer.from(`${NANONETS_API_KEY}:`).toString('base64');
  const response = await fetch('https://app.nanonets.com/api/v2/OCR/FullText/', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NanoNets returned ${response.status}: ${body}`);
  }

  const data = await response.json() as any;
  const pages: any[] = data?.result ?? [];
  if (!pages.length) throw new Error('NanoNets returned empty result');

  const text = pages.map((p: any) => p?.raw_text ?? '').join('\n\n').trim();
  if (!text) throw new Error('NanoNets returned empty text');
  return text;
}

// ---------------------------------------------------------------------------
// Google Cloud Vision — fallback for images when Groq vision fails
// ---------------------------------------------------------------------------

async function extractWithVision(fileBuffer: Buffer, mimetype: string): Promise<string> {
  if (!VISION_API_KEY) throw new Error('GOOGLE_CLOUD_VISION_API_KEY not configured');

  const base64Image = fileBuffer.toString('base64');
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        }],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloud Vision returned ${response.status}: ${body}`);
  }

  const data = await response.json() as any;
  const text: string = data?.responses?.[0]?.fullTextAnnotation?.text ?? '';
  return text;
}

// ---------------------------------------------------------------------------
// Gemini multimodal — absolute last resort
// ---------------------------------------------------------------------------

async function summarizeFileDirectlyWithGemini(
  fileBuffer: Buffer,
  mimetype: string,
  metadata: Record<string, string>,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const { title = '', type = '', submittedBy = '', date = '', description = '' } = metadata;
  const base64Data = fileBuffer.toString('base64');

  const textPrompt =
    `Analyze this document and provide a concise professional summary (150–250 words).
Title: ${title}
Type: ${type}
Submitted by: ${submittedBy}
Date: ${date}
Description: ${description}

Include: main topics, key points, important data/numbers, action items, and conclusions.
Write flowing prose — no bullet points or section headers.`;

  const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: textPrompt },
          { inline_data: { mime_type: mimetype, data: base64Data } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini multimodal returned ${response.status}: ${body}`);
  }

  const data = await response.json() as any;
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini multimodal returned empty response');
  return text;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function summarizeDocument(req: AuthRequest, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No file provided' } as SummarizeResponse);
      return;
    }

    // Optional fields from FormData
    const extractedText: string = (req.body.extractedText as string | undefined) ?? '';
    let metadata: Record<string, string> = {};
    try {
      metadata = req.body.metadata ? JSON.parse(req.body.metadata as string) : {};
    } catch { /* ignore malformed metadata */ }

    const mimetype = file.mimetype.toLowerCase();
    const isImage = IMAGE_MIME_TYPES.has(mimetype);

    console.log(`[Summarizer] Processing "${file.originalname}" (${mimetype}) — isImage=${isImage}`);

    // ── PATH 1: Groq text — PRIMARY for non-image files ────────────────────
    // Works when client has already extracted text, or for any text-based file.
    if (!isImage && GROQ_API_KEY_TEXT) {
      const textForPrompt = extractedText.trim() || `File: ${file.originalname}\n${metadata.description ?? ''}`;
      if (textForPrompt.trim()) {
        try {
          console.log(`[Summarizer] Trying Groq text with ${textForPrompt.length} chars...`);
          const summary = await summarizeLargeText(textForPrompt, metadata);

          console.log(`[Summarizer] ✅ Groq text success — ${summary.length} chars`);
          res.json({
            success: true,
            summary,
            processingMethod: 'groq-text',
            extractedTextLength: textForPrompt.length,
          } as SummarizeResponse);
          return;
        } catch (err) {
          console.warn('[Summarizer] Groq text failed, trying fallbacks:', (err as Error).message);
        }
      }
    }

    // ── PATH 2: Groq vision — PRIMARY for image files ─────────────────────
    if (isImage && GROQ_API_KEY_VISION) {
      try {
        console.log(`[Summarizer] Trying Groq vision (${GROQ_VISION_MODEL}) for "${file.originalname}"...`);
        const summary = await summarizeImageWithGroq(file.buffer, file.mimetype, metadata);

        console.log(`[Summarizer] ✅ Groq vision success — ${summary.length} chars`);
        res.json({
          success: true,
          summary,
          processingMethod: 'groq-vision',
          extractedTextLength: 0,
        } as SummarizeResponse);
        return;
      } catch (err) {
        console.warn('[Summarizer] Groq vision failed, trying fallbacks:', (err as Error).message);
      }
    }

    // ── PATH 3: NanoNets OCR → Groq text — FALLBACK ────────────────────────
    if (NANONETS_API_KEY) {
      try {
        console.log(`[Summarizer] Trying NanoNets OCR for "${file.originalname}"...`);
        const ocrText = await extractWithNanoNets(file.buffer, file.originalname, file.mimetype);

        // Prefer Groq for summarising the OCR result; fall back to Gemini if needed
        let summary: string;
        let method: ProcessingMethod;

        if (GROQ_API_KEY_TEXT) {
          summary = await summarizeLargeText(ocrText, metadata);
          method = 'nanonets+groq';
        } else {
          // Inline Gemini fallback for summarising OCR output
          if (!GEMINI_API_KEY) throw new Error('No summarizer available for NanoNets output');
          const ocrPrompt = buildSummaryPrompt(ocrText, metadata);
          const geminiResp = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: ocrPrompt }] }] }),
          });
          if (!geminiResp.ok) throw new Error(`Gemini returned ${geminiResp.status}`);
          const gData = await geminiResp.json() as any;
          summary = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (!summary) throw new Error('Gemini returned empty response');
          method = 'nanonets+gemini';
        }

        console.log(`[Summarizer] ✅ NanoNets+${method.split('+')[1]} success — ${ocrText.length} chars extracted`);
        res.json({
          success: true,
          summary,
          processingMethod: method,
          extractedTextLength: ocrText.length,
        } as SummarizeResponse);
        return;
      } catch (err) {
        console.warn('[Summarizer] NanoNets fallback failed:', (err as Error).message);
      }
    }

    // ── PATH 4: Cloud Vision → Groq text — FALLBACK for images ────────────
    if (isImage && VISION_API_KEY) {
      try {
        console.log(`[Summarizer] Trying Cloud Vision for image "${file.originalname}"...`);
        const visionText = await extractWithVision(file.buffer, file.mimetype);
        const textToSummarize = visionText || `(Image file — no readable text detected) ${metadata.description ?? ''}`;

        let summary: string;
        let method: ProcessingMethod;

        if (GROQ_API_KEY_TEXT) {
          summary = await summarizeLargeText(textToSummarize, metadata);
          method = 'vision+groq';
        } else {
          const prompt = buildSummaryPrompt(textToSummarize, metadata);
          const geminiResp = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          });
          if (!geminiResp.ok) throw new Error(`Gemini returned ${geminiResp.status}`);
          const gData = await geminiResp.json() as any;
          summary = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (!summary) throw new Error('Gemini returned empty response');
          method = 'vision+gemini';
        }

        console.log(`[Summarizer] ✅ Vision+${method.split('+')[1]} success — ${visionText.length} chars extracted`);
        res.json({
          success: true,
          summary,
          processingMethod: method,
          extractedTextLength: visionText.length,
        } as SummarizeResponse);
        return;
      } catch (err) {
        console.warn('[Summarizer] Cloud Vision fallback failed:', (err as Error).message);
      }
    }

    // ── PATH 5: Gemini multimodal direct — ABSOLUTE LAST RESORT ───────────
    console.log(`[Summarizer] All primary paths failed — trying Gemini multimodal for "${file.originalname}"...`);
    const summary = await summarizeFileDirectlyWithGemini(file.buffer, file.mimetype, metadata);

    console.log(`[Summarizer] ✅ Gemini multimodal success — ${summary.length} chars`);
    res.json({
      success: true,
      summary,
      processingMethod: 'gemini-direct',
      extractedTextLength: 0,
    } as SummarizeResponse);

  } catch (err) {
    console.error('[Summarizer] All processing paths failed:', err);
    res.status(500).json({
      success: false,
      error: `Summarization failed: ${(err as Error).message}`,
    } as SummarizeResponse);
  }
}
