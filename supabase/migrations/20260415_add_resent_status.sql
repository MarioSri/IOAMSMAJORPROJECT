-- Add resent_at column to workflow_steps table for tracking resubmissions
-- This supports the bi-directional routing selective resend feature

-- Add resent_at timestamp column
ALTER TABLE workflow_steps 
ADD COLUMN IF NOT EXISTS resent_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN workflow_steps.resent_at IS 'Timestamp when a bypassed step was resent to the recipient';

-- Create index for performance when querying resent steps
CREATE INDEX IF NOT EXISTS idx_workflow_steps_resent_at 
ON workflow_steps(resent_at) 
WHERE resent_at IS NOT NULL;

-- Update existing 'resent' status steps to have current timestamp (if any exist)
UPDATE workflow_steps 
SET resent_at = updated_at 
WHERE status = 'resent' AND resent_at IS NULL;
