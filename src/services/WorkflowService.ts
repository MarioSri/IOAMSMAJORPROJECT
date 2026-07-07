import { supabase } from '@/lib/supabase';
import { reportBlockchainEvent } from './BlockchainAuditService';
import { WorkflowStepStatus, WorkflowStepInstance } from '@/types/workflow';

interface WorkflowConfig {
  documentId: string;
  recipients: Array<{ id: string; name: string }>;
  isParallel?: boolean;
  routingType?: 'sequential' | 'parallel' | 'bidirectional';
  /** Identifies the originating workflow module (e.g. 'document-management', 'emergency-management', 'approval-chain-bypass') */
  source?: string;
  /** True when the workflow allows bypass approval steps */
  hasBypass?: boolean;
}

/** Internal type for workflow step row creation/management */
interface WorkflowStep extends Omit<WorkflowStepInstance, 'id' | 'workflow_id' | 'created_at' | 'updated_at'> {
  id?: string;
  workflow_id?: string;
}

class WorkflowService {
  async createWorkflow(config: WorkflowConfig): Promise<any> {
    const firstActiveRecipient = config.recipients[0];

    // 1. Create workflow record
    const { data: workflow, error: workflowError } = await supabase
      .from('document_workflows')
      .insert({
        document_id: config.documentId,
        current_step: firstActiveRecipient?.name || 'Submission',
        progress: 0,
        is_parallel: config.isParallel || false,
        routing_type: config.routingType || 'sequential',
        source: config.source || 'document-management',
        has_bypass: config.hasBypass || false,
      })
      .select()
      .single();

    if (workflowError) throw workflowError;

    // 2. Create workflow steps
    // Parallel and bidirectional workflows send to all recipients simultaneously
    const isAllCurrent = config.isParallel ||
      config.routingType === 'parallel' ||
      config.routingType === 'bidirectional';

    const orderedRecipients = config.recipients;

    const steps: WorkflowStep[] = orderedRecipients.map((recipient, index) => ({
      name: this.getStepName(recipient.name),
      step_order: index,
      assignee_id: recipient.id,
      assignee: recipient.name,
      status: (isAllCurrent || index === 0) ? 'current' : 'pending',
    }));

    const { error: stepsError } = await supabase
      .from('workflow_steps')
      .insert(
        steps.map(step => ({
          workflow_id: workflow.id,
          ...step,
        }))
      );

    if (stepsError) throw stepsError;

    return workflow;
  }

  async getWorkflowByDocumentId(documentId: string): Promise<any> {
    const { data, error } = await supabase
      .from('document_workflows')
      .select(`
        *,
        steps:workflow_steps(*)
      `)
      .eq('document_id', documentId)
      .single();

    if (error) {
      console.error('Error fetching workflow:', String(error.message).replace(/[\r\n]/g, ''));
      return null;
    }

    return data;
  }

