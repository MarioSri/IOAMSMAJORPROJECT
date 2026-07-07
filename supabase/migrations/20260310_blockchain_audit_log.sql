-- =============================================================================
-- Blockchain-Style Audit Logging — Sigstore Rekor Integration
-- Three new tables:
--   1. blockchain_audit_log — tamper-evident metadata index
--   2. rekor_queue          — async upload queue
--   3. rekor_monitoring_log — daily consistency monitoring results
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. blockchain_audit_log
-- Stores metadata references to Rekor transparency log entries.
-- Rekor is the immutable source of truth; this table is the queryable index.
-- Any tampering here is detectable by cross-referencing rekor_uuid.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blockchain_audit_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           TEXT        NOT NULL,
  document_hash         TEXT,                   -- SHA-256 of document metadata
  original_document_hash TEXT,                  -- Hash at initial submission (for drift detection)
  actor_id_hash         TEXT,                   -- SHA-256(actor_email) for Phase 2 privacy migration
  actor_email           TEXT        NOT NULL,
  actor_role            TEXT        NOT NULL,
  action                TEXT        NOT NULL,   -- SUBMITTED, APPROVED, REJECTED, BYPASSED, etc.
  workflow_step         TEXT,
  timestamp             TIMESTAMPTZ NOT NULL,
  event_hash            TEXT        NOT NULL UNIQUE,  -- SHA-256 of canonical event payload
  previous_event_hash   TEXT,                   -- NULL for first event; FK enforces chain integrity
  rekor_uuid            TEXT        UNIQUE,      -- Rekor transparency log UUID (set after async upload)
  rekor_log_index       BIGINT,                 -- Rekor log index number
  verification_status   TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (verification_status IN ('pending', 'verified', 'failed', 'tampered')),
  last_verified_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-referencing chain constraint: previous_event_hash must point to a valid event_hash
-- (Nullable to allow NULL for the first event in a document chain)
ALTER TABLE public.blockchain_audit_log
  ADD CONSTRAINT fk_previous_event_hash
  FOREIGN KEY (previous_event_hash)
  REFERENCES public.blockchain_audit_log (event_hash)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- Indexes
CREATE INDEX idx_blockchain_audit_document_ts
  ON public.blockchain_audit_log (document_id, timestamp ASC);

CREATE INDEX idx_blockchain_audit_rekor_uuid
  ON public.blockchain_audit_log (rekor_uuid)
  WHERE rekor_uuid IS NOT NULL;

CREATE INDEX idx_blockchain_audit_event_hash
  ON public.blockchain_audit_log (event_hash);

CREATE INDEX idx_blockchain_audit_prev_hash
  ON public.blockchain_audit_log (previous_event_hash)
  WHERE previous_event_hash IS NOT NULL;

CREATE INDEX idx_blockchain_audit_actor_ts
  ON public.blockchain_audit_log (actor_email, timestamp DESC);

CREATE INDEX idx_blockchain_audit_action
  ON public.blockchain_audit_log (action, timestamp DESC);

-- RLS
ALTER TABLE public.blockchain_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend worker)
CREATE POLICY "blockchain_audit_log_service_all"
  ON public.blockchain_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own document events
-- or records where they are the actor
CREATE POLICY "blockchain_audit_log_auth_select"
  ON public.blockchain_audit_log
  FOR SELECT
  TO authenticated
  USING (
    actor_email = auth.jwt() ->> 'email'
    OR auth.role() = 'service_role'
  );

-- Admins (role_recipients with role = 'ADMIN') can read all records
CREATE POLICY "blockchain_audit_log_admin_select"
  ON public.blockchain_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_recipients
      WHERE email = auth.jwt() ->> 'email'
        AND role = 'ADMIN'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. rekor_queue
-- Async upload queue for Rekor transparency log uploads.
-- Items are inserted immediately on document action; background worker
-- processes them and moves status to COMPLETED on success.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rekor_queue (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   TEXT        NOT NULL,
  event_data    JSONB       NOT NULL,    -- Full event payload to be signed + uploaded
  event_hash    TEXT        NOT NULL,    -- Pre-computed event hash matching blockchain_audit_log
  status        TEXT        NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  retry_count   INT         NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX idx_rekor_queue_status_created
  ON public.rekor_queue (status, created_at ASC)
  WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX idx_rekor_queue_document_id
  ON public.rekor_queue (document_id);

-- RLS: service role only — no direct application access
ALTER TABLE public.rekor_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rekor_queue_service_only"
  ON public.rekor_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. rekor_monitoring_log
-- Records results of daily monitoring checks against the Rekor transparency
-- log. Sigstore recommends monitoring to detect log misbehavior.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rekor_monitoring_log (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date                  DATE    NOT NULL,
  log_consistency_status      TEXT,   -- 'ok' | 'failed' | 'skipped'
  tree_head_valid             BOOLEAN,
  unexpected_entries_found    INT     NOT NULL DEFAULT 0,
  issues_detected             TEXT[], -- Array of issue descriptions
  monitoring_duration_ms      INT,
  rekor_tree_size             BIGINT, -- Tree size reported by Rekor at check time
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rekor_monitoring_date
  ON public.rekor_monitoring_log (check_date DESC);

-- RLS: service role only
ALTER TABLE public.rekor_monitoring_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rekor_monitoring_service_only"
  ON public.rekor_monitoring_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow admins to read monitoring results
CREATE POLICY "rekor_monitoring_admin_select"
  ON public.rekor_monitoring_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_recipients
      WHERE email = auth.jwt() ->> 'email'
        AND role = 'ADMIN'
    )
  );
