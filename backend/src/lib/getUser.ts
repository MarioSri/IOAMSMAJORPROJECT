// backend/src/lib/getUser.ts
// Extract verified user from JWT — NEVER from request body.
import { supabaseAdmin } from '../config/supabase';
import type { Request } from 'express';

export async function getUser(req: Request) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw Object.assign(new Error('Missing Authorization header'), { status: 401 });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw Object.assign(
      new Error('Invalid or expired token'),
      { status: 401 }
    );
  }

  return user;
}
