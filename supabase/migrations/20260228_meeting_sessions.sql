-- ============================================
-- Meeting Sessions & Participants Migration
-- Tracks active video sessions and who joins
-- Run this in Supabase SQL Editor
-- ============================================

-- Meeting Sessions table (active video call sessions)
CREATE TABLE IF NOT EXISTS meeting_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  host_user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('iaoms-meet')),
  join_url TEXT NOT NULL,
  start_url TEXT,
  password TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Meeting Participants table (who joined each session)
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'participant')),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_meeting_id ON meeting_sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON meeting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_host ON meeting_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON meeting_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants(user_id);

-- Enable Row Level Security
ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Users can insert sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Users can update sessions" ON meeting_sessions;
DROP POLICY IF EXISTS "Users can view all participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON meeting_participants;

-- RLS Policies for meeting_sessions
CREATE POLICY "Users can view all sessions" ON meeting_sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert sessions" ON meeting_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update sessions" ON meeting_sessions
  FOR UPDATE USING (true);

-- RLS Policies for meeting_participants
CREATE POLICY "Users can view all participants" ON meeting_participants
  FOR SELECT USING (true);

CREATE POLICY "Users can insert participants" ON meeting_participants
  FOR INSERT WITH CHECK (true);

-- Enable Realtime (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.pubname = 'supabase_realtime'
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE c.relname = 'meeting_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.pubname = 'supabase_realtime'
    JOIN pg_class c ON c.oid = pr.prrelid
    WHERE c.relname = 'meeting_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_participants;
  END IF;
END $$;

-- Verify tables created
SELECT 'meeting_sessions table created' as status, COUNT(*) as count FROM meeting_sessions;
SELECT 'meeting_participants table created' as status, COUNT(*) as count FROM meeting_participants;
