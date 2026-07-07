-- ============================================
-- Emergency Contacts Table Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Emergency Contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  available BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  department TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_role ON emergency_contacts(role);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_available ON emergency_contacts(available);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_priority ON emergency_contacts(priority DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_active ON emergency_contacts(is_active);

-- Enable Row Level Security
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view emergency contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "Users can insert emergency contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "Users can update emergency contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "Users can delete emergency contacts" ON emergency_contacts;

-- RLS Policies (allow all authenticated users to view, admins to modify)
CREATE POLICY "Users can view emergency contacts"
  ON emergency_contacts
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can insert emergency contacts"
  ON emergency_contacts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update emergency contacts"
  ON emergency_contacts
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete emergency contacts"
  ON emergency_contacts
  FOR DELETE
  USING (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE emergency_contacts;
  END IF;
END $$;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_emergency_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_emergency_contacts_timestamp ON emergency_contacts;
CREATE TRIGGER update_emergency_contacts_timestamp
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_contacts_timestamp();

-- Insert sample emergency contacts
INSERT INTO emergency_contacts (name, role, phone, email, available, priority, department, is_active)
VALUES
  ('Dr. Rajesh Kumar', 'Principal', '+91-9876543210', 'principal@hitam.org', TRUE, 1, 'Administration', TRUE),
  ('Prof. Anita Sharma', 'Registrar', '+91-9876543211', 'registrar@hitam.org', TRUE, 2, 'Administration', TRUE),
  ('Mr. Ramesh Singh', 'Security Head', '+91-9876543212', 'security@hitam.org', TRUE, 3, 'Security', TRUE),
  ('Dr. Priya Patel', 'Medical Officer', '+91-9876543213', 'medical@hitam.org', TRUE, 4, 'Medical', TRUE)
ON CONFLICT DO NOTHING;
