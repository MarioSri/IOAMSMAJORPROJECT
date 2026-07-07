/**
 * WorkflowRemovalService
 *
 * Handles conditional removal of tracked documents:
 *  - COMPLETED workflows (approved / partially-approved) → Archive only
 *    Sets tracking_visible = false and workflow_state = 'archived'.
 *    ALL historical data (approvals, chat, analytics, LiveMeet) is preserved.
 *
 *  - IN-PROGRESS workflows (pending / submitted / rejected) → Hard delete
 *    Removes all linked application data in a safe, ordered sequence.
 *
 * ⚠️  BLOCKCHAIN AUDIT LOG ENTRIES ARE NEVER DELETED — this is immutable compliance data.
 *
 * Prerequisites (Supabase migration):
 *   supabase/migrations/20260401_tracking_archive_columns.sql
 *   Adds: documents.tracking_visible BOOLEAN DEFAULT true
 *         documents.workflow_state   TEXT    DEFAULT 'active'
 */

import { supabase } from '@/lib/supabase';

export type RemoveAction = 'archived' | 'deleted';

export interface RemoveResult {
  action: RemoveAction;
  success: boolean;
  error?: string;
}

/** Minimal shape returned from the documents fetch. */
interface DocumentRow {
  id: string;
  status: string;
}

/** Minimal shape returned from the chat_channels fetch. */
interface ChatChannelRow {
  id: string;
}

/** Statuses that indicate the workflow is fully resolved — archive instead of delete. */
const COMPLETED_STATUSES = new Set(['approved', 'partially-approved', 'rejected']);

class WorkflowRemovalService {
  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Main entry point: fetches the document status and dispatches to
   * archiveWorkflow() or hardDeleteWorkflow() accordingly.
   */
  async removeDocument(documentId: string): Promise<RemoveResult> {
    // 1. Fetch the current document status
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('id, status')
      .eq('id', documentId)
      .maybeSingle<DocumentRow>();

    if (fetchError) {
      console.error('[WorkflowRemovalService] Failed to fetch document:', fetchError);
      return { action: 'deleted', success: false, error: fetchError.message };
    }

    if (!doc) {
      // Row already gone — treat as success
      return { action: 'deleted', success: true };
    }

    // 2. Dispatch based on workflow state  
    if (COMPLETED_STATUSES.has(doc.status)) {
      return this.archiveWorkflow(documentId);
    }
    return this.hardDeleteWorkflow(documentId);
  }

  // ─── Archive (completed workflows) ─────────────────────────────────────────

  /**
   * Soft-removes a completed workflow:
   * Sets tracking_visible = false and workflow_state = 'archived'.
   * Does NOT delete any historical records.
   */
  async archiveWorkflow(documentId: string): Promise<RemoveResult> {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          tracking_visible: false,
          workflow_state: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) throw error;

