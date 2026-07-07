// backend/src/routes/webauthn/backupVerify.ts
// Backup code fallback — sha-256 compare, one-time use, rate-limited.
import { Router } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { getUser } from '../../lib/getUser';
import { checkRateLimit } from '../../lib/rateLimit';
import { randomUUID, createHash } from 'crypto';

export const backupVerifyRouter = Router();

backupVerifyRouter.post('/backup/verify', async (req, res) => {
  const requestId = randomUUID();
  try {
    const user = await getUser(req);
    const { code } = req.body as { code: string };

    if (!code || typeof code !== 'string') {
      throw Object.assign(new Error('Backup code is required'), { status: 400 });
    }

    // Rate limit: 3 attempts per 15 minutes — prevent brute force
    await checkRateLimit(`backup:${user.id}`, 3, 15 * 60 * 1000);

    // Hash the submitted code for comparison
    const submittedHash = createHash('sha256')
      .update(code.trim().toUpperCase())
      .digest('hex');

    // Find a matching, unused code for this user
    const { data: matchingCode } = await supabaseAdmin
      .from('recovery_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', submittedHash)
      .eq('is_used', false)
      .limit(1)
      .single();

    if (!matchingCode) {
      // Audit failed attempt but don't reveal why it failed
      try {
        await supabaseAdmin.from('webauthn_audit_log').insert({
          user_id:    user.id,
          request_id: requestId,
          event_type: 'recovery_fail',
          metadata:   { reason: 'invalid_or_used_code' },
        });
      } catch {
        // non-fatal
      }
      throw Object.assign(new Error('Invalid or already-used backup code'), { status: 401 });
    }

    // Mark code as used atomically
    const { error: updateErr } = await supabaseAdmin
      .from('recovery_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', matchingCode.id);

    if (updateErr) throw updateErr;

    // Audit success
    try {
      await supabaseAdmin.from('webauthn_audit_log').insert({
        user_id:    user.id,
        request_id: requestId,
        event_type: 'recovery_used',
      });
    } catch {
      // non-fatal
    }

    // Count remaining codes so client can warn user
    const { count: remaining } = await supabaseAdmin
      .from('recovery_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_used', false);

    res.json({ verified: true, codesRemaining: remaining ?? 0 });
  } catch (err: any) {
    console.error('[WebAuthn] backup/verify error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
