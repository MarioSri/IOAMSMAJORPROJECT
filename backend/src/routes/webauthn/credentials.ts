// backend/src/routes/webauthn/credentials.ts
import { Router } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { getUser } from '../../lib/getUser';

export const credentialsRouter = Router();

// GET /api/webauthn/credentials — list all active passkeys for the authenticated user
credentialsRouter.get('/credentials', async (req, res) => {
  try {
    const user = await getUser(req);

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id, device_name, device_type, backup_state, backup_eligible, last_used_at, created_at, aaguid')
      .eq('user_id', user.id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data ?? []);
  } catch (err: any) {
    console.error('[WebAuthn] credentials GET error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// DELETE /api/webauthn/credentials/:id — revoke a specific passkey
credentialsRouter.delete('/credentials/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    const { id } = req.params;

    // Verify ownership before revoking — prevents horizontal privilege escalation
    const { data: cred } = await supabaseAdmin
      .from('user_credentials')
      .select('id, credential_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_revoked', false)
      .single();

    if (!cred) {
      res.status(404).json({ error: 'Credential not found or already revoked' });
      return;
    }

    // Soft revoke — preserves audit trail
    const { error: revokeErr } = await supabaseAdmin
      .from('user_credentials')
      .update({ is_revoked: true })
      .eq('id', id);

    if (revokeErr) throw revokeErr;

    // Audit log
    await supabaseAdmin.from('webauthn_audit_log').insert({
      user_id:       user.id,
      credential_id: cred.credential_id,
      event_type:    'credential_revoked',
    });

    res.json({ revoked: true });
  } catch (err: any) {
    console.error('[WebAuthn] credentials DELETE error:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
