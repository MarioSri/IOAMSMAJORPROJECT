import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin as supabase } from '../config/supabase';
import { AuthRequest, User } from '../types';

/**
 * Middleware to verify Supabase JWT tokens and attach user to request.
 *
 * Verifies the JWT token from Authorization header, validates against Supabase,
 * and attaches decoded user data to req.user.
 *
 * Usage:
 *   router.post('/protected-route', supabaseAuth, (req, res) => {
 *     console.log('User:', req.user);
 *   });
 */
export async function supabaseAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get JWT secret from environment
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('SUPABASE_JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Extract user info from decoded token
    const userId = decoded.sub;
    const email = decoded.email;
    const role = decoded.user_metadata?.role || 'user';

    // Optional: Verify user exists in database
    const { data: user, error } = await supabase
      .from('role_recipients')
      .select('id, name, email, role, department')
      .eq('supabase_uid', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Ignore not found error
      console.warn('Failed to fetch user from database:', error);
    }

    // Attach user to request
    req.user = {
      id: user?.id || userId,
      email: email,
      role: user?.role || role,
      created_at: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as User;

    next();
  } catch (err) {
    console.error('Error in supabaseAuth middleware:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

/**
 * Middleware to verify Supabase JWT token (lightweight version).
 * Only verifies token validity without database lookup.
 *
 * Usage:
 *   router.post('/lightweight-route', verifySupabaseToken, (req, res) => {
 *     console.log('User ID:', req.user.id);
 *   });
 */
export function verifySupabaseToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): any {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7);

    // Get JWT secret from environment
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('SUPABASE_JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Attach minimal user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.user_metadata?.role || 'user',
      created_at: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as User;

    next();
  } catch (err) {
    console.error('Error in verifySupabaseToken middleware:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

/**
 * Middleware to check if user has specific role(s).
 * Must be used after supabaseAuth middleware.
 *
 * Usage:
 *   router.post('/admin-only', supabaseAuth, requireRole('admin'), handler);
 *   router.post('/staff-only', supabaseAuth, requireRole(['admin', 'manager']), handler);
 */
export function requireRole(allowedRoles: string | string[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: AuthRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}
