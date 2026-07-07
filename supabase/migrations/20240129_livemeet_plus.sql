-- ============================================
-- LiveMeet+ Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- LiveMeet+ Requests table
CREATE TABLE IF NOT EXISTS live_meeting_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_title TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_user_name TEXT NOT NULL,
  target_user_role TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('immediate', 'urgent', 'normal')),
  meeting_format TEXT NOT NULL CHECK (meeting_format IN ('in_person', 'online', 'hybrid')),
  purpose TEXT NOT NULL,
  agenda TEXT,
  requested_time TIMESTAMP,
  scheduled_time TIMESTAMP,
  meeting_link TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'expired')),
  participants JSONB DEFAULT '[]',
  response TEXT,
  response_time TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_meeting_requester ON live_meeting_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_live_meeting_target ON live_meeting_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_live_meeting_status ON live_meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_live_meeting_urgency ON live_meeting_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_live_meeting_created ON live_meeting_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_meeting_expires ON live_meeting_requests(expires_at);

-- Enable Row Level Security
ALTER TABLE live_meeting_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can insert requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can update their requests" ON live_meeting_requests;
DROP POLICY IF EXISTS "Users can delete their requests" ON live_meeting_requests;

-- RLS Policies
CREATE POLICY "Users can view their requests" ON live_meeting_requests 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert requests" ON live_meeting_requests 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their requests" ON live_meeting_requests 
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their requests" ON live_meeting_requests 
  FOR DELETE USING (true);

-- Enable Realtime (idempotent — skip if already a member)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_meeting_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_meeting_requests;
  END IF;
END $$;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_live_meeting_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_live_meeting_timestamp ON live_meeting_requests;
CREATE TRIGGER update_live_meeting_timestamp
  BEFORE UPDATE ON live_meeting_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_live_meeting_timestamp();

-- Function to auto-expire old requests
CREATE OR REPLACE FUNCTION expire_old_live_meetings()
RETURNS void AS $$
BEGIN
  UPDATE live_meeting_requests
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Verify table created
SELECT 'LiveMeet+ Requests table created' as status, COUNT(*) as count FROM live_meeting_requests;
