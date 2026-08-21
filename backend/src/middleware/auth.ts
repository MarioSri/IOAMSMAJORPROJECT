import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { AuthRequest, User } from '../types';

const SUPPORTED_ROLES = new Set<User['role']>(['admin', 'manager', 'user']);

function normalizeRole(value: unknown): User['role'] {
  return typeof value === 'string' && SUPPORTED_ROLES.has(value as User['role'])
    ? (value as User['role'])
    : 'user';
}

/**
 * Authenticate a request using Supabase's server-side token validation.
 * This middleware intentionally has no local-secret fallback: a missing or
 * invalid Supabase configuration must fail closed rather than accept a token
 * signed with a development default.
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Access token required' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ success: false, error: 'Access token required' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ success: false, error: 'Authentication service unavailable' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    const metadata = data.user.app_metadata ?? {};
    const userMetadata = data.user.user_metadata ?? {};
    const now = new Date().toISOString();

    req.user = {
      id: data.user.id,
      email: data.user.email ?? '',
      role: normalizeRole(metadata.role ?? userMetadata.role ?? data.user.role),
      created_at: data.user.created_at ?? now,
      updated_at: data.user.updated_at ?? now,
    };

    next();
  } catch (error) {
    console.error('[Auth] Supabase token validation failed:', error);
    res.status(503).json({ success: false, error: 'Authentication service unavailable' });
  }
}

export type AuthenticatedRequest = Request & { user: User };

export function requireRole(allowedRoles: User['role'] | User['role'][]) {
  const roles = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.has(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
