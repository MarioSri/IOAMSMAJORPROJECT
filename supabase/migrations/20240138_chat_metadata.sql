-- Add metadata, attachments, and mentions columns to chat_messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='metadata') THEN
    ALTER TABLE chat_messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='attachments') THEN
    ALTER TABLE chat_messages ADD COLUMN attachments JSONB[] DEFAULT '{}'::jsonb[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='mentions') THEN
    ALTER TABLE chat_messages ADD COLUMN mentions TEXT[] DEFAULT '{}'::text[];
  END IF;
END $$;

-- Enable Realtime for the new columns by ensuring the table is in the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;
