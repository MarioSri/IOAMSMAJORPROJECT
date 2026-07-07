import { supabase } from '@/lib/supabase';
import { recipientService } from '@/services/RecipientService';
import { sanitizeForLog } from '@/utils/sanitize';

interface EscalationTimer {
  documentId: string;
  timerId: NodeJS.Timeout;
  escalationLevel: number;
  mode: 'sequential' | 'parallel';
  currentRecipientIndex: number;
  recipients: string[];
  lastEscalationTime: Date;
}

interface EscalationConfig {
  documentId: string;
  documentTitle: string;
  mode: 'sequential' | 'parallel';
  timeout: number; // in milliseconds
  recipients: string[];
  submittedBy: string;
  cyclicEscalation: boolean;
}

export class EscalationService {
  private activeTimers: Map<string, EscalationTimer> = new Map();
  private authorityChain: string[] = [];
  private authorityChainLoaded = false;

  /**
   * Load authority chain dynamically from role_recipients table
   * Filters for authority roles (principal, registrar, dean, chairman)
   */
  private async loadAuthorityChain(): Promise<string[]> {
    if (this.authorityChainLoaded && this.authorityChain.length > 0) {
      return this.authorityChain;
    }
    try {
      const recipients = await recipientService.fetchRecipients();
      const authorityRoles = ['principal', 'registrar', 'dean', 'chairman'];
      this.authorityChain = authorityRoles
        .map(role => {
          const match = recipients.find(r =>
            r.role?.toLowerCase().includes(role) ||
            r.designation?.toLowerCase().includes(role)
          );
          return match?.id;
        })
        .filter((id): id is string => !!id);
      this.authorityChainLoaded = true;
      console.log('[Escalation] Authority chain loaded:', this.authorityChain.length, 'members');
    } catch (err) {
      console.warn('[Escalation] Failed to load authority chain, using empty:', err);
      this.authorityChain = [];
    }
    return this.authorityChain;
  }

  /**
   * Fetch document workflow state from Supabase instead of localStorage
   */
  private async getDocumentWorkflow(documentId: string) {
    const { data: workflow } = await supabase
      .from('document_workflows')
      .select('*, workflow_steps(*)')
      .eq('document_id', documentId)
      .single();
    return workflow;
  }

  /**
   * Update a workflow step in Supabase
   */
  private async updateWorkflowStep(stepId: string, updates: Record<string, any>) {
    await supabase
      .from('workflow_steps')
      .update(updates)
      .eq('id', stepId);
  }

  /**
   * Update document workflow metadata in Supabase
   */
  private async updateDocumentWorkflow(workflowId: string, updates: Record<string, any>) {
    await supabase
      .from('document_workflows')
      .update(updates)
      .eq('id', workflowId);
  }

  initializeEscalation(config: EscalationConfig): void {
    console.log(`[Escalation] Initializing for document: ${sanitizeForLog(config.documentId)}`);
    console.log(`   Mode: ${sanitizeForLog(config.mode)}`);
    console.log(`   Timeout: ${config.timeout}ms (${this.formatTimeout(config.timeout)})`);
    console.log(`   Recipients: ${config.recipients.length}`);
    
    this.stopEscalation(config.documentId);
    
    if (config.mode === 'sequential') {
      this.startSequentialEscalation(config);
    } else {
      this.startParallelEscalation(config);
    }
  }

  private startSequentialEscalation(config: EscalationConfig): void {
    const timerId = setTimeout(() => {
      this.handleSequentialEscalation(config);
    }, config.timeout);

    this.activeTimers.set(config.documentId, {
      documentId: config.documentId,
      timerId,
      escalationLevel: 0,
      mode: 'sequential',
      currentRecipientIndex: 0,
      recipients: config.recipients,
      lastEscalationTime: new Date()
    });

    console.log(`[Sequential Escalation] Timer set for ${this.formatTimeout(config.timeout)}`);
  }

