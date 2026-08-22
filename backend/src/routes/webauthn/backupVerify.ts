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
    const { code, purpose = 'authentication', documentId, signingTransactionId } = req.body as {
      code: string;
      purpose?: 'authentication' | 'approval' | 'document_signing';
      documentId?: string;
      signingTransactionId?: string;
    };

    if (purpose === 'document_signing') {
      if (!documentId || !signingTransactionId) {
        throw Object.assign(new Error('Document and signing transaction are required'), { status: 400 });
      }
      const { data: signingTransaction } = await supabaseAdmin
        .from('signing_transactions')
        .select('id, status, expires_at')
        .eq('id', signingTransactionId)
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .single();
      if (!signingTransaction || signingTransaction.status !== 'pending' || new Date(signingTransaction.expires_at) <= new Date()) {
        throw Object.assign(new Error('Signing transaction is no longer valid'), { status: 409 });
      }
    }

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
          document_id: documentId ?? null,
          signing_transaction_id: signingTransactionId ?? null,
          metadata:   { reason: 'invalid_or_used_code', purpose },
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
        event_type: purpose === 'document_signing' ? 'document_signing' : 'recovery_used',
        document_id: documentId ?? null,
        signing_transaction_id: signingTransactionId ?? null,
        auth_method: purpose === 'document_signing' ? 'backup_code' : null,
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

    res.json({ verified: true, codesRemaining: remaining ?? 0, requestId });
  } catch (err: any) {
    console.error('[WebAuthn] backup/verify error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
