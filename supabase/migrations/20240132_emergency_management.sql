-- ============================================
-- Emergency Management Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Emergency Documents table
CREATE TABLE IF NOT EXISTS emergency_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  urgency_level TEXT NOT NULL CHECK (urgency_level IN ('medium', 'urgent', 'high', 'critical')),
  submitter_id TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  submitter_role TEXT,
  submitted_date TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'resolved', 'rejected', 'escalated')),
  document_types TEXT[] DEFAULT '{}',
  files JSONB DEFAULT '[]',
  recipients TEXT[] DEFAULT '{}',
  recipient_names TEXT[] DEFAULT '{}',
  auto_escalation BOOLEAN DEFAULT FALSE,
  escalation_timeout INTEGER,
  escalation_time_unit TEXT,
  cyclic_escalation BOOLEAN DEFAULT TRUE,
  bypass_mode BOOLEAN DEFAULT FALSE,
  use_smart_delivery BOOLEAN DEFAULT FALSE,
  escalation_level INTEGER DEFAULT 0,
  current_recipient_index INTEGER DEFAULT 0,
  escalation_stopped BOOLEAN DEFAULT FALSE,
  rejected_by TEXT,
  assignments JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Emergency Notifications table
CREATE TABLE IF NOT EXISTS emergency_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES emergency_documents(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'whatsapp', 'escalation')),
  title TEXT NOT NULL,
  message TEXT,
  urgency_level TEXT NOT NULL,
  delivered BOOLEAN DEFAULT TRUE,
  escalation_level INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Emergency Notification Settings table
CREATE TABLE IF NOT EXISTS emergency_notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES emergency_documents(id) ON DELETE CASCADE,
  use_profile_defaults BOOLEAN DEFAULT TRUE,
  override_for_emergency BOOLEAN DEFAULT FALSE,
  notification_strategy TEXT CHECK (notification_strategy IN ('recipient-based', 'document-based')),
  channels JSONB DEFAULT '[]',
  scheduling_options JSONB DEFAULT '{}',
  recipient_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Emergency Escalation Tracking table
CREATE TABLE IF NOT EXISTS emergency_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES emergency_documents(id) ON DELETE CASCADE,
  recipients TEXT[] DEFAULT '{}',
  original_recipients TEXT[] DEFAULT '{}',
  current_recipient_index INTEGER DEFAULT 0,
  escalation_level INTEGER DEFAULT 0,
  escalation_stopped BOOLEAN DEFAULT FALSE,
  cyclic_escalation BOOLEAN DEFAULT TRUE,
  timeout INTEGER,
  time_unit TEXT,
  last_escalation_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emergency_docs_submitter ON emergency_documents(submitter_id);
CREATE INDEX IF NOT EXISTS idx_emergency_docs_status ON emergency_documents(status);
CREATE INDEX IF NOT EXISTS idx_emergency_docs_urgency ON emergency_documents(urgency_level);
CREATE INDEX IF NOT EXISTS idx_emergency_docs_created ON emergency_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_document ON emergency_notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_recipient ON emergency_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_settings_document ON emergency_notification_settings(document_id);
CREATE INDEX IF NOT EXISTS idx_emergency_escalations_document ON emergency_escalations(document_id);

-- Enable Row Level Security
ALTER TABLE emergency_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_escalations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view emergency documents" ON emergency_documents;
DROP POLICY IF EXISTS "Users can insert emergency documents" ON emergency_documents;
DROP POLICY IF EXISTS "Users can update emergency documents" ON emergency_documents;
DROP POLICY IF EXISTS "Users can delete emergency documents" ON emergency_documents;

DROP POLICY IF EXISTS "Users can view notifications" ON emergency_notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON emergency_notifications;

DROP POLICY IF EXISTS "Users can view settings" ON emergency_notification_settings;
DROP POLICY IF EXISTS "Users can insert settings" ON emergency_notification_settings;
DROP POLICY IF EXISTS "Users can update settings" ON emergency_notification_settings;

DROP POLICY IF EXISTS "Users can view escalations" ON emergency_escalations;
DROP POLICY IF EXISTS "Users can insert escalations" ON emergency_escalations;
DROP POLICY IF EXISTS "Users can update escalations" ON emergency_escalations;

-- RLS Policies (permissive for now - adjust based on your auth setup)
CREATE POLICY "Users can view emergency documents" ON emergency_documents FOR SELECT USING (true);
CREATE POLICY "Users can insert emergency documents" ON emergency_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update emergency documents" ON emergency_documents FOR UPDATE USING (true);
CREATE POLICY "Users can delete emergency documents" ON emergency_documents FOR DELETE USING (true);

CREATE POLICY "Users can view notifications" ON emergency_notifications FOR SELECT USING (true);
CREATE POLICY "Users can insert notifications" ON emergency_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view settings" ON emergency_notification_settings FOR SELECT USING (true);
CREATE POLICY "Users can insert settings" ON emergency_notification_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update settings" ON emergency_notification_settings FOR UPDATE USING (true);

CREATE POLICY "Users can view escalations" ON emergency_escalations FOR SELECT USING (true);
CREATE POLICY "Users can insert escalations" ON emergency_escalations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update escalations" ON emergency_escalations FOR UPDATE USING (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE emergency_documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE emergency_notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_notification_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE emergency_notification_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_escalations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE emergency_escalations;
  END IF;
END $$;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_emergency_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at (drop first so re-runs don't fail)
DROP TRIGGER IF EXISTS update_emergency_document_timestamp ON emergency_documents;
CREATE TRIGGER update_emergency_document_timestamp
  BEFORE UPDATE ON emergency_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_timestamp();

DROP TRIGGER IF EXISTS update_emergency_settings_timestamp ON emergency_notification_settings;
CREATE TRIGGER update_emergency_settings_timestamp
  BEFORE UPDATE ON emergency_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_timestamp();

DROP TRIGGER IF EXISTS update_emergency_escalation_timestamp ON emergency_escalations;
CREATE TRIGGER update_emergency_escalation_timestamp
  BEFORE UPDATE ON emergency_escalations
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_timestamp();