  private async handleSequentialEscalation(config: EscalationConfig): Promise<void> {
    console.log(`[Sequential Escalation] Timer triggered for: ${config.documentId}`);

    const timer = this.activeTimers.get(config.documentId);
    if (!timer) {
      console.log('Timer not found, escalation cancelled');
      return;
    }

    // Fetch workflow from Supabase instead of localStorage
    const workflow = await this.getDocumentWorkflow(config.documentId);
    if (!workflow) {
      console.log('Workflow not found in Supabase, stopping escalation');
      this.stopEscalation(config.documentId);
      return;
    }

    if (workflow.status === 'approved' || workflow.status === 'rejected' || workflow.status === 'completed') {
      console.log(`Workflow already ${workflow.status}, stopping escalation`);
      this.stopEscalation(config.documentId);
      return;
    }

    const steps = workflow.workflow_steps || [];
    const currentStep = steps.find((s: any) => s.status === 'current' || s.status === 'pending');
    if (!currentStep) {
      console.log('No current step (workflow complete), stopping escalation');
      this.stopEscalation(config.documentId);
      return;
    }

    console.log(`No response from ${currentStep.assignee}, escalating...`);

    const newEscalationLevel = timer.escalationLevel + 1;
    const nextRecipientIndex = (timer.currentRecipientIndex + 1) % config.recipients.length;

    // Update current step as escalated in Supabase
    await this.updateWorkflowStep(currentStep.id, {
      escalated: true,
      escalation_level: newEscalationLevel,
      escalated_at: new Date().toISOString()
    });

    // Activate next step if cyclic
    if (config.cyclicEscalation && nextRecipientIndex !== timer.currentRecipientIndex) {
      const nextStep = steps.find((s: any, idx: number) =>
        idx === nextRecipientIndex + 1 && s.status === 'pending'
      );
      if (nextStep) {
        await this.updateWorkflowStep(nextStep.id, { status: 'current' });
      }
    }

    // Update workflow metadata
    await this.updateDocumentWorkflow(workflow.id, {
      escalation_level: newEscalationLevel,
      last_escalation_time: new Date().toISOString()
    });

    // Dispatch events for UI reactivity
    window.dispatchEvent(new CustomEvent('workflow-updated'));
    window.dispatchEvent(new CustomEvent('escalation-triggered', {
      detail: {
        documentId: config.documentId,
        documentTitle: config.documentTitle,
        escalationLevel: newEscalationLevel,
        previousRecipient: currentStep.assignee
      }
    }));

    console.log(`Escalation complete:`, {
      level: newEscalationLevel,
      previousRecipient: currentStep.assignee,
      cyclePosition: `${nextRecipientIndex + 1} of ${config.recipients.length}`
    });

    if (config.cyclicEscalation) {
      this.activeTimers.set(config.documentId, {
        ...timer,
        escalationLevel: newEscalationLevel,
        currentRecipientIndex: nextRecipientIndex,
        lastEscalationTime: new Date()
      });

      const nextTimerId = setTimeout(() => {
        this.handleSequentialEscalation(config);
      }, config.timeout);

      this.activeTimers.get(config.documentId)!.timerId = nextTimerId;

      console.log(`Next escalation scheduled in ${this.formatTimeout(config.timeout)}`);
    } else {
      this.stopEscalation(config.documentId);
    }
  }

  private startParallelEscalation(config: EscalationConfig): void {
    const timerId = setTimeout(() => {
      this.handleParallelEscalation(config);
    }, config.timeout);

    this.activeTimers.set(config.documentId, {
      documentId: config.documentId,
      timerId,
      escalationLevel: 0,
      mode: 'parallel',
      currentRecipientIndex: 0,
      recipients: config.recipients,
      lastEscalationTime: new Date()
    });

    console.log(`[Parallel Escalation] Timer set for ${this.formatTimeout(config.timeout)}`);
  }

  private async handleParallelEscalation(config: EscalationConfig): Promise<void> {
    console.log(`[Parallel Escalation] Timer triggered for: ${config.documentId}`);

    const timer = this.activeTimers.get(config.documentId);
    if (!timer) {
      console.log('Timer not found, escalation cancelled');
      return;
    }

    // Fetch workflow from Supabase
    const workflow = await this.getDocumentWorkflow(config.documentId);
    if (!workflow) {
      console.log('Workflow not found in Supabase, stopping escalation');
      this.stopEscalation(config.documentId);
      return;
    }

    if (workflow.status === 'approved' || workflow.status === 'rejected' || workflow.status === 'completed') {
      console.log(`Workflow already ${workflow.status}, stopping escalation`);
      this.stopEscalation(config.documentId);
      return;
    }

    const steps = workflow.workflow_steps || [];
    const recipientSteps = steps.filter((s: any) => s.step_order > 0); // Skip submission step
    const respondedCount = recipientSteps.filter((s: any) => 
      s.status === 'completed' || s.status === 'rejected'
    ).length;

    if (respondedCount === recipientSteps.length) {
      console.log('All recipients have responded, stopping escalation');
      this.stopEscalation(config.documentId);
      return;
    }

    const newEscalationLevel = timer.escalationLevel + 1;

    // Load authority chain dynamically from Supabase
    const authorityChain = await this.loadAuthorityChain();
    const authorityIndex = Math.min(newEscalationLevel - 1, Math.max(authorityChain.length - 1, 0));
    const authorityId = authorityChain[authorityIndex] || 'unknown-authority';

    console.log(`Notifying authority level ${newEscalationLevel}: ${authorityId}`);

    // Update workflow metadata in Supabase
    await this.updateDocumentWorkflow(workflow.id, {
      escalation_level: newEscalationLevel,
      last_escalation_time: new Date().toISOString(),
      escalated_to_authority: authorityId
    });

    window.dispatchEvent(new CustomEvent('authority-escalation', {
      detail: {
        documentId: config.documentId,
        documentTitle: config.documentTitle,
        escalationLevel: newEscalationLevel,
        authorityId: authorityId,
        respondedCount,
        totalRecipients: recipientSteps.length
      }
    }));

    window.dispatchEvent(new CustomEvent('workflow-updated'));

    console.log(`Authority notified: ${authorityId}`);

    this.activeTimers.set(config.documentId, {
      ...timer,
      escalationLevel: newEscalationLevel,
      lastEscalationTime: new Date()
    });

    const nextTimerId = setTimeout(() => {
      this.handleParallelEscalation(config);
    }, config.timeout);

    this.activeTimers.get(config.documentId)!.timerId = nextTimerId;

    console.log(`Next authority notification scheduled in ${this.formatTimeout(config.timeout)}`);
  }

  stopEscalation(documentId: string): void {
    const timer = this.activeTimers.get(documentId);
    if (timer) {
      clearTimeout(timer.timerId);
      this.activeTimers.delete(documentId);
      console.log(`[Escalation] Stopped for: ${documentId}`);
    }
  }

  stopAllEscalations(): void {
    this.activeTimers.forEach((timer) => {
      clearTimeout(timer.timerId);
    });
    this.activeTimers.clear();
    console.log('[Escalation] All escalations stopped');
  }

  getEscalationStatus(documentId: string): EscalationTimer | null {
    return this.activeTimers.get(documentId) || null;
  }

  private formatTimeout(ms: number): string {
    const seconds = ms / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;

    if (days >= 1) return `${Math.round(days)} days`;
    if (hours >= 1) return `${Math.round(hours)} hours`;
    if (minutes >= 1) return `${Math.round(minutes)} minutes`;
    return `${Math.round(seconds)} seconds`;
  }

  static timeUnitToMs(value: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'): number {
    const conversions = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000
    };
    
    return value * conversions[unit];
  }
}

export const escalationService = new EscalationService();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    escalationService.stopAllEscalations();
  });
}
