import { Router } from 'express';
import { createDocument, getDocuments } from '../controllers/documentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create a new document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document created successfully
 */
router.post('/', authenticateToken, createDocument);

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get all documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 */
router.get('/', authenticateToken, getDocuments);

export default router;