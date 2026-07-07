# Implementation Plan - Remove Reverse Routing Mechanism

This plan outlines the steps to completely remove the "Reverse Routing" feature from the IAOMS application, covering the frontend UI, logic, type definitions, and database migrations.

## Affected Files
### Frontend UI
- `src/pages/ApprovalRouting.tsx` - Remove Reverse Routing card and descriptions.
- `src/components/workflow/WorkflowConfiguration.tsx` - Remove 'reverse' option from workflow type selection and tutorial logic.
- `src/hooks/useTutorial.ts` - Remove the Reverse Routing tutorial step.

### Frontend Logic & Services
- `src/services/WorkflowService.ts` - Remove logic that handles `routingType === 'reverse'`.
- `src/services/SupabaseBypassService.ts` - Update type definitions to remove 'reverse'.
- `src/services/ApprovalService.ts` - Remove logic for sequential/reverse routing where reverse specific logic exists.
- `src/pages/Approvals.tsx` - Remove references to 'reverse' in logic and comments.
- `src/components/documents/DocumentTracker.tsx` - Update type definitions.

### Type Definitions
- `src/types/workflow.ts` - Remove 'reverse' from `routing_type`.
- `src/types/blockchainAudit.ts` - Remove 'reverse' from comments or types if applicable.
- `backend/src/types/blockchainAudit.ts` - Match frontend type changes.

### Database & Migrations
- `supabase/migrations/20240133_approval_chain_bypass.sql` (Note: Existing migration, might need a new one to update CHECK constraints)
- `supabase/migrations/20240131_approval_center.sql` (Note: Existing migration)

## Steps

### 1. Frontend UI Cleanup
- [ ] **src/pages/ApprovalRouting.tsx**: Remove the UI card for Reverse Routing.
- [ ] **src/components/workflow/WorkflowConfiguration.tsx**: Remove 'reverse' from `SelectItem` and `workflowType` state.
- [ ] **src/hooks/useTutorial.ts**: Remove the `adv-approval-routing-reverse` tutorial step.

### 2. Frontend Logic & Service Cleanup
- [ ] **src/services/WorkflowService.ts**: Update `determineFirstStep` and `orderedRecipients` logic.
- [ ] **src/services/ApprovalService.ts**: Remove 'reverse' logic where it's combined with 'sequential'.
- [ ] **src/pages/Approvals.tsx**: Update comments and logic for 'reverse'.

### 3. Type Definitions Cleanup
- [ ] **src/types/workflow.ts**: Remove 'reverse' from union type.
- [ ] **src/types/blockchainAudit.ts**: Update types/comments.
- [ ] **backend/src/types/blockchainAudit.ts**: Update types/comments.
- [ ] **src/components/documents/DocumentTracker.tsx**: Update types.

### 4. Database Schema Update
- [ ] Create a new SQL migration to update the `CHECK` constraints on `routing_type` in `workflow_configurations` or related tables to remove 'reverse'.

### 5. Verification
- [ ] Verify that Sequential, Parallel, and Bi-Directional routing still work as expected.
- [ ] Run linting and type checks.
