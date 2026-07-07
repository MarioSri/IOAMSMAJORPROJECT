-- ============================================
-- Remove Reverse Routing Migration
-- ============================================

-- 1. Update any existing 'reverse' workflows to 'sequential' (safest fallback)
-- Check if the tables exist first to avoid errors during initial setup
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'document_workflows') THEN
        UPDATE document_workflows SET routing_type = 'sequential' WHERE routing_type = 'reverse';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'bypass_documents') THEN
        UPDATE bypass_documents SET routing_type = 'sequential' WHERE routing_type = 'reverse';
    END IF;
END $$;

-- 2. Update document_workflows constraint
DO $$
DECLARE
    wf_constraint_name TEXT;
BEGIN
    -- Only attempt if the table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'document_workflows') THEN
        -- Find the check constraint name for routing_type on document_workflows
        SELECT conname INTO wf_constraint_name
        FROM pg_constraint
        WHERE conrelid = 'document_workflows'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%reverse%'
        LIMIT 1;

        IF wf_constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE document_workflows DROP CONSTRAINT ' || wf_constraint_name;
        END IF;

        -- Re-add the constraint without 'reverse'
        ALTER TABLE document_workflows ADD CONSTRAINT document_workflows_routing_type_check 
            CHECK (routing_type IN ('sequential', 'parallel', 'bidirectional'));
    END IF;
END $$;

-- 3. Update bypass_documents constraint
DO $$
DECLARE
    bp_constraint_name TEXT;
BEGIN
    -- Only attempt if the table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'bypass_documents') THEN
        -- Find the check constraint name for routing_type on bypass_documents
        SELECT conname INTO bp_constraint_name
        FROM pg_constraint
        WHERE conrelid = 'bypass_documents'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%reverse%'
        LIMIT 1;

        IF bp_constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE bypass_documents DROP CONSTRAINT ' || bp_constraint_name;
        END IF;

        -- Re-add the constraint without 'reverse'
        ALTER TABLE bypass_documents ADD CONSTRAINT bypass_documents_routing_type_check 
            CHECK (routing_type IN ('sequential', 'parallel', 'bidirectional'));
    END IF;
END $$;
