-- Add parent_message_id and reactions columns to chat_messages
DO $$
BEGIN
  -- Add parent_message_id for replies
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='parent_message_id') THEN
    ALTER TABLE chat_messages ADD COLUMN parent_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;
  END IF;

  -- Add reactions for emoji responses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='reactions') THEN
    ALTER TABLE chat_messages ADD COLUMN reactions JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add index for reply lookup
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON chat_messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
