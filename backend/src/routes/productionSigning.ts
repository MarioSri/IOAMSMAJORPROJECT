import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../types';
import {
  completeSigning,
  createSignedArtifactUrl,
  createSigningIntent,
  markSigningAuthentication,
} from '../services/productionSigningService';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 25 * 1024 * 1024,
    fieldSize: 3 * 1024 * 1024,
  },
});

function userFromRequest(req: AuthRequest) {
  if (!req.user) throw Object.assign(new Error('Authentication required'), { status: 401 });
  return req.user;
}

function handleError(err: unknown, res: Response): void {
  const error = err as { status?: number; message?: string };
  const status = Number.isInteger(error.status) ? Number(error.status) : 500;
  res.status(status).json({ success: false, error: status >= 500 ? 'Signing service unavailable' : error.message ?? 'Signing request failed' });
}

router.post('/intents', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = userFromRequest(req);
    const documentId = typeof req.body.documentId === 'string' ? req.body.documentId : '';
    if (!documentId) throw Object.assign(new Error('documentId is required'), { status: 400 });
    res.status(201).json({ success: true, data: await createSigningIntent(documentId, user) });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/auth-proof', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = userFromRequest(req);
    const { transactionId, documentId, requestId, authMethod } = req.body as {
      transactionId?: string;
      documentId?: string;
      requestId?: string;
      authMethod?: 'passkey' | 'backup_code';
    };
    if (!transactionId || !documentId || !requestId || !authMethod) {
      throw Object.assign(new Error('transactionId, documentId, requestId, and authMethod are required'), { status: 400 });
    }
    await markSigningAuthentication(transactionId, documentId, user.id, requestId, authMethod);
    res.json({ success: true, verified: true });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/complete', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  upload.array('signedFiles', 10)(req, res, (uploadError: unknown) => {
    if (uploadError) {
      handleError(Object.assign(new Error('Invalid signed artifact upload'), { status: 400 }), res);
      return;
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  try {
    const user = userFromRequest(req);
    const documentId = typeof req.body.documentId === 'string' ? req.body.documentId : '';
    const transactionId = typeof req.body.transactionId === 'string' ? req.body.transactionId : '';
    const requestId = typeof req.body.requestId === 'string' ? req.body.requestId : '';
    const signatures = typeof req.body.signatures === 'string' ? JSON.parse(req.body.signatures) : req.body.signatures;
    const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    if (!documentId || !transactionId || !requestId) {
      throw Object.assign(new Error('documentId, transactionId, and requestId are required'), { status: 400 });
    }
    const result = await completeSigning(
      documentId,
      transactionId,
      requestId,
      user,
      signatures,
      files,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res);
  }
});

router.get('/files/:documentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = userFromRequest(req);
    const storagePath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!storagePath) throw Object.assign(new Error('Storage path is required'), { status: 400 });
    const signedUrl = await createSignedArtifactUrl(req.params.documentId, storagePath, user);
    res.redirect(307, signedUrl);
  } catch (err) {
    handleError(err, res);
  }
});

export default router;
