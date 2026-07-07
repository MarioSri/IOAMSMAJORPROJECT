import { Router } from 'express';
import multer from 'multer';
import { summarizeDocument } from '../controllers/summarizeController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeMB * 1024 * 1024 },
});

/**
 * @swagger
 * /api/summarize:
 *   post:
 *     summary: Summarize a document using AI (NanoNets → Vision → Gemini fallback chain)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to summarize (PDF, DOCX, XLSX, images, etc.)
 *               extractedText:
 *                 type: string
 *                 description: Optional pre-extracted text from the client (e.g. via pdfjs/mammoth/xlsx)
 *               metadata:
 *                 type: string
 *                 description: Optional JSON string with document metadata {title, type, submittedBy, date, description}
 *     responses:
 *       200:
 *         description: Summary generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 summary:
 *                   type: string
 *                 processingMethod:
 *                   type: string
 *                   enum: [nanonets, vision+gemini, gemini-direct]
 *                 extractedTextLength:
 *                   type: number
 *       400:
 *         description: No file provided
 *       500:
 *         description: Summarization failed
 */
router.post('/', authenticateToken, upload.single('file'), summarizeDocument);

export default router;
