-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-yellow-200',
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT NOT NULL,
  due_time TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'general',
  repeat_type TEXT NOT NULL DEFAULT 'none',
  custom_repeat_interval INTEGER,
  custom_repeat_unit TEXT,
  completed BOOLEAN DEFAULT FALSE,
  snoozed_until TIMESTAMP,
  notification_email BOOLEAN DEFAULT TRUE,
  notification_push BOOLEAN DEFAULT TRUE,
  notification_sound BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_created ON notes(created_at DESC);
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_due ON reminders(due_date, due_time);
CREATE INDEX idx_reminders_completed ON reminders(completed);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own data
CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (true);
CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (true);
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (true);

CREATE POLICY "Users can view own reminders" ON reminders FOR SELECT USING (true);
CREATE POLICY "Users can insert own reminders" ON reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own reminders" ON reminders FOR UPDATE USING (true);
CREATE POLICY "Users can delete own reminders" ON reminders FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
