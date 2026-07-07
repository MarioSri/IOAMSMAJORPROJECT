import { supabase } from '@/lib/supabase';
import { NotificationDispatchService } from './NotificationDispatchService';
import { reportBlockchainEvent } from './BlockchainAuditService';

/** Strip newlines and other control characters to prevent log injection (CWE-117). */
function sanitizeLog(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\t\u0085\u2028\u2029]/g, ' ');
}

class ApprovalService {
  // Create document with workflow
  async createDocument(doc: any): Promise<string> {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: doc.title,
        description: doc.description,
        type: doc.type,
        submitter_id: doc.submitterId,
        submitter_name: doc.submitter,
        submitted_date: doc.submittedDate || new Date().toISOString().split('T')[0],
        status: 'pending',
        priority: doc.priority || 'medium',
        is_emergency: doc.isEmergency || false,
        files: doc.files || [],
        file_assignments: doc.fileAssignments || {},
        recipient_ids: doc.recipientIds || [],
        recipients: doc.recipients || [],
      })
      .select()
      .single();

    if (docError) throw docError;

    // Create workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('document_workflows')
      .insert({
        document_id: document.id,
        routing_type: doc.routingType || 'sequential',
        is_parallel: doc.isParallel || false,
        has_bypass: doc.hasBypass || false,
        current_step: 'Submission',
        progress: 0,
        source: doc.source,
      })
      .select()
      .single();

    if (workflowError) throw workflowError;

    // Create workflow steps
    if (doc.workflow?.steps) {
      const steps = doc.workflow.steps.map((step: any, index: number) => {
        const assigneeId: string | undefined = step.assigneeId;
        // Reject steps without a UUID assigneeId — storing a name string as assignee_id
        // produces rows that can never match user.recipientId and causes cards to vanish.
        if (!assigneeId) {
          throw new Error(
            `[ApprovalService] Workflow step "${step.name}" is missing assigneeId. ` +
            `Ensure RecipientSelector passes role_recipients UUIDs, not display names.`
          );
        }
        return {
          workflow_id: workflow.id,
          step_order: index,
          name: step.name,
          assignee: step.assignee,
          assignee_id: assigneeId,
          status: step.status || (doc.isParallel ? 'current' : (index === 0 ? 'current' : 'pending')),
        };
      });

      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .insert(steps);

      if (stepsError) throw stepsError;
    }

    reportBlockchainEvent({
      documentId: document.id,
      action: 'SUBMITTED',
      workflowStep: 'Submission',
      routingType: (doc.routingType as string | undefined)?.toUpperCase() ?? null,
      nextStep: doc.workflow?.steps?.[0]?.name ?? null,
    }).catch(() => {});
    return document.id;
  }

  // Approve document
  async approveDocument(documentId: string, approverId: string, approverName: string, comment?: string, recipientId?: string): Promise<void> {
    // 1. Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('document_workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('document_id', documentId)
      .single();

    if (workflowError) throw workflowError;

    // 2. Find current user's step - match by recipientId (role_recipients UUID) or approverId
    const currentStep = workflow.steps.find(
      (s: any) => (s.assignee_id === (recipientId || approverId)) && s.status === 'current'
    );

    if (!currentStep) throw new Error('No current step found for user');

    // 3. Record approval
    const { error: approvalError } = await supabase
      .from('document_approvals')
      .insert({
        document_id: documentId,
        approver_id: approverId,
        approver_name: approverName,
        action: 'approved',
        comment: comment || 'Approved',
      });

    if (approvalError) throw approvalError;

    // 4. Update current step
    await supabase
      .from('workflow_steps')
      .update({
        status: 'completed',
        completed_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', currentStep.id);

    // 5. Advance workflow — routing-type-aware
    const routingType: string = workflow.routing_type || 'sequential';
    const isParallelLike = routingType === 'parallel' || routingType === 'bidirectional' || workflow.is_parallel;

    if (isParallelLike) {
      // Parallel / Bidirectional: all steps start as 'current'.
      // Check if ALL remaining current steps are now resolved (completed or bypassed).
      const unresolvedSteps = workflow.steps.filter(
        (s: any) => s.id !== currentStep.id && s.status === 'current'
      );
      const completedCount = workflow.steps.filter((s: any) => s.status === 'completed').length + 1;
      const bypassedCount = workflow.steps.filter((s: any) => s.status === 'bypassed').length;
      const progress = Math.round((completedCount / workflow.steps.length) * 100);
      const isComplete = unresolvedSteps.length === 0;

      if (isComplete) {
        const finalStatus = bypassedCount > 0 ? 'partially-approved' : 'approved';
        await supabase
          .from('documents')
          .update({ status: finalStatus })
          .eq('id', documentId);

        await supabase
          .from('document_workflows')
          .update({
            current_step: bypassedCount > 0 ? 'Complete (with bypasses)' : 'Complete',
            progress: 100,
          })
          .eq('id', workflow.id);

        // Notify the submitter that their document has been approved
        const { data: docRow } = await supabase.from('documents').select('title, submitter_id').eq('id', documentId).single();
        if (docRow?.submitter_id && docRow.submitter_id !== 'unknown') {
          NotificationDispatchService.dispatch({
            userIds: [docRow.submitter_id],
            title: `Document ${finalStatus === 'approved' ? 'Approved' : 'Partially Approved'}: ${docRow.title}`,
            message: `Your document "${docRow.title}" has been ${finalStatus === 'approved' ? 'approved' : 'approved with some bypasses'} by all reviewers.`,
            type: 'approval',
            action_url: `${window.location.origin}/approvals`,
            document_id: documentId,
            emailParams: {
              type: 'approval',
              params: { docTitle: docRow.title, status: 'approved', approvalUrl: `${window.location.origin}/approvals` },
            },
            pushPayload: { title: 'Document Approved', body: `"${docRow.title}" has been approved`, url: `${window.location.origin}/approvals` },
          }).catch(() => { /* non-blocking */ });
        }
        reportBlockchainEvent({
          documentId,
          action: 'APPROVED',
          actorId: approverId,
          workflowStep: currentStep.name,
          routingType: (workflow.routing_type as string)?.toUpperCase() ?? null,
          previousStep: currentStep.name,
          comment: comment ?? null,
        }).catch(() => {});
      } else {
        await supabase
          .from('document_workflows')
          .update({ progress })
          .eq('id', workflow.id);
      }
    } else {
      // Sequential: advance to next step_order
      const nextStepIndex = currentStep.step_order + 1;
      const nextStep = workflow.steps.find((s: any) => s.step_order === nextStepIndex);

      if (nextStep) {
        await supabase
          .from('workflow_steps')
          .update({ status: 'current' })
          .eq('id', nextStep.id);

        const completedSteps = workflow.steps.filter((s: any) => s.status === 'completed').length + 1;
        const progress = Math.round((completedSteps / workflow.steps.length) * 100);

        await supabase
          .from('document_workflows')
          .update({
            current_step: nextStep.name,
            progress,
          })
          .eq('id', workflow.id);

        // Notify next step's assignee that it's their turn
        const { data: docRow } = await supabase.from('documents').select('title').eq('id', documentId).single();
        if (docRow?.title && nextStep.assignee_id) {
          NotificationDispatchService.dispatch({
            recipientRowIds: [nextStep.assignee_id],
            title: `Approval Required: ${docRow.title}`,
            message: `The document "${docRow.title}" has been passed to you for review.`,
            type: 'routing',
            action_url: `${window.location.origin}/approvals`,
            document_id: documentId,
            emailParams: {
              type: 'routing',
              params: {
                docTitle: docRow.title,
                routingType: workflow.routing_type || 'sequential',
                action: 'Awaiting your approval',
              },
            },
            pushPayload: { title: 'Approval Needed', body: `"${docRow.title}" is waiting for your review`, url: `${window.location.origin}/approvals` },
          }).catch(() => { /* non-blocking */ });
        }
      } else {
        // Workflow complete
        await supabase
          .from('documents')
          .update({ status: 'approved' })
          .eq('id', documentId);

        await supabase
          .from('document_workflows')
          .update({
            current_step: 'Complete',
            progress: 100,
          })
          .eq('id', workflow.id);

        // Notify submitter that their document is fully approved
        const { data: docRow } = await supabase.from('documents').select('title, submitter_id').eq('id', documentId).single();
        if (docRow?.submitter_id && docRow.submitter_id !== 'unknown') {
          NotificationDispatchService.dispatch({
            userIds: [docRow.submitter_id],
            title: `Document Approved: ${docRow.title}`,
            message: `Your document "${docRow.title}" has been fully approved.`,
            type: 'approval',
            action_url: `${window.location.origin}/approvals`,
            document_id: documentId,
            emailParams: {
              type: 'approval',
              params: { docTitle: docRow.title, status: 'approved', approvalUrl: `${window.location.origin}/approvals` },
            },
            pushPayload: { title: 'Document Approved', body: `"${docRow.title}" has been approved`, url: `${window.location.origin}/approvals` },
          }).catch(() => { /* non-blocking */ });
        }
        reportBlockchainEvent({
          documentId,
          action: 'APPROVED',
          actorId: approverId,
          workflowStep: currentStep.name,
          routingType: (workflow.routing_type as string)?.toUpperCase() ?? null,
          previousStep: currentStep.name,
          comment: comment ?? null,
        }).catch(() => {});
      }
    }
  }

  // Reject document
  async rejectDocument(documentId: string, approverId: string, approverName: string, reason: string, recipientId?: string): Promise<void> {
    // 1. Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('document_workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('document_id', documentId)
      .single();

    if (workflowError) throw workflowError;

    // 2. Find current user's step - match by recipientId (role_recipients UUID) or approverId
    const currentStep = workflow.steps.find(
      (s: any) => (s.assignee_id === (recipientId || approverId)) && s.status === 'current'
    );

    if (!currentStep) throw new Error('No current step found for user');

    // 3. Record rejection
    const { error: approvalError } = await supabase
      .from('document_approvals')
      .insert({
        document_id: documentId,
        approver_id: approverId,
        approver_name: approverName,
        action: workflow.has_bypass ? 'bypassed' : 'rejected',
        comment: reason,
      });

    if (approvalError) throw approvalError;

    // 4. Handle bypass or rejection — routing-type-aware
    const routingType: string = workflow.routing_type || 'sequential';
    const isParallelLike = routingType === 'parallel' || routingType === 'bidirectional' || workflow.is_parallel;

    if (workflow.has_bypass) {
      // Bypass: mark step as bypassed
      await supabase
        .from('workflow_steps')
        .update({
          status: 'bypassed',
          rejected_date: new Date().toISOString().split('T')[0],
          rejected_by: approverName,
          bypass_reason: reason,
          bypassed_at: new Date().toISOString(),
        })
        .eq('id', currentStep.id);

      // Populate bypassed_recipients array on the workflow so the UI can
      // detect bypassed recipients and show Resend / Re-Upload buttons.
      const existingBypassed: string[] = Array.isArray(workflow.bypassed_recipients)
        ? workflow.bypassed_recipients
        : [];
      const updatedBypassed = [...existingBypassed, currentStep.assignee_id];

      if (isParallelLike) {
        // Parallel / Bidirectional: do NOT advance to next step_order.
        // Check if all current steps are now resolved (completed or bypassed).
        const unresolvedSteps = workflow.steps.filter(
          (s: any) => s.id !== currentStep.id && (s.status === 'current' || s.status === 'resent')
        );
        const completedCount = workflow.steps.filter((s: any) => s.status === 'completed').length;
        const bypassedCount = workflow.steps.filter((s: any) => s.status === 'bypassed').length + 1;
        const progress = Math.round(((completedCount + bypassedCount) / workflow.steps.length) * 100);
        const isComplete = unresolvedSteps.length === 0;

        if (isComplete) {
          await supabase
            .from('document_workflows')
            .update({
              current_step: 'Complete (with bypasses)',
              progress: 100,
              bypassed_recipients: updatedBypassed,
            })
            .eq('document_id', documentId);

          await supabase
            .from('documents')
            .update({ status: 'partially-approved' })
            .eq('id', documentId);
        } else {
          await supabase
            .from('document_workflows')
            .update({
              progress,
              bypassed_recipients: updatedBypassed,
            })
            .eq('document_id', documentId);
        }
      } else {
        // Sequential: bypass step and advance to next step_order
        const nextStepIndex = currentStep.step_order + 1;
        const nextStep = workflow.steps.find((s: any) => s.step_order === nextStepIndex);

        if (nextStep) {
          await supabase
            .from('workflow_steps')
            .update({ status: 'current' })
            .eq('id', nextStep.id);

          const completedCount = workflow.steps.filter((s: any) => s.status === 'completed').length;
          const bypassedCount = workflow.steps.filter((s: any) => s.status === 'bypassed').length + 1;
          const progress = Math.round(((completedCount + bypassedCount) / workflow.steps.length) * 100);

          await supabase
            .from('document_workflows')
            .update({
              current_step: nextStep.name,
              progress,
              bypassed_recipients: updatedBypassed,
            })
            .eq('document_id', documentId);
        } else {
          // Calculate progress for completion
          const completedCount = workflow.steps.filter((s: any) => s.status === 'completed').length;
          const bypassedCount = workflow.steps.filter((s: any) => s.status === 'bypassed').length + 1;
          const progress = Math.round(((completedCount + bypassedCount) / Math.max(workflow.steps.length, 1)) * 100);

          await supabase
            .from('document_workflows')
            .update({
              current_step: 'Complete (with bypasses)',
              progress,
              bypassed_recipients: updatedBypassed,
            })
            .eq('document_id', documentId);

          await supabase
            .from('documents')
            .update({ status: 'partially-approved' })
            .eq('id', documentId);
        }
      }
    } else {
      // No bypass: reject and stop workflow
      await supabase
        .from('workflow_steps')
        .update({
          status: 'rejected',
          rejected_date: new Date().toISOString().split('T')[0],
          rejected_by: approverName,
          bypass_reason: reason,
        })
        .eq('id', currentStep.id);

      // Cancel pending steps
      await supabase
        .from('workflow_steps')
        .update({ status: 'cancelled' })
        .eq('workflow_id', workflow.id)
        .eq('status', 'pending');

      // Calculate progress: completed steps + the step just rejected
      const completedSteps = (workflow.steps || []).filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length + 1;
      const progress = Math.round((completedSteps / Math.max(workflow.steps?.length || 0, 1)) * 100);

      // Update workflow BEFORE document status to avoid race conditions in UI real-time updates
      await supabase
        .from('document_workflows')
        .update({ 
          current_step: 'Rejected',
          progress,
        })
        .eq('document_id', documentId);

      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId);

      // Soft-mark any previously shared comments as orphaned.
      // The chain has stopped — there are no next recipients to receive them.
      // Soft-mark (not delete) preserves the audit trail.
      await supabase
        .from('approval_comments')
        .update({ shared_for: 'orphaned' })
        .eq('document_id', documentId)
        .eq('is_shared', true);

      // Notify submitter of rejection
      const { data: docRow } = await supabase.from('documents').select('title, submitter_id').eq('id', documentId).single();
      if (docRow?.submitter_id && docRow.submitter_id !== 'unknown') {
        NotificationDispatchService.dispatch({
          userIds: [docRow.submitter_id],
          title: `Document Rejected: ${docRow.title}`,
          message: `Your document "${docRow.title}" was rejected by ${approverName}. Reason: ${reason}`,
          type: 'approval',
          urgent: true,
          action_url: `${window.location.origin}/approvals`,
          document_id: documentId,
          emailParams: {
            type: 'approval',
            params: { docTitle: docRow.title, status: 'rejected', reason, approvalUrl: `${window.location.origin}/approvals` },
          },
          pushPayload: { title: 'Document Rejected', body: `"${docRow.title}" was rejected`, url: `${window.location.origin}/approvals` },
        }).catch(() => { /* non-blocking */ });
      }
    }
    // Blockchain audit — non-blocking, never throws
    reportBlockchainEvent({
      documentId,
      action: workflow.has_bypass ? 'BYPASSED' : 'REJECTED',
      actorId: approverId,
      workflowStep: currentStep.name,
      routingType: (workflow.routing_type as string)?.toUpperCase() ?? null,
      previousStep: currentStep.name,
      comment: reason,
      ...(workflow.has_bypass ? {
        bypassReason: reason,
        bypassedRole: currentStep.assignee ?? currentStep.name,
        authorizedBy: approverName,
      } : {}),
    }).catch(() => {});
  }

  // Get pending approvals for user
  // Uses recipientId (role_recipients UUID) that matches workflow_steps.assignee_id
  async getPendingApprovals(userId: string, userRole: string, recipientId?: string): Promise<any[]> {
    // If no recipientId was provided, attempt to resolve it from role_recipients
    let resolvedRecipientId = recipientId;
    if (!resolvedRecipientId) {
      try {
        const { data: recipientRow } = await supabase
          .from('role_recipients')
          .select('id')
          .eq('supabase_uid', userId)
          .maybeSingle();
        if (recipientRow) {
          resolvedRecipientId = recipientRow.id;
          console.log('[ApprovalService] Resolved recipientId from role_recipients:', sanitizeLog(resolvedRecipientId));
        }
      } catch (e) {
        console.warn('[ApprovalService] Could not resolve recipientId from role_recipients:', e);
      }
    }

    // Server-side filter: only fetch workflows where the document is still pending
    const query = supabase
      .from('document_workflows')
      .select(`
        *,
        document:documents!inner(*),
        steps:workflow_steps(*)
      `)
      .in('document.status', ['pending', 'partially-approved'])
      .order('created_at', { ascending: false });

    const { data: workflows, error } = await query;

    if (error) {
      console.error('Error fetching pending approvals:', error);
      return [];
    }

    console.log(
      `[ApprovalService] getPendingApprovals: fetched ${(workflows || []).length} workflows,` +
      ` resolvedRecipientId=${sanitizeLog(resolvedRecipientId)}, userId=${sanitizeLog(userId)}`
    );

    if (!resolvedRecipientId) {
      console.warn(
        '[ApprovalService] resolvedRecipientId is undefined — approval cards will only match ' +
        'workflow steps whose assignee_id equals the Supabase Auth UUID (legacy fallback). ' +
        'Check that role_recipients.supabase_uid is populated and login returns recipientId.'
      );
    }

    // Client-side filter for user's assigned steps using recipientId (role_recipients UUID)
    // This matches against workflow_steps.assignee_id which now stores role_recipients UUIDs
    const filtered = (workflows || []).filter((workflow: any) => {
      const userStep = workflow.steps.find(
        (s: any) => {
          // Primary match: recipientId (role_recipients UUID) matches assignee_id
          const idMatch = resolvedRecipientId && s.assignee_id === resolvedRecipientId;
          // Fallback: direct userId match (for backward compatibility with auth UUID)
          const authIdMatch = s.assignee_id === userId;
          // Routing-type-aware status check:
          // For parallel/bidirectional, all steps are 'current' from the start.
          // For sequential, only the active step is 'current'.
          // In both cases, checking for 'current' is sufficient since the service
          // layer now correctly sets initial statuses based on routing_type.
          const statusOk = s.status === 'current';
          const matched = (idMatch || authIdMatch) && statusOk;

          // Always log step-level matching so card-visibility issues are diagnosable
          console.debug(
            `[ApprovalService] Step "${sanitizeLog(s.name)}": assignee_id=${sanitizeLog(s.assignee_id)}, ` +
            `status=${sanitizeLog(s.status)}, idMatch=${!!idMatch}, authIdMatch=${authIdMatch}, ` +
            `statusOk=${statusOk}, matched=${matched}`
          );

          return matched;
        }
      );

      console.debug(
        `[ApprovalService] Workflow ${sanitizeLog(workflow.document?.id ?? workflow.id)}: ` +
        `steps=${workflow.steps.length}, userStepFound=${!!userStep}`
      );

      return userStep !== undefined;
    });

    console.log(
      `[ApprovalService] getPendingApprovals result: ${filtered.length} of ` +
      `${(workflows || []).length} workflows matched for user`
    );

    return filtered;
  }

  // Get approval history for user
  async getApprovalHistory(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('document_approvals')
      .select(`
        *,
        document:documents(*)
      `)
      .eq('approver_id', userId)
      .order('action_date', { ascending: false });

    if (error) {
      console.error('Error fetching approval history:', sanitizeLog(error instanceof Error ? error.message : String(error)));
      return [];
    }

    return data || [];
  }

  // Add comment
  async addComment(documentId: string, authorId: string, authorName: string, message: string, isShared: boolean = false, sharedFor?: string): Promise<void> {
    const { error } = await supabase
      .from('approval_comments')
      .insert({
        document_id: documentId,
        author_id: authorId,
        author_name: authorName,
        message,
        is_shared: isShared,
        shared_for: sharedFor,
      });

    if (error) throw error;
  }

  // Get comments for document
  async getComments(documentId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('approval_comments')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', sanitizeLog(error instanceof Error ? error.message : String(error)));
      return [];
    }

    return data || [];
  }

  // Delete comment
  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('approval_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  }
}

export const approvalService = new ApprovalService();
