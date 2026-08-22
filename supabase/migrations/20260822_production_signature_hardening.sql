-- IAOMS production-grade signature hardening
-- Date: 2026-08-22
-- Purpose:
--   1. Make signed artifacts private and participant-scoped.
--   2. Replace permissive document policies with participant-scoped policies.
--   3. Prevent browser clients from mutating signature evidence columns.
--   4. Add one-time server-authoritative signing transactions.
--   5. Store final-artifact hashes and durable signing audit context.
--   6. Complete metadata, audit, and transaction updates atomically.
--
-- Apply this migration only after reviewing the access model for existing rows.
-- The application must use the protected backend signing route after this file
-- is applied. Existing public storage URLs should be replaced by storage_path
-- references or the authenticated signing-file endpoint.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Signature evidence columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS signature_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signed_file_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signed_by TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signature_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_signed_date DATE,
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash_computed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_artifact_hash TEXT,
  ADD COLUMN IF NOT EXISTS signing_transaction_id UUID,
  ADD COLUMN IF NOT EXISTS signing_version BIGINT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Durable signing transaction table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_version BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
  auth_method TEXT NOT NULL DEFAULT 'session'
    CHECK (auth_method IN ('session', 'passkey', 'backup_code')),
  auth_request_id UUID,
  auth_verified_at TIMESTAMPTZ,
  original_document_hash TEXT,
  signed_artifact_hash TEXT,
  signed_file_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  completed_at TIMESTAMPTZ,
  CONSTRAINT signing_transactions_file_count_nonnegative
    CHECK (signed_file_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_signing_transactions_user_status
  ON public.signing_transactions (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signing_transactions_document_status
  ON public.signing_transactions (document_id, status, created_at DESC);

ALTER TABLE public.signing_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.signing_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.signing_transactions TO service_role;
DROP POLICY IF EXISTS signing_transactions_service_all ON public.signing_transactions;
CREATE POLICY signing_transactions_service_all
  ON public.signing_transactions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Bind WebAuthn evidence to a signing transaction when the optional WebAuthn
-- hardening patch is applied before this migration.
ALTER TABLE public.auth_challenges
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS signing_transaction_id UUID REFERENCES public.signing_transactions(id) ON DELETE SET NULL;

ALTER TABLE public.webauthn_audit_log
  ADD COLUMN IF NOT EXISTS signing_transaction_id UUID REFERENCES public.signing_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auth_method TEXT;

CREATE INDEX IF NOT EXISTS idx_auth_challenges_signing_transaction
  ON public.auth_challenges (signing_transaction_id)
  WHERE signing_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webauthn_audit_signing_transaction
  ON public.webauthn_audit_log (signing_transaction_id)
  WHERE signing_transaction_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Extend the document audit record with signing evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_audit_log
  ADD COLUMN IF NOT EXISTS actor_id UUID,
  ADD COLUMN IF NOT EXISTS signing_transaction_id UUID,
  ADD COLUMN IF NOT EXISTS auth_method TEXT,
  ADD COLUMN IF NOT EXISTS original_document_hash TEXT,
  ADD COLUMN IF NOT EXISTS signed_artifact_hash TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_document_audit_log_signing_transaction
  ON public.document_audit_log (signing_transaction_id)
  WHERE signing_transaction_id IS NOT NULL;

ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_audit_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.document_audit_log TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.document_audit_log TO service_role;
DROP POLICY IF EXISTS "Service role can insert audit events" ON public.document_audit_log;
DROP POLICY IF EXISTS "Users can read own document audit log" ON public.document_audit_log;
DROP POLICY IF EXISTS document_audit_log_service_all ON public.document_audit_log;
CREATE POLICY document_audit_log_service_all
  ON public.document_audit_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS document_audit_log_participant_select ON public.document_audit_log;
CREATE POLICY document_audit_log_participant_select
  ON public.document_audit_log
  FOR SELECT TO authenticated
  USING (public.is_document_participant(document_id));

-- Resolve admin privileges from the linked role-recipient profile rather than
-- trusting a client-provided role value.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_recipients rr
    WHERE rr.supabase_uid = auth.uid()
      AND LOWER(rr.role) = 'admin'
      AND COALESCE(rr.is_active, true) = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Participant-scoped documents policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents" ON public.documents;
DROP POLICY IF EXISTS documents_select_v3 ON public.documents;
DROP POLICY IF EXISTS documents_insert_v3 ON public.documents;
DROP POLICY IF EXISTS documents_update_v3 ON public.documents;
DROP POLICY IF EXISTS documents_delete_v3 ON public.documents;

CREATE POLICY documents_select_production
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.is_document_participant(id)
    OR public.is_document_submitter(id)
    OR public.is_admin()
  );

CREATE POLICY documents_insert_production
  ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    submitter_id = auth.uid()::text
  );

CREATE POLICY documents_update_production
  ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.is_document_participant(id)
    OR public.is_document_submitter(id)
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_document_participant(id)
    OR public.is_document_submitter(id)
    OR public.is_admin()
  );

