import { Router } from 'express';
import multer from 'multer';
import { uploadFiles } from '../controllers/fileController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload file to Google Drive
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 */
router.post('/upload', authenticateToken, upload.single('file'), uploadFiles);

export default router;