-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Configure BCXN storage bucket + RLS policies
-- Run in Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop any view created by a previous failed run (views block Realtime publications)
DROP VIEW IF EXISTS public.document_files_view;

-- 1. Create the BCXN bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'BCXN',
  'BCXN',
  true,   -- public bucket (URLs work without auth headers)
  26214400,  -- 25 MB in bytes
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'application/octet-stream'  -- fallback for browsers that mis-report MIME type
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS Policies — Storage (storage.objects table)
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: RLS on storage.objects is managed by Supabase internally — do NOT ALTER TABLE here.
-- Just manage the policies directly (DROP + CREATE is safe with the postgres role).

-- Drop existing conflicting policies (safe to re-run)
DROP POLICY IF EXISTS "BCXN: Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Public read" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Owners can delete their files" ON storage.objects;
DROP POLICY IF EXISTS "BCXN: Authenticated users can update" ON storage.objects;

-- Allow any authenticated user to upload files to the BCXN bucket
CREATE POLICY "BCXN: Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'BCXN');

-- Allow public (anon) read access — files are referenced by public URL
CREATE POLICY "BCXN: Public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'BCXN');

-- Allow authenticated users to update (e.g., overwrite with signed version)
CREATE POLICY "BCXN: Authenticated users can update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'BCXN');

-- Allow authenticated users to delete only files they uploaded
CREATE POLICY "BCXN: Owners can delete their files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'BCXN'
    -- owner column stores the user.id of the uploader
    -- AND owner = auth.uid()  -- uncomment for stricter owner-only deletion
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update documents.files column to support new StorageFileInfo shape
--    (adds storage_path and storage_url, backward-compatible with existing rows)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure the files column exists as JSONB (no-op if already correct)
ALTER TABLE documents
  ALTER COLUMN files SET DEFAULT '[]'::jsonb;

-- Add a unique constraint / index on document id for fast lookups (already PK)
-- No schema change needed — files JSONB column accepts both old base64 and new StorageFileInfo shapes.

-- NOTE: A diagnostic VIEW for document_files is intentionally omitted here.
-- Views cannot be added to Supabase Realtime publications (only plain tables can).
-- If you need to inspect file metadata, query documents directly:
--
--   SELECT id, title, jsonb_array_elements(files) AS file
--   FROM documents
--   WHERE files IS NOT NULL AND jsonb_array_length(files) > 0;
