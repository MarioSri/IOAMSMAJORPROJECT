-- IAOMS canonical schema cleanup
-- Date: 2026-08-21
-- Purpose:
--   1. Remove exact duplicate indexes and identical policy definitions.
--   2. Add covering indexes for live foreign-key columns.
--   3. Pin function search_path values for stable, safe execution.
--
-- This migration deliberately does not drop tables, columns, rows, or
-- application-facing RPC signatures. Historical SQL editor scripts remain
-- available for audit, while this file is the canonical cleanup pass.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Exact duplicate index cleanup
-- ---------------------------------------------------------------------------
-- idx_documents_submitter and idx_documents_submitter_id both index
-- documents(submitted_by). Retain the *_id name used by the newer migration.
DROP INDEX IF EXISTS public.idx_documents_submitter;

-- ---------------------------------------------------------------------------
-- 2. Cover live foreign keys that currently lack an index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_department_stats_user_id
  ON public.department_stats (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_trends_user_id
  ON public.monthly_trends (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id
  ON public.recovery_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_webauthn_audit_log_user_id
  ON public.webauthn_audit_log (user_id);

-- ---------------------------------------------------------------------------
-- 3. Remove policies whose predicates are identical to a retained policy
-- ---------------------------------------------------------------------------
-- The retained system policies already expose the same effective predicate.
DROP POLICY IF EXISTS "Users can view all department stats"
  ON public.department_stats;

DROP POLICY IF EXISTS "Users can view all monthly trends"
  ON public.monthly_trends;

-- The public active-recipient policy already covers both role-specific copies.
DROP POLICY IF EXISTS "Anon can read active recipients for auth lookup"
  ON public.role_recipients;

DROP POLICY IF EXISTS "Authenticated users can read active recipients"
  ON public.role_recipients;

-- ---------------------------------------------------------------------------
-- 4. Stabilize function resolution for existing triggers and RPCs
-- ---------------------------------------------------------------------------
-- Existing function bodies rely on public tables and auth.uid(). Keeping both
-- schemas explicit preserves behavior while preventing caller-controlled
-- search_path resolution. pg_temp remains last for PostgreSQL compatibility.
ALTER FUNCTION public.can_see_shared_comment(text)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.check_user_document_access(uuid, text)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.cleanup_expired_chat()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.cleanup_old_notifications()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.create_default_notification_preferences()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.create_document_chat_channel()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.create_document_notification()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.create_emergency_chat_channel()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.delete_expired_challenges()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.expire_old_live_meetings()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.get_department_analytics(uuid)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.get_user_auth_providers(text)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_admin()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_document_participant(uuid)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_document_submitter(uuid)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.set_notification_prefs_updated_at()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.set_pin_for_recipient(text, text)
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_analytics_metrics()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_approval_timestamp()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_emergency_contacts_timestamp()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_emergency_timestamp()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_live_meeting_timestamp()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_meeting_timestamp()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_notifications_updated_at()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.verify_pin(text)
  SET search_path = public, auth, pg_temp;

COMMIT;
