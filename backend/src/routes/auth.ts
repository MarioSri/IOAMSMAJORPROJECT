import { Router, Request, Response } from 'express';
import { signUp, signIn } from '../controllers/authController';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post('/signup', signUp);

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User signed in successfully
 */
router.post('/signin', signIn);

interface AuthRequest extends Request {
  user?: { id: string; email: string; role?: string };
}

// Verify a 6-digit approval PIN against the bcrypt hash stored in role_recipients
router.post('/verify-pin', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const email = req.user!.email;
    const { pin } = req.body;

    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ valid: false, error: 'PIN must be exactly 6 digits' });
    }

    const { data: recipient } = await supabaseAdmin
      .from('role_recipients')
      .select('pin_hash')
      .eq('email', email)
      .single();

    if (!recipient || !recipient.pin_hash) {
      return res.status(404).json({ valid: false, error: 'PIN not set for this user' });
    }

    const valid = await bcrypt.compare(pin, recipient.pin_hash);
    return res.json({ valid });
  } catch (error: any) {
    console.error('[Auth] verify-pin error:', error);
    return res.status(500).json({ valid: false, error: error.message });
  }
});

export default router;