-- ============================================
-- Add signature metadata columns to documents table
-- Replaces localStorage-based signature storage
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='signature_metadata') THEN
    ALTER TABLE documents ADD COLUMN signature_metadata JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='signed_by') THEN
    ALTER TABLE documents ADD COLUMN signed_by TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='last_signed_date') THEN
    ALTER TABLE documents ADD COLUMN last_signed_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='signature_count') THEN
    ALTER TABLE documents ADD COLUMN signature_count INTEGER DEFAULT 0;
  END IF;
END $$;
