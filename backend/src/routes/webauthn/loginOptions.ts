// backend/src/routes/webauthn/loginOptions.ts
import { Router } from 'express';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { supabaseAdmin } from '../../config/supabase';
import { webauthnConfig } from '../../lib/webauthnConfig';
import { getUser } from '../../lib/getUser';
import { checkRateLimit } from '../../lib/rateLimit';

export const loginOptionsRouter = Router();

type Purpose = 'authentication' | 'approval' | 'document_signing';

loginOptionsRouter.post('/login/options', async (req, res) => {
  try {
    const user = await getUser(req);
    const purpose: Purpose = req.body.purpose ?? 'authentication';
    const documentId = typeof req.body.documentId === 'string' ? req.body.documentId : undefined;
    const signingTransactionId = typeof req.body.signingTransactionId === 'string'
      ? req.body.signingTransactionId
      : undefined;

    if (purpose === 'document_signing') {
      if (!documentId || !signingTransactionId) {
        throw Object.assign(new Error('Document and signing transaction are required'), { status: 400 });
      }
      const { data: signingTransaction } = await supabaseAdmin
        .from('signing_transactions')
        .select('id, document_id, status, expires_at')
        .eq('id', signingTransactionId)
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .single();
      if (!signingTransaction || signingTransaction.status !== 'pending' || new Date(signingTransaction.expires_at) <= new Date()) {
        throw Object.assign(new Error('Signing transaction is no longer valid'), { status: 409 });
      }
    }

    await checkRateLimit(`login:${user.id}`, 10, 15 * 60 * 1000);

    // Fetch active credentials for this user
    const { data: credentials } = await supabaseAdmin
      .from('user_credentials')
      .select('credential_id, transports')
      .eq('user_id', user.id)
      .eq('is_revoked', false);

    if (!credentials?.length) {
      throw Object.assign(new Error('No passkeys registered for this account'), { status: 404 });
    }

    const allowCredentials = credentials.map(c => ({
      id: c.credential_id,
      type: 'public-key' as const,
      transports: c.transports,
    }));

    const options = await generateAuthenticationOptions({
      rpID: webauthnConfig.rpID,
      userVerification: 'required',
      allowCredentials,
    });

    // Delete any stale pending challenge for this user+purpose, then insert fresh one
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('auth_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .eq('status', 'pending');

    const { error: upsertErr } = await supabaseAdmin
      .from('auth_challenges')
      .insert({
        user_id:    user.id,
        challenge:  options.challenge,
        purpose,
        status:     'pending',
        expires_at: expiresAt,
        document_id: documentId ?? null,
        signing_transaction_id: signingTransactionId ?? null,
      });

    if (upsertErr) throw upsertErr;

    res.json(options);
  } catch (err: any) {
    console.error('[WebAuthn] login/options error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
