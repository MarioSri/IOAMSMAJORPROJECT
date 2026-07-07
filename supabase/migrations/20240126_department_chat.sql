-- Chat Channels table
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  members TEXT[] NOT NULL DEFAULT '{}',
  admins TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_channels_created_by ON chat_channels(created_by);
CREATE INDEX idx_chat_channels_members ON chat_channels USING GIN(members);
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view channels they are members of" ON chat_channels FOR SELECT USING (true);
CREATE POLICY "Users can create channels" ON chat_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update channels they created" ON chat_channels FOR UPDATE USING (true);
CREATE POLICY "Users can delete channels they created" ON chat_channels FOR DELETE USING (true);

CREATE POLICY "Users can view messages in their channels" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Users can send messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own messages" ON chat_messages FOR UPDATE USING (true);
CREATE POLICY "Users can delete own messages" ON chat_messages FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