CREATE POLICY documents_delete_production
  ON public.documents
  FOR DELETE TO authenticated
  USING (
    public.is_document_submitter(id)
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 5. Do not permit browser clients to rewrite signature evidence columns.
--    The protected backend completion route uses service_role and remains able
--    to write these values inside the atomic RPC below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_client_signature_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.signature_metadata IS DISTINCT FROM OLD.signature_metadata
    OR NEW.signed_file_urls IS DISTINCT FROM OLD.signed_file_urls
    OR NEW.signed_by IS DISTINCT FROM OLD.signed_by
    OR NEW.signature_count IS DISTINCT FROM OLD.signature_count
    OR NEW.last_signed_date IS DISTINCT FROM OLD.last_signed_date
    OR NEW.document_hash IS DISTINCT FROM OLD.document_hash
    OR NEW.hash_computed_at IS DISTINCT FROM OLD.hash_computed_at
    OR NEW.signed_artifact_hash IS DISTINCT FROM OLD.signed_artifact_hash
    OR NEW.signing_transaction_id IS DISTINCT FROM OLD.signing_transaction_id
    OR NEW.signing_version IS DISTINCT FROM OLD.signing_version
  ) THEN
    RAISE EXCEPTION 'Signature evidence can only be changed by the signing service';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_document_signature_evidence ON public.documents;
CREATE TRIGGER protect_document_signature_evidence
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_signature_mutation();

-- ---------------------------------------------------------------------------
-- 6. Private, participant-scoped storage
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'BCXN';

DROP POLICY IF EXISTS "BCXN: Public read" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Owners can delete their files" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Participant read" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Participant upload" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Participant update" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Participant delete" ON storage.objects;

CREATE POLICY "BCXN: Participant read"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'BCXN'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      THEN public.is_document_participant(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY "BCXN: Participant upload"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'BCXN'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      THEN public.is_document_participant(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY "BCXN: Participant update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'BCXN'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      THEN public.is_document_participant(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  )
  WITH CHECK (
    bucket_id = 'BCXN'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      THEN public.is_document_participant(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY "BCXN: Participant delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'BCXN'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      THEN (
        public.is_document_submitter(((storage.foldername(name))[1])::uuid)
        OR public.is_admin()
      )
      ELSE false
    END
  );

-- ---------------------------------------------------------------------------
-- 7. Atomic completion of a server-authorized signing transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_document_signing(
  p_document_id UUID,
  p_transaction_id UUID,
  p_signer_id UUID,
  p_signer_name TEXT,
  p_signature_metadata JSONB,
  p_signed_file_urls JSONB,
  p_signed_by TEXT[],
  p_signature_count INTEGER,
  p_original_document_hash TEXT,
  p_signed_artifact_hash TEXT,
  p_signed_file_count INTEGER,
  p_ip_address INET,
  p_user_agent TEXT,
  p_audit_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  tx public.signing_transactions%ROWTYPE;
  doc public.documents%ROWTYPE;
  now_utc TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO tx
  FROM public.signing_transactions
  WHERE id = p_transaction_id
    AND document_id = p_document_id
    AND user_id = p_signer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signing transaction not found';
  END IF;

  IF tx.status <> 'pending' THEN
    RAISE EXCEPTION 'Signing transaction is no longer pending';
  END IF;

  IF tx.expires_at <= now_utc THEN
    UPDATE public.signing_transactions
    SET status = 'expired'
    WHERE id = tx.id;
    RAISE EXCEPTION 'Signing transaction expired';
  END IF;

  IF tx.auth_verified_at IS NULL THEN
    RAISE EXCEPTION 'Signing authentication is not verified';
  END IF;

  SELECT * INTO doc
  FROM public.documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF COALESCE(doc.signing_version, 0) <> tx.document_version THEN
    RAISE EXCEPTION 'Document changed after signing started';
  END IF;

  UPDATE public.documents
  SET signature_metadata = p_signature_metadata,
      signed_file_urls = p_signed_file_urls,
      signed_by = p_signed_by,
      signature_count = p_signature_count,
      last_signed_date = CURRENT_DATE,
      signed_artifact_hash = p_signed_artifact_hash,
      signing_transaction_id = tx.id,
      signing_version = COALESCE(doc.signing_version, 0) + 1,
      updated_at = now_utc
  WHERE id = p_document_id;

  INSERT INTO public.document_audit_log (
    document_id,
    event_type,
    user_name,
    metadata,
    actor_id,
    signing_transaction_id,
    auth_method,
    original_document_hash,
    signed_artifact_hash,
    ip_address,
    user_agent
  ) VALUES (
    p_document_id,
    'document_signed',
    p_signer_name,
    COALESCE(p_audit_metadata, '{}'::jsonb),
    p_signer_id,
    tx.id,
    tx.auth_method,
    p_original_document_hash,
    p_signed_artifact_hash,
    p_ip_address,
    p_user_agent
  );

  UPDATE public.signing_transactions
  SET status = 'completed',
      original_document_hash = p_original_document_hash,
      signed_artifact_hash = p_signed_artifact_hash,
      signed_file_count = p_signed_file_count,
      completed_at = now_utc
  WHERE id = tx.id;

  RETURN jsonb_build_object(
    'documentId', p_document_id,
    'transactionId', tx.id,
    'signedArtifactHash', p_signed_artifact_hash,
    'signatureCount', p_signature_count,
    'signedFileCount', p_signed_file_count,
    'completedAt', now_utc
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_document_signing(
  UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT[], INTEGER, TEXT, TEXT,
  INTEGER, INET, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_document_signing(
  UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT[], INTEGER, TEXT, TEXT,
  INTEGER, INET, TEXT, JSONB
) TO service_role;

COMMIT;