  async advanceWorkflowStep(workflowId: string, currentStepId: string): Promise<void> {
    // Get workflow and steps
    const { data: workflow } = await supabase
      .from('document_workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', workflowId)
      .single();

    if (!workflow) throw new Error('Workflow not found');

    const routingType: string = workflow.routing_type || 'sequential';
    const isParallelLike = routingType === 'parallel' || routingType === 'bidirectional' || workflow.is_parallel;

    const steps = workflow.steps.sort((a: any, b: any) => a.step_order - b.step_order);
    const currentIndex = steps.findIndex((s: any) => s.id === currentStepId);

    if (currentIndex === -1) throw new Error('Current step not found');

    // Mark current step as completed
    await supabase
      .from('workflow_steps')
      .update({
        status: 'completed',
        completed_date: new Date().toISOString(),
      })
      .eq('id', currentStepId);

    if (isParallelLike) {
      // Parallel / Bidirectional: all steps are 'current' simultaneously.
      // Check if ALL remaining current steps are now resolved (completed/bypassed).
      const unresolvedSteps = steps.filter(
        (s: any) => s.id !== currentStepId && (s.status === 'current' || s.status === 'resent')
      );

      const completedSteps = steps.filter((s: any) => s.status === 'completed').length + 1;
      const bypassedSteps = steps.filter((s: any) => s.status === 'bypassed').length;
      const progress = Math.round((completedSteps / steps.length) * 100);
      const isComplete = unresolvedSteps.length === 0;

      await supabase
        .from('document_workflows')
        .update({
          progress,
          current_step: isComplete ? (bypassedSteps > 0 ? 'Complete (with bypasses)' : 'Complete') : workflow.current_step,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId);

      if (isComplete) {
        await supabase
          .from('documents')
          .update({ status: bypassedSteps > 0 ? 'partially-approved' : 'approved' })
          .eq('id', workflow.document_id);
      }
    } else {
      // Sequential: advance to next step_order
      if (currentIndex < steps.length - 1) {
        await supabase
          .from('workflow_steps')
          .update({ status: 'current' })
          .eq('id', steps[currentIndex + 1].id);
      }

      const completedSteps = steps.filter((s: any) => s.status === 'completed').length + 1;
      const progress = Math.round((completedSteps / steps.length) * 100);
      const isComplete = completedSteps === steps.length;

      await supabase
        .from('document_workflows')
        .update({
          progress,
          current_step: isComplete ? 'Complete' : steps[currentIndex + 1]?.name || 'Complete',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId);

      if (isComplete) {
        await supabase
          .from('documents')
          .update({ status: 'approved' })
          .eq('id', workflow.document_id);
      }
    }
  }

  async getNextRecipient(workflowId: string): Promise<string | null> {
    const { data: workflow } = await supabase
      .from('document_workflows')
      .select('*, steps:workflow_steps(*)')
      .eq('id', workflowId)
      .single();

    if (!workflow) return null;

    const currentStep = workflow.steps.find((s: any) => s.status === 'current');
    return currentStep?.assignee_id || null;
  }

  private getStepName(recipientName: string): string {
    const name = recipientName.toLowerCase();
    if (name.includes('hod') || name.includes('head of department')) return 'HOD Review';
    if (name.includes('principal')) return 'Principal Approval';
    if (name.includes('registrar')) return 'Registrar Review';
    if (name.includes('dean')) return 'Dean Review';
    if (name.includes('chairman')) return 'Chairman Review';
    return 'Department Review';
  }

  /**
   * Resend a document to bypassed recipients by resetting their workflow step status.
   * Returns the number of steps reset.
   */
  async resendToBypassed(documentId: string): Promise<number> {
    const workflow = await this.getWorkflowByDocumentId(documentId);
    if (!workflow) throw new Error('Workflow not found for document');

    const bypassedSteps = workflow.steps.filter((s: any) => s.status === 'bypassed');
    if (bypassedSteps.length === 0) return 0;

    // Reset bypassed steps to 'current'
    const bypassedIds = bypassedSteps.map((s: any) => s.id);
    const { error: stepsError } = await supabase
      .from('workflow_steps')
      .update({ 
        status: 'resent', 
        resent_at: new Date().toISOString(),
        rejected_date: null, 
        rejected_by: null, 
        bypass_reason: null 
      })
      .in('id', bypassedIds);

    if (stepsError) throw stepsError;

    // Clear bypassed_recipients on the workflow (empty JSON array)
    const { error: wfError } = await supabase
      .from('document_workflows')
      .update({ bypassed_recipients: [] })
      .eq('id', workflow.id);

    if (wfError) throw wfError;

    // Reset document status back to pending if it was partially-approved
    await supabase
      .from('documents')
      .update({ status: 'pending' })
      .eq('id', documentId)
      .in('status', ['partially-approved']);

    // Blockchain audit — bypassed recipients are now being reprocessed (BYPASS_APPROVED)
    reportBlockchainEvent({
      documentId,
      action: 'BYPASS_APPROVED',
      workflowStep: 'Bypass Resubmission',
      comment: `${bypassedSteps.length} bypassed step(s) reset for reprocessing`,
    }).catch(() => {});

    return bypassedSteps.length;
  }

  /**
   * Resend document to SELECTED bypassed recipients only.
   * @param documentId - The document ID
   * @param selectedRecipientNames - Array of recipient names to resend to
   * @returns Number of steps reset
   */
  async resendToSelectedRecipients(
    documentId: string, 
    selectedRecipientNames: string[]
  ): Promise<number> {
    const workflow = await this.getWorkflowByDocumentId(documentId);
    if (!workflow) throw new Error('Workflow not found for document');

    // Find bypassed steps matching selected recipient names
    const selectedSteps = workflow.steps.filter((s: any) => 
      s.status === 'bypassed' && 
      selectedRecipientNames.some(name => 
        s.assignee.toLowerCase().includes(name.toLowerCase())
      )
    );

    if (selectedSteps.length === 0) return 0;

    // Reset ONLY selected bypassed steps to 'resent'
    const selectedIds = selectedSteps.map((s: any) => s.id);
    const { error: stepsError } = await supabase
      .from('workflow_steps')
      .update({ 
        status: 'resent', 
        resent_at: new Date().toISOString(),
        rejected_date: null, 
        rejected_by: null, 
        bypass_reason: null 
      })
      .in('id', selectedIds);

    if (stepsError) throw stepsError;

    // Update bypassed_recipients to remove only selected recipients
    const remainingBypassed = workflow.steps
      .filter((s: any) => 
        s.status === 'bypassed' && 
        !selectedRecipientNames.some(name => 
          s.assignee.toLowerCase().includes(name.toLowerCase())
        )
      )
      .map((s: any) => s.assignee);

    const { error: wfError } = await supabase
      .from('document_workflows')
      .update({ bypassed_recipients: remainingBypassed })
      .eq('id', workflow.id);

    if (wfError) throw wfError;

    // Reset document status if needed
    if (remainingBypassed.length === 0) {
      await supabase
        .from('documents')
        .update({ status: 'pending' })
        .eq('id', documentId)
        .in('status', ['partially-approved']);
    }

    // Blockchain audit
    reportBlockchainEvent({
      documentId,
      action: 'BYPASS_APPROVED',
      workflowStep: 'Selective Resubmission',
      comment: `${selectedSteps.length} selected recipient(s) reset: ${selectedRecipientNames.join(', ')}`,
    }).catch(() => {});

    return selectedSteps.length;
  }

  /**
   * Update files on a document via Supabase.
   */
  async updateDocumentFiles(documentId: string, files: any[]): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update({ files })
      .eq('id', documentId);

    if (error) throw error;
  }
}

export const workflowService = new WorkflowService();
