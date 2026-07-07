-- ============================================
-- Calendar/Meetings Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER DEFAULT 60,
  location TEXT,
  type TEXT NOT NULL CHECK (type IN ('online', 'physical', 'hybrid')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'postponed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'academic',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern JSONB,
  attendees JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  department TEXT,
  documents TEXT[] DEFAULT '{}',
  meeting_links JSONB,
  notifications JSONB,
  approval_workflow JSONB,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(type);
CREATE INDEX IF NOT EXISTS idx_meetings_created ON meetings(created_at DESC);

-- Enable Row Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;

-- RLS Policies
CREATE POLICY "Users can view all meetings" ON meetings 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert meetings" ON meetings 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update meetings" ON meetings 
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own meetings" ON meetings 
  FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE meetings;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_meeting_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_meeting_timestamp
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_timestamp();

-- Verify table created
SELECT 'Meetings table created' as status, COUNT(*) as count FROM meetings;
