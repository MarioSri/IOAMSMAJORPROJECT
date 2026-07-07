-- Fix for the "function array_append(text[], uuid) does not exist" error
-- Run this in your Supabase SQL Editor to update the trigger function

CREATE OR REPLACE FUNCTION create_document_chat_channel()
RETURNS TRIGGER AS $$
DECLARE
  channel_members TEXT[];
  channel_name TEXT;
BEGIN
  -- Extract recipients from workflow steps (with safe cast)
  SELECT ARRAY_AGG(DISTINCT assignee_id::text)
  INTO channel_members
  FROM workflow_steps
  WHERE workflow_id IN (
    SELECT id FROM document_workflows WHERE document_id = NEW.id
  );

  -- Add submitter to members (handle null array and safe cast)
  channel_members := array_append(COALESCE(channel_members, ARRAY[]::text[]), NEW.submitter_id::text);

  -- Create channel name
  channel_name := 'Doc: ' || NEW.title;

  -- Insert chat channel
  INSERT INTO chat_channels (
    name,
    description,
    type,
    is_private,
    created_by,
    members,
    admins
  ) VALUES (
    channel_name,
    'Auto-created for document: ' || NEW.title,
    'document',
    true,
    NEW.submitter_id,
    channel_members,
    ARRAY[NEW.submitter_id]
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
