// backend/src/routes/webauthn/loginVerify.ts
import { Router } from 'express';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '../../config/supabase';
import { webauthnConfig } from '../../lib/webauthnConfig';
import { getUser } from '../../lib/getUser';
import { randomUUID } from 'crypto';

export const loginVerifyRouter = Router();

type Purpose = 'authentication' | 'approval' | 'document_signing';

loginVerifyRouter.post('/login/verify', async (req, res) => {
  const requestId = randomUUID();
  try {
    const user = await getUser(req);
    const { body, purpose = 'authentication', documentId, signingTransactionId } = req.body as {
      body: any;
      purpose?: Purpose;
      documentId?: string;
      signingTransactionId?: string;
    };

    // 1. Fetch credential from database
    const { data: credRow } = await supabaseAdmin
      .from('user_credentials')
      .select('id, public_key, counter, transports, backup_state')
      .eq('user_id', user.id)
      .eq('credential_id', body.id)
      .eq('is_revoked', false)
      .single();

    if (!credRow) {
      throw Object.assign(new Error('Credential not found or has been revoked'), { status: 404 });
    }

    // 2. Fetch pending challenge for this purpose
    const { data: challengeRow } = await supabaseAdmin
      .from('auth_challenges')
      .select('id, challenge, expires_at, document_id, signing_transaction_id')
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!challengeRow) {
      throw Object.assign(new Error('No pending challenge found — request fresh options'), { status: 400 });
    }

    if (purpose === 'document_signing' && (
      challengeRow.document_id !== documentId ||
      challengeRow.signing_transaction_id !== signingTransactionId
    )) {
      throw Object.assign(new Error('Signing challenge does not match the requested transaction'), { status: 401 });
    }

    if (new Date(challengeRow.expires_at) < new Date()) {
      await supabaseAdmin.from('auth_challenges')
        .update({ status: 'expired' }).eq('id', challengeRow.id);
      throw Object.assign(new Error('Challenge has expired — please try again'), { status: 400 });
    }

    // 3. Cryptographic verification
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin:    [...webauthnConfig.validOrigins],
      expectedRPID:      webauthnConfig.rpID,
      credential: {
        id:         body.id,
        publicKey:  Buffer.from(credRow.public_key, 'base64url'),
        counter:    credRow.counter,
        transports: credRow.transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw Object.assign(new Error('Authentication failed — biometric did not verify'), { status: 401 });
    }

    const newCounter  = verification.authenticationInfo.newCounter;
    const backupState = verification.authenticationInfo.credentialBackedUp;
    const trustLevel  = backupState ? 'synced' : 'device';

    // 4. Atomic: update counter + mark challenge used
    await Promise.all([
      supabaseAdmin.from('user_credentials').update({
        counter:      newCounter,
        backup_state: backupState,
        last_used_at: new Date().toISOString(),
      }).eq('id', credRow.id),
      supabaseAdmin.from('auth_challenges')
        .update({ status: 'used' }).eq('id', challengeRow.id),
    ]);

    // 5. Audit log
    const eventTypeMap: Record<Purpose, string> = {
      authentication:   'auth_success',
      approval:         'document_approval',
      document_signing: 'document_signing',
    };

    await supabaseAdmin.from('webauthn_audit_log').insert({
      user_id:        user.id,
      credential_id:  body.id,
      request_id:     requestId,
      event_type:     eventTypeMap[purpose as Purpose] ?? 'auth_success',
      counter_before: credRow.counter,
      counter_after:  newCounter,
        document_id:    documentId ?? null,
        signing_transaction_id: signingTransactionId ?? null,
        auth_method: purpose === 'document_signing' ? 'passkey' : null,
        trust_level:    trustLevel,
      });

    res.json({ verified: true, trustLevel, requestId });
  } catch (err: any) {
    try {
      await supabaseAdmin.from('webauthn_audit_log').insert({
        request_id: requestId,
        event_type: 'auth_fail',
        metadata:   { error: err.message },
      });
    } catch {
      // non-fatal
    }
    console.error('[WebAuthn] login/verify error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
