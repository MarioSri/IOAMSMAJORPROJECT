-- Reconcile 'submitted_by' column if it exists in the live database.
-- The application code has migrated to use 'submitter_id', but some databases
-- might have a legacy 'submitted_by' column with a NOT NULL constraint.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'documents' 
          AND column_name = 'submitted_by'
    ) THEN
        ALTER TABLE public.documents ALTER COLUMN submitted_by DROP NOT NULL;
        RAISE NOTICE 'Dropped NOT NULL constraint on documents.submitted_by';
    END IF;
END $$;
