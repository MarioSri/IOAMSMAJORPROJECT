import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { getSupabaseAuthClient, isSupabasePublicConfigured } from '../config/supabase';

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function invalidConfiguration(res: Response): void {
  res.status(503).json({
    success: false,
    error: 'Authentication service unavailable',
  } satisfies ApiResponse);
}

export async function signUp(req: Request, res: Response): Promise<void> {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({
      success: false,
      error: 'A valid email and password of at least 8 characters are required',
    } satisfies ApiResponse);
    return;
  }

  if (!isSupabasePublicConfigured()) {
    invalidConfiguration(res);
    return;
  }

  try {
    const { data, error } = await getSupabaseAuthClient().auth.signUp({ email, password });
    if (error) {
      res.status(400).json({ success: false, error: error.message } satisfies ApiResponse);
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
      },
      message: data.session ? 'User created successfully' : 'User created; email confirmation may be required',
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Auth] Sign-up failed:', error);
    res.status(503).json({ success: false, error: 'Authentication service unavailable' } satisfies ApiResponse);
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
    res.status(401).json({ success: false, error: 'Invalid credentials' } satisfies ApiResponse);
    return;
  }

  if (!isSupabasePublicConfigured()) {
    invalidConfiguration(res);
    return;
  }

  try {
    const { data, error } = await getSupabaseAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      res.status(401).json({ success: false, error: 'Invalid credentials' } satisfies ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Auth] Sign-in failed:', error);
    res.status(503).json({ success: false, error: 'Authentication service unavailable' } satisfies ApiResponse);
  }
}
