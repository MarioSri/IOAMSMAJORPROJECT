-- =====================================================
-- IAOMS: Role Recipients Table Migration (FINAL)
-- Safe to re-run multiple times
-- Project: lyyuslwdibcscpdfzeww
-- =====================================================

-- -----------------------------
-- EXTENSIONS (required for UUID)
-- -----------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------
-- TABLE: role_recipients
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.role_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  department TEXT,
  branch TEXT,
  designation TEXT,
  employee_id TEXT UNIQUE,
  password TEXT, -- TEMPORARY (DO NOT USE FOR REAL AUTH)
  phone TEXT,
  bio TEXT,
  avatar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------
-- ENABLE ROW LEVEL SECURITY
-- -----------------------------
ALTER TABLE public.role_recipients ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- DROP POLICY IF EXISTS (SAFE)
-- -----------------------------
DROP POLICY IF EXISTS "Allow read access to active recipients"
ON public.role_recipients;

-- -----------------------------
-- CREATE READ POLICY
-- -----------------------------
CREATE POLICY "Allow read access to active recipients"
ON public.role_recipients
FOR SELECT
USING (is_active = TRUE);

-- -----------------------------
-- UPDATED_AT AUTO-UPDATE
-- -----------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_role_recipients_updated_at
ON public.role_recipients;

CREATE TRIGGER update_role_recipients_updated_at
BEFORE UPDATE ON public.role_recipients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (INITIAL IMPORT ONLY)
-- =====================================================
-- NOTE:
-- • Password column is TEMPORARY
-- • Supabase Auth should handle real authentication
-- =====================================================

INSERT INTO public.role_recipients
(name, email, role, department, branch, designation, employee_id, password, is_active)
VALUES
('Dr. S. Srinivasa Rao', '22e51a6917@hitam.org', 'Principal', 'Administration', 'Main', 'Principal', '22E51A6918', 'Principal@123', true),
('Mr. A. Ramesh', 'registrar@hitam.org', 'Registrar', 'Administration', 'Main', 'Registrar', '22E51A6920', 'Registrar@123', true),
('Dr. B. Venkateswara Rao', 'hod.cse@hitam.org', 'HOD', 'Computer Science', 'Main', 'Head of Department', '22E51A6921', 'HOD@123', true),
('Dr. C. Priyanka', 'programhead.cse@hitam.org', 'Program Department Head', 'Computer Science', 'Main', 'Program Department Head', '22E51A6922', 'ProgramHead@123', true),
('Mr. D. Naresh Kumar', 'employee@hitam.org', 'Employee', 'Administration', 'Main', 'Staff', '22E51A6923', 'Employee@123', true)
ON CONFLICT (email) DO NOTHING;