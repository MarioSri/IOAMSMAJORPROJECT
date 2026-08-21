-- IAOMS internal RPC execution hardening
-- Date: 2026-08-21
-- Purpose: finish search_path hardening and remove anonymous execution from
-- internal helpers/triggers/maintenance routines. Public PIN and provider
-- lookup endpoints are intentionally left unchanged for compatibility.

BEGIN;

ALTER FUNCTION public.current_user_id()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.check_workflow_completion()
  SET search_path = public, auth, pg_temp;

-- These routines are called by RLS policies, triggers, or backend maintenance.
-- They are not application-facing anonymous RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.can_see_shared_comment(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_user_document_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_chat() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_document_chat_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_document_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_emergency_chat_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_expired_challenges() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_department_analytics(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_document_participant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_document_submitter(uuid) FROM anon;

COMMIT;
