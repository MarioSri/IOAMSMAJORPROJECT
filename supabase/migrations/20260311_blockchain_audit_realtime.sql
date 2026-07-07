-- =============================================================================
-- Enable Supabase Realtime for blockchain_audit_log
-- This allows the frontend to subscribe to live INSERT events so the
-- audit trail UI updates in real time as the Rekor queue worker writes entries.
-- Uses DO blocks to be idempotent — safe to run even if already configured.
-- =============================================================================

-- Full replica identity so Realtime sends all column values (not just PK)
ALTER TABLE public.blockchain_audit_log REPLICA IDENTITY FULL;
ALTER TABLE public.rekor_queue REPLICA IDENTITY FULL;

-- Add blockchain_audit_log to the realtime publication only if not already a member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'blockchain_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blockchain_audit_log;
  END IF;
END $$;

-- Add rekor_queue to the realtime publication only if not already a member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rekor_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rekor_queue;
  END IF;
END $$;
