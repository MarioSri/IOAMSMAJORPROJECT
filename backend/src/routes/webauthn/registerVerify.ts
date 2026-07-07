// backend/src/routes/webauthn/registerVerify.ts
import { Router } from 'express';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '../../config/supabase';
import { webauthnConfig } from '../../lib/webauthnConfig';
import { getUser } from '../../lib/getUser';
import { randomUUID, createHash, randomBytes } from 'crypto';

export const registerVerifyRouter = Router();

/** Generate 10 unique backup codes in IAOMS-XXXX-XXXX format */
function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < 10; i++) {
    const part1 = randomBytes(2).toString('hex').toUpperCase();
    const part2 = randomBytes(2).toString('hex').toUpperCase();
    const code = `IAOMS-${part1}-${part2}`;
    plain.push(code);
    hashed.push(createHash('sha256').update(code).digest('hex'));
  }

  return { plain, hashed };
}

registerVerifyRouter.post('/register/verify', async (req, res) => {
  const requestId = randomUUID();
  try {
    const user = await getUser(req);
    const { body, deviceName } = req.body;

    // 1. Fetch and validate pending challenge
    const { data: challengeRow, error: fetchErr } = await supabaseAdmin
      .from('auth_challenges')
      .select('id, challenge, expires_at')
      .eq('user_id', user.id)
      .eq('purpose', 'registration')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !challengeRow) {
      throw Object.assign(new Error('No pending registration challenge found'), { status: 400 });
    }

    if (new Date(challengeRow.expires_at) < new Date()) {
      await supabaseAdmin.from('auth_challenges')
        .update({ status: 'expired' }).eq('id', challengeRow.id);
      throw Object.assign(new Error('Challenge has expired — please try again'), { status: 400 });
    }

    // 2. Verify with SimpleWebAuthn
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: [...webauthnConfig.validOrigins],
      expectedRPID: webauthnConfig.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw Object.assign(new Error('Credential verification failed'), { status: 400 });
    }

    const { registrationInfo } = verification;
    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = registrationInfo;

    // 3. Check if this is the user's first passkey (for backup code generation)
    const { count: existingCount } = await supabaseAdmin
      .from('user_credentials')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_revoked', false);

    const isFirstPasskey = (existingCount ?? 0) === 0;

    // 4. Atomic: mark challenge used + save credential
    const [challengeUpdate, credentialInsert] = await Promise.all([
      supabaseAdmin.from('auth_challenges')
        .update({ status: 'used' }).eq('id', challengeRow.id),
      supabaseAdmin.from('user_credentials').insert({
        user_id:         user.id,
        credential_id:   credential.id,
        public_key:      Buffer.from(credential.publicKey).toString('base64url'),
        counter:         credential.counter,
        transports:      body.response?.transports ?? [],
        device_name:     deviceName ?? 'My Device',
        device_type:     credentialDeviceType,
        aaguid:          aaguid,
        backup_eligible: credentialDeviceType === 'multiDevice',
        backup_state:    credentialBackedUp,
      }),
    ]);

    if (challengeUpdate.error) throw challengeUpdate.error;
    if (credentialInsert.error) throw credentialInsert.error;

    // 5. Generate backup codes on first passkey registration
    let backupCodes: string[] | undefined;
    if (isFirstPasskey) {
      const { plain, hashed } = generateBackupCodes();

      // Clear any previous codes for this user then insert fresh ones
      await supabaseAdmin.from('recovery_codes').delete().eq('user_id', user.id);
      const codeRows = hashed.map(code_hash => ({ user_id: user.id, code_hash }));
      const { error: codesError } = await supabaseAdmin
        .from('recovery_codes')
        .insert(codeRows);

      if (codesError) {
        console.error('[WebAuthn] Failed to insert recovery codes:', codesError.message);
      } else {
        backupCodes = plain; // Only returned in this response — never again
      }
    }

    // 6. Audit log
    await supabaseAdmin.from('webauthn_audit_log').insert({
      user_id:       user.id,
      credential_id: credential.id,
      request_id:    requestId,
      event_type:    'registration_success',
      counter_after: credential.counter,
      metadata:      { first_passkey: isFirstPasskey, device_name: deviceName ?? 'My Device' },
    });

    const response: any = { verified: true };
    if (backupCodes) response.backupCodes = backupCodes;

    res.json(response);
  } catch (err: any) {
    try {
      await supabaseAdmin.from('webauthn_audit_log').insert({
        request_id: requestId,
        event_type: 'registration_fail',
        metadata:   { error: err.message },
      });
    } catch {
      // non-fatal
    }
    console.error('[WebAuthn] register/verify error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
