-- Persist the latest signed artifact references for each document.
-- The application stores one entry per signed output file, including its
-- Supabase Storage path and public/signed URL.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS signed_file_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.documents.signed_file_urls IS
  'Persisted signed document artifact references keyed by output file name.';
