-- Function to auto-create chat channel when document is created
CREATE OR REPLACE FUNCTION create_document_chat_channel()
RETURNS TRIGGER AS $$
DECLARE
  channel_members TEXT[];
  channel_name TEXT;
BEGIN
  -- Extract recipients from workflow steps
  SELECT ARRAY_AGG(DISTINCT assignee_id::text)
  INTO channel_members
  FROM workflow_steps
  WHERE workflow_id IN (
    SELECT id FROM document_workflows WHERE document_id = NEW.id
  );

  -- Add submitter to members
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

-- Trigger for document creation
DROP TRIGGER IF EXISTS auto_create_document_channel ON documents;
CREATE TRIGGER auto_create_document_channel
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION create_document_chat_channel();

-- Function to check if workflow is completed and mark channel for deletion
CREATE OR REPLACE FUNCTION check_workflow_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected') THEN
    -- Update channel to mark it as eligible for deletion
    UPDATE chat_channels
    SET updated_at = NOW()
    WHERE type = 'document'
    AND name LIKE '%' || (SELECT title FROM documents WHERE id = NEW.document_id) || '%';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workflow completion
DROP TRIGGER IF EXISTS check_document_workflow_completion ON document_workflows;
CREATE TRIGGER check_document_workflow_completion
AFTER UPDATE ON document_workflows
FOR EACH ROW
WHEN (NEW.progress = 100)
EXECUTE FUNCTION check_workflow_completion();
