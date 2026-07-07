-- Fix RLS policies for notes and reminders tables.
-- Previous policies used USING (true), allowing any authenticated user to
-- read/write all rows. These replacements enforce per-user isolation via
-- auth.uid()::text = user_id.

-- ============ NOTES ============

DROP POLICY IF EXISTS "Users can view own notes"   ON notes;
DROP POLICY IF EXISTS "Users can insert own notes"  ON notes;
DROP POLICY IF EXISTS "Users can update own notes"  ON notes;
DROP POLICY IF EXISTS "Users can delete own notes"  ON notes;

CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============ REMINDERS ============

DROP POLICY IF EXISTS "Users can view own reminders"   ON reminders;
DROP POLICY IF EXISTS "Users can insert own reminders"  ON reminders;
DROP POLICY IF EXISTS "Users can update own reminders"  ON reminders;
DROP POLICY IF EXISTS "Users can delete own reminders"  ON reminders;

CREATE POLICY "Users can view own reminders"
  ON reminders FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  USING (auth.uid()::text = user_id);
