// backend/src/routes/webauthn/registerOptions.ts
import { Router } from 'express';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { supabaseAdmin } from '../../config/supabase';
import { webauthnConfig } from '../../lib/webauthnConfig';
import { getUser } from '../../lib/getUser';
import { checkRateLimit } from '../../lib/rateLimit';

export const registerOptionsRouter = Router();

registerOptionsRouter.post('/register/options', async (req, res) => {
  try {
    const user = await getUser(req);

    // Rate limit: 5 registration attempts per 15 minutes per user
    await checkRateLimit(`register:${user.id}`, 5, 15 * 60 * 1000);

    // Fetch existing active credentials to exclude (prevents re-registering same device)
    const { data: existing } = await supabaseAdmin
      .from('user_credentials')
      .select('credential_id, transports')
      .eq('user_id', user.id)
      .eq('is_revoked', false);

    const excludeCredentials = (existing ?? []).map(c => ({
      id: c.credential_id,
      type: 'public-key' as const,
      transports: c.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName: webauthnConfig.rpName,
      rpID: webauthnConfig.rpID,
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email ?? user.id,
      userDisplayName: user.user_metadata?.full_name ?? user.email ?? user.id,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'required',
        userVerification: 'required',
      },
    });

    // Delete any stale pending challenge for this user+purpose, then insert fresh one
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('auth_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('purpose', 'registration')
      .eq('status', 'pending');

    const { error: challengeError } = await supabaseAdmin
      .from('auth_challenges')
      .insert({
        user_id:    user.id,
        challenge:  options.challenge,
        purpose:    'registration',
        status:     'pending',
        expires_at: expiresAt,
      });

    if (challengeError) throw challengeError;

    res.json(options);
  } catch (err: any) {
    console.error('[WebAuthn] register/options error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
