-- ============================================================
-- IAOMS WebAuthn Final Schema
-- All 5 tables — zero existing tables modified
-- ============================================================

CREATE TABLE user_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id   TEXT UNIQUE NOT NULL,
  public_key      TEXT NOT NULL,
  counter         BIGINT NOT NULL DEFAULT 0,
  transports      TEXT[] NOT NULL DEFAULT '{}',
  device_name     TEXT,
  device_type     TEXT,
  aaguid          TEXT,
  backup_eligible BOOLEAN NOT NULL DEFAULT false,
  backup_state    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  is_revoked      BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE auth_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge  TEXT UNIQUE NOT NULL,
  purpose    TEXT NOT NULL
             CHECK (purpose IN ('registration','authentication','approval','document_signing')),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','used','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recovery_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  is_used    BOOLEAN NOT NULL DEFAULT false,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webauthn_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  credential_id TEXT,
  request_id    UUID,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'registration_success','registration_fail',
    'auth_success','auth_fail','credential_revoked',
    'document_approval','document_signing',
    'recovery_used','recovery_fail',
    'challenge_created','challenge_expired'
  )),
  counter_before BIGINT,
  counter_after  BIGINT,
  document_id    UUID,
  trust_level    TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rate_limit_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON rate_limit_events (key, created_at);
CREATE INDEX ON user_credentials (user_id, is_revoked);
CREATE INDEX ON user_credentials (credential_id);
CREATE INDEX ON auth_challenges (expires_at);
CREATE INDEX ON webauthn_audit_log (request_id);

-- Optimised verify index: covers filter AND sort (no extra sort step)
CREATE INDEX auth_challenges_verify_idx
  ON auth_challenges (user_id, purpose, status, created_at DESC);

-- Note: challenges are deduplicated via delete-then-insert in application code
-- (Partial indexes cannot be used as ON CONFLICT targets in Postgres)

-- Row Level Security
ALTER TABLE user_credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own credentials"
  ON user_credentials FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service role credentials"
  ON user_credentials FOR ALL TO service_role USING (true);

CREATE POLICY "service role challenges"
  ON auth_challenges FOR ALL TO service_role USING (true);

CREATE POLICY "service role audit"
  ON webauthn_audit_log FOR ALL TO service_role USING (true);

CREATE POLICY "service role recovery"
  ON recovery_codes FOR ALL TO service_role USING (true);

CREATE POLICY "service role rate limit"
  ON rate_limit_events FOR ALL TO service_role USING (true);