      console.log(`[WorkflowRemovalService] Archived document ${documentId}`);
      return { action: 'archived', success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WorkflowRemovalService] archiveWorkflow failed:', err);
      return { action: 'archived', success: false, error: msg };
    }
  }

  // ─── Hard Delete (in-progress workflows) ───────────────────────────────────

  /**
   * Permanently removes all application data linked to an in-progress workflow.
   * The `documents` row is deleted last to allow FK cascades to fire.
   *
   * Deletion order (safe, respects FK dependencies):
   *  1. live_meeting_requests  — linked by document_id
   *  2. approval_comments      — linked by document_id (ON DELETE CASCADE on document_approvals)
   *  3. document_approvals     — linked by document_id
   *  4. workflow_steps         — linked via document_workflows (ON DELETE CASCADE)
   *  5. document_workflows     — linked by document_id
   *  6. chat_messages          — linked by channel_id (from chat_channels)
   *  7. chat_channels          — linked by document_id
   *  8. analytics_metrics      — linked via JSONB metadata->>'document_id'
   *  9. documents              — the root record (triggers remaining FK cascades)
   *
   * ❌  blockchain_audit_log  — NEVER deleted
   */
  async hardDeleteWorkflow(documentId: string): Promise<RemoveResult> {
    const errors: string[] = [];

    // ── Step 1: LiveMeet+ requests ──────────────────────────────────────────
    try {
      const { error } = await supabase
        .from('live_meeting_requests')
        .delete()
        .eq('document_id', documentId);
      if (error) throw error;
    } catch (err: unknown) {
      errors.push(`live_meeting_requests: ${err instanceof Error ? err.message : String(err)}`);
      console.warn('[WorkflowRemovalService] Step 1 (live_meeting_requests):', err instanceof Error ? err.message : err);
    }

    // ── Step 2: Approval comments ───────────────────────────────────────────
    try {
      const { error } = await supabase
        .from('approval_comments')
        .delete()
        .eq('document_id', documentId);
      if (error) throw error;
    } catch (err: unknown) {
      errors.push(`approval_comments: ${err instanceof Error ? err.message : String(err)}`);
      console.warn('[WorkflowRemovalService] Step 2 (approval_comments):', err instanceof Error ? err.message : err);
    }

    // ── Step 3: Document approvals ──────────────────────────────────────────
    try {
      const { error } = await supabase
        .from('document_approvals')
        .delete()
        .eq('document_id', documentId);
      if (error) throw error;
    } catch (err: unknown) {
      errors.push(`document_approvals: ${err instanceof Error ? err.message : String(err)}`);
      console.warn('[WorkflowRemovalService] Step 3 (document_approvals):', err instanceof Error ? err.message : err);
    }

    // ── Step 4 & 5: Workflow steps → document_workflows ────────────────────
    // workflow_steps has ON DELETE CASCADE via document_workflows, so deleting
    // the workflow also removes its steps automatically.
    try {
      const { error } = await supabase
        .from('document_workflows')
        .delete()
        .eq('document_id', documentId);
      if (error) throw error;
    } catch (err: unknown) {
      errors.push(`document_workflows: ${err instanceof Error ? err.message : String(err)}`);
      console.warn('[WorkflowRemovalService] Step 4-5 (document_workflows):', err instanceof Error ? err.message : err);
    }

    // ── Step 6 & 7: Chat messages → chat channels ───────────────────────────
    // Fetch the channel first, then delete messages, then the channel.
    try {
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('document_id', documentId)
        .maybeSingle<ChatChannelRow>();

      if (channel?.id) {
        // Delete messages first (in case no FK cascade is configured)
        await supabase
          .from('chat_messages')
          .delete()
          .eq('channel_id', channel.id);

        const { error: chanErr } = await supabase
          .from('chat_channels')
          .delete()
          .eq('id', channel.id);

        if (chanErr) throw chanErr;
      }
    } catch (err: unknown) {
      errors.push(`chat: ${err instanceof Error ? err.message : String(err)}`);
      console.warn('[WorkflowRemovalService] Step 6-7 (chat):', err instanceof Error ? err.message : err);
    }

    // ── Step 8: Analytics metrics ───────────────────────────────────────────
    // Records store document_id in a JSONB 'metadata' column.
    // Wrapped in try/catch — harmless if the column path differs.
    try {
      const { error } = await supabase
        .from('analytics_metrics')
        .delete()
        .eq('metadata->>document_id', documentId);
      if (error) throw error;
    } catch (err: unknown) {
      // Non-fatal — analytics deletion is best-effort
      console.warn('[WorkflowRemovalService] Step 8 (analytics_metrics, non-fatal):', err instanceof Error ? err.message : err);
    }

    // ── Step 9: Delete the root document record ─────────────────────────────
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;
    } catch (err: unknown) {
      errors.push(`documents: ${err instanceof Error ? err.message : String(err)}`);
      console.error('[WorkflowRemovalService] Step 9 CRITICAL (documents):', err instanceof Error ? err.message : err);
      return { action: 'deleted', success: false, error: errors.join('; ') };
    }

    if (errors.length > 0) {
      console.warn(
        `[WorkflowRemovalService] hardDeleteWorkflow completed with partial errors for ${documentId}:`,
        errors
      );
    } else {
      console.log(`[WorkflowRemovalService] Hard-deleted workflow for document ${documentId}`);
    }

    // Return success as long as the root document was deleted
    return { action: 'deleted', success: true };
  }
}

export const workflowRemovalService = new WorkflowRemovalService();
