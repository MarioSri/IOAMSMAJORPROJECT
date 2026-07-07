-- ============================================================
-- Chat Realtime Overhaul Migration
-- Date: 2026-03-05
--
-- Changes:
--   1. Add document_id and workflow_completed_at to chat_channels
--   2. Fix create_document_chat_channel trigger (use recipient_ids)
--   3. Add create_emergency_chat_channel trigger
--   4. Fix check_workflow_completion trigger (use document_id)
--   5. pg_cron auto-deletion (messages 24h, channels 1-week)
--   6. Scoped RLS policies replacing permissive USING(true)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Schema: add document_id and workflow_completed_at
--    Also ensures role_recipients.supabase_uid exists and is
--    indexed uniquely (earlier migrations may have added it
--    as UUID or TEXT; this is a belt-and-suspenders guard).
-- ──────────────────────────────────────────────────────────

-- Ensure the supabase_uid column exists on role_recipients.
-- IF NOT EXISTS is a no-op if already created by 20260224_auth_supabase_users.sql.
ALTER TABLE role_recipients
  ADD COLUMN IF NOT EXISTS supabase_uid TEXT;

-- Unique partial index: one auth UID per recipient row.
-- Partial (WHERE NOT NULL) so NULLs don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_recipients_supabase_uid
  ON role_recipients(supabase_uid)
  WHERE supabase_uid IS NOT NULL;

ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS document_id TEXT,
  ADD COLUMN IF NOT EXISTS workflow_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_chat_channels_document_id
  ON chat_channels(document_id)
  WHERE document_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_document_channel'
  ) THEN
    ALTER TABLE chat_channels
      ADD CONSTRAINT unique_document_channel UNIQUE(document_id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 2. Fix trigger: create channel when a document is inserted
--    Uses documents.recipient_ids[] resolved via role_recipients
--    to get supabase_uid for each member.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_document_chat_channel()
RETURNS TRIGGER AS $$
DECLARE
  member_ids TEXT[];
  channel_prefix TEXT;
  lock_id BIGINT;
BEGIN
  -- Distributed lock: prevents concurrent channel creation attempts for the same document
  lock_id := hashtext('doc_' || NEW.id::text);
  PERFORM pg_advisory_lock(lock_id);

  -- Only create channels for specific document sources
  -- Skip if source is null or not in the allowed list
  IF NEW.source IS NULL OR NEW.source NOT IN ('document-management', 'emergency-management', 'approval-chain-bypass') THEN
    PERFORM pg_advisory_unlock(lock_id);
    RETURN NEW;
  END IF;

  -- Determine channel name prefix based on source
  channel_prefix := CASE NEW.source
    WHEN 'document-management' THEN 'DocMgmt: '
    WHEN 'emergency-management' THEN 'Emergency: '
    WHEN 'approval-chain-bypass' THEN 'ApprovalChain: '
    ELSE 'Doc: '
  END;

  -- Resolve recipient UUIDs → supabase_uid; skip recipients without a linked uid
  SELECT ARRAY_AGG(DISTINCT rr.supabase_uid::text)
  INTO member_ids
  FROM role_recipients rr
  WHERE (rr.id::text = ANY(NEW.recipient_ids::text[]) OR rr.name = ANY(NEW.recipients))
    AND rr.supabase_uid IS NOT NULL;

  -- Always include the submitter
  member_ids := array_append(COALESCE(member_ids, ARRAY[]::text[]), NEW.submitter_id::text);
  -- Remove duplicates
  SELECT ARRAY_AGG(DISTINCT uid)
  INTO member_ids
  FROM UNNEST(member_ids) AS uid;

  -- Skip if there is already a channel for this document (idempotency check under lock)
  IF EXISTS (SELECT 1 FROM chat_channels WHERE document_id = NEW.id::text) THEN
    PERFORM pg_advisory_unlock(lock_id);
    RETURN NEW;
  END IF;

  INSERT INTO chat_channels (
    name,
    description,
    type,
    is_private,
    created_by,
    members,
    admins,
    document_id
  ) VALUES (
    channel_prefix || LEFT(NEW.title, 80),
    'Auto-created channel for document: ' || NEW.title || ' (source: ' || NEW.source || ')',
    'document',
    TRUE,
    NEW.submitter_id::text,
    member_ids,
    ARRAY[NEW.submitter_id::text],
    NEW.id::text
  );

  PERFORM pg_advisory_unlock(lock_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_create_document_channel ON documents;
CREATE TRIGGER auto_create_document_channel
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION create_document_chat_channel();

-- ──────────────────────────────────────────────────────────
-- 3. New trigger: create channel when an emergency document is inserted
--    emergency_documents.recipients stores display names (TEXT[]),
--    resolved via role_recipients.name → supabase_uid.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_emergency_chat_channel()
RETURNS TRIGGER AS $$
DECLARE
  member_ids TEXT[];
  lock_id BIGINT;
BEGIN
  -- Distributed lock: prevents concurrent channel creation attempts for the same emergency document
  lock_id := hashtext('emergency_' || NEW.id::text);
  PERFORM pg_advisory_lock(lock_id);

  -- Resolve recipient display names or IDs → supabase_uid
  SELECT ARRAY_AGG(DISTINCT rr.supabase_uid::text)
  INTO member_ids
  FROM role_recipients rr
  WHERE (rr.id::text = ANY(NEW.recipients::text[]) OR rr.name = ANY(NEW.recipient_names))
    AND rr.supabase_uid IS NOT NULL;

  -- If recipient_names column exists, also try matching by name stored there
  -- (handles both column names across schema versions)

  -- Always include the submitter
  member_ids := array_append(COALESCE(member_ids, ARRAY[]::text[]), NEW.submitter_id::text);
  SELECT ARRAY_AGG(DISTINCT uid)
  INTO member_ids
  FROM UNNEST(member_ids) AS uid;

  -- Skip if channel already exists for this emergency document (idempotency check under lock)
  IF EXISTS (SELECT 1 FROM chat_channels WHERE document_id = NEW.id::text) THEN
    PERFORM pg_advisory_unlock(lock_id);
    RETURN NEW;
  END IF;

  INSERT INTO chat_channels (
    name,
    description,
    type,
    is_private,
    created_by,
    members,
    admins,
    document_id
  ) VALUES (
    'Emergency: ' || LEFT(NEW.title, 75),
    'Auto-created channel for emergency: ' || NEW.title,
    'emergency',
    TRUE,
    NEW.submitter_id::text,
    member_ids,
    ARRAY[NEW.submitter_id::text],
    NEW.id::text
  );

  PERFORM pg_advisory_unlock(lock_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_create_emergency_channel ON emergency_documents;
CREATE TRIGGER auto_create_emergency_channel
  AFTER INSERT ON emergency_documents
  FOR EACH ROW
  EXECUTE FUNCTION create_emergency_chat_channel();

-- ──────────────────────────────────────────────────────────
-- 4. Fix workflow completion trigger: mark channel's
--    workflow_completed_at when document reaches final state.
--    Uses document_id column added in step 1.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_workflow_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_document_id text;
BEGIN
  -- Resolve the document_id from the parent document_workflows row
  SELECT dw.document_id::text INTO v_document_id
  FROM document_workflows dw
  WHERE dw.id = NEW.workflow_id;

  IF v_document_id IS NOT NULL THEN
    UPDATE chat_channels
    SET workflow_completed_at = NOW()
    WHERE document_id = v_document_id
      AND workflow_completed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires on workflow_steps (which has the 'status' column).
-- When any step reaches 'completed' or 'rejected', the linked chat channel
-- gets workflow_completed_at set so the 7-day cleanup cron can act on it.
DROP TRIGGER IF EXISTS check_document_workflow_completion ON workflow_steps;
CREATE TRIGGER check_document_workflow_completion
  AFTER UPDATE ON workflow_steps
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed', 'rejected'))
  EXECUTE FUNCTION check_workflow_completion();

-- ──────────────────────────────────────────────────────────
-- 5. pg_cron auto-deletion
--    Messages older than 24 hours are hard-deleted.
--    Document/emergency channels are deleted 7 days after
--    workflow_completed_at; orphaned document channels (no
--    workflow_completed_at) are removed after 14 days.
-- ──────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_chat()
RETURNS void AS $$
BEGIN
  -- Delete messages older than 24 hours
  DELETE FROM chat_messages
  WHERE created_at < NOW() - INTERVAL '24 hours';

  -- Delete document/emergency channels where workflow completed >7 days ago
  DELETE FROM chat_channels
  WHERE document_id IS NOT NULL
    AND workflow_completed_at IS NOT NULL
    AND workflow_completed_at < NOW() - INTERVAL '7 days';

  -- Delete orphaned document/emergency channels (no workflow_completed_at) older than 14 days
  DELETE FROM chat_channels
  WHERE document_id IS NOT NULL
    AND workflow_completed_at IS NULL
    AND updated_at < NOW() - INTERVAL '14 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: hourly for messages, daily at midnight for channels
-- (cron.schedule is idempotent when the same job name is used)
SELECT cron.schedule(
  'cleanup-chat-messages',
  '0 * * * *',
  'SELECT cleanup_expired_chat();'
);

SELECT cron.schedule(
  'cleanup-chat-channels',
  '0 0 * * *',
  $$DELETE FROM chat_channels
    WHERE document_id IS NOT NULL
      AND (
        (workflow_completed_at IS NOT NULL AND workflow_completed_at < NOW() - INTERVAL '7 days')
        OR
        (workflow_completed_at IS NULL AND updated_at < NOW() - INTERVAL '14 days')
      )$$
);

-- ──────────────────────────────────────────────────────────
-- 6. Scoped RLS policies (replace permissive USING(true))
-- ──────────────────────────────────────────────────────────

-- Drop all existing policies on chat_channels
DROP POLICY IF EXISTS "Users can view channels they are members of" ON chat_channels;
DROP POLICY IF EXISTS "Users can create channels" ON chat_channels;
DROP POLICY IF EXISTS "Users can update channels they created" ON chat_channels;
DROP POLICY IF EXISTS "Users can delete channels they created" ON chat_channels;
DROP POLICY IF EXISTS "chat_channels_select" ON chat_channels;
DROP POLICY IF EXISTS "chat_channels_insert" ON chat_channels;
DROP POLICY IF EXISTS "chat_channels_update" ON chat_channels;
DROP POLICY IF EXISTS "chat_channels_delete" ON chat_channels;

-- chat_channels: scoped policies
-- SELECT: user must be a member OR the creator
CREATE POLICY "chat_channels_select" ON chat_channels
  FOR SELECT
  USING (
    auth.uid()::text = ANY(members)
    OR created_by = auth.uid()::text
  );

-- INSERT: user must include themselves as a member
CREATE POLICY "chat_channels_insert" ON chat_channels
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = ANY(members)
  );

-- UPDATE: user must be a member
CREATE POLICY "chat_channels_update" ON chat_channels
  FOR UPDATE
  USING (
    auth.uid()::text = ANY(members)
    OR created_by = auth.uid()::text
  );

-- DELETE: only the channel creator
CREATE POLICY "chat_channels_delete" ON chat_channels
  FOR DELETE
  USING (
    created_by = auth.uid()::text
  );

-- Drop all existing policies on chat_messages
DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON chat_messages;

-- chat_messages: scoped policies
-- Helper: user is a member of the message's channel
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = channel_id
        AND auth.uid()::text = ANY(c.members)
    )
  );

CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = channel_id
        AND auth.uid()::text = ANY(c.members)
    )
  );

CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE
  USING (sender_id = auth.uid()::text);

CREATE POLICY "chat_messages_delete" ON chat_messages
  FOR DELETE
  USING (sender_id = auth.uid()::text);
