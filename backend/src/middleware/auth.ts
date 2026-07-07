import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthRequest extends Request {
  user?: User;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  // ---- Strategy 1: Verify with Supabase Admin API (most reliable) ----------
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        req.user = {
          id: data.user.id,
          email: data.user.email || '',
          role: data.user.role || data.user.app_metadata?.role || 'authenticated',
        } as User;
        return next();
      }
    } catch {
      // Supabase verification failed — fall through to JWT_SECRET strategy
    }
  }

  // ---- Strategy 2: Verify with local JWT_SECRET (custom-issued tokens) -----
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded) {
      req.user = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
        role: decoded.role || decoded.user_role || decoded.app_metadata?.role,
      } as User;
      return next();
    }
  } catch {
    // JWT verification also failed
  }

  return res.status(403).json({ success: false, error: 'Invalid token' });
}