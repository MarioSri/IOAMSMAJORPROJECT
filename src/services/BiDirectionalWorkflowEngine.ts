import { 
  WorkflowRoute, 
  WorkflowInstance, 
  WorkflowAction, 
  WorkflowStep, 
  EscalationPath, 
  ApprovalRule,
  NotificationPayload,
  RuleCondition,
  RuleAction 
} from '@/types/workflow';

export class BiDirectionalWorkflowEngine {
  private routes: Map<string, WorkflowRoute> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();
  private rules: Map<string, ApprovalRule> = new Map();
  private notificationQueue: NotificationPayload[] = [];

  constructor() {
    this.initializeDefaultRoutes();
    this.initializeDefaultRules();
  }

  createWorkflowRoute(route: Omit<WorkflowRoute, 'id' | 'createdAt' | 'updatedAt'>): WorkflowRoute {
    const newRoute: WorkflowRoute = {
      ...route,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.routes.set(newRoute.id, newRoute);
    return newRoute;
  }

  updateWorkflowRoute(routeId: string, updates: Partial<WorkflowRoute>): WorkflowRoute | null {
    const route = this.routes.get(routeId);
    if (!route) return null;

    const updatedRoute = {
      ...route,
      ...updates,
      updatedAt: new Date()
    };

    this.routes.set(routeId, updatedRoute);
    return updatedRoute;
  }

  initiateWorkflow(documentId: string, documentType: string, initiatedBy: string, department?: string, branch?: string): WorkflowInstance | null {
    const route = this.findApplicableRoute(documentType, department, branch);
    if (!route || !route.isActive) {
      throw new Error('No applicable workflow route found or route is inactive');
    }

    const instance: WorkflowInstance = {
      id: this.generateId(),
      documentId,
      workflowRouteId: route.id,
      currentStepId: route.steps[0].id,
      status: 'pending',
      initiatedBy,
      initiatedAt: new Date(),
      history: [],
      metadata: {
        documentType,
        department,
        branch,
        routeName: route.name
      }
    };

    this.instances.set(instance.id, instance);
    
    this.sendApprovalNotification(instance, route.steps[0]);
    
    return instance;
  }

  processApproval(
    instanceId: string, 
    stepId: string, 
    actionType: 'approve' | 'reject' | 'escalate' | 'request-changes',
    performedBy: string,
    comments?: string,
    attachments?: string[]
  ): { success: boolean; nextStep?: WorkflowStep; escalated?: boolean; message: string } {
    
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return { success: false, message: 'Workflow instance not found' };
    }

    const route = this.routes.get(instance.workflowRouteId);
    if (!route) {
      return { success: false, message: 'Workflow route not found' };
    }

    const currentStep = route.steps.find(step => step.id === stepId);
    if (!currentStep) {
      return { success: false, message: 'Workflow step not found' };
    }

    if (!this.canUserPerformAction(performedBy, currentStep)) {
      return { success: false, message: 'User does not have permission to perform this action' };
    }

    const action: WorkflowAction = {
      id: this.generateId(),
      stepId,
      actionType,
      performedBy,
      performedAt: new Date(),
      comments,
      attachments
    };

    instance.history.push(action);

    switch (actionType) {
      case 'approve':
        return this.handleApproval(instance, route, currentStep, action);
      
      case 'reject':
        return this.handleRejection(instance, route, currentStep, action);
      
      case 'escalate':
        return this.handleManualEscalation(instance, route, currentStep, action);
      
      case 'request-changes':
        return this.handleChangeRequest(instance, route, currentStep, action);
      
      default:
        return { success: false, message: 'Invalid action type' };
    }
  }

  processCounterApproval(
    instanceId: string,
    originalActionId: string,
    actionType: 'counter-approve' | 'reject',
    performedBy: string,
    comments?: string
  ): { success: boolean; message: string } {
    
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return { success: false, message: 'Workflow instance not found' };
    }

    const originalAction = instance.history.find(action => action.id === originalActionId);
    if (!originalAction) {
      return { success: false, message: 'Original action not found' };
    }

    const route = this.routes.get(instance.workflowRouteId);
    if (!route) {
      return { success: false, message: 'Workflow route not found' };
    }

    const step = route.steps.find(s => s.id === originalAction.stepId);
    if (!step || !step.requiresCounterApproval) {
      return { success: false, message: 'Counter-approval not required for this step' };
    }

    // Validate counter-approval permissions
    if (!step.counterApprovalRoles?.some(role => this.userHasRole(performedBy, role))) {
      return { success: false, message: 'User does not have permission to counter-approve' };
    }

    const counterAction: WorkflowAction = {
      id: this.generateId(),
      stepId: originalAction.stepId,
      actionType,
      performedBy,
      performedAt: new Date(),
      comments,
      isCounterApproval: true,
      originalActionId
    };

    instance.history.push(counterAction);

    if (actionType === 'counter-approve') {
      return this.moveToNextStep(instance, route, step);
    } else {
      return this.handleRejection(instance, route, step, counterAction);
    }
  }

  private handleApproval(instance: WorkflowInstance, route: WorkflowRoute, currentStep: WorkflowStep, action: WorkflowAction) {
    if (currentStep.requiresCounterApproval) {
      instance.status = 'pending';
      this.sendCounterApprovalNotification(instance, currentStep, action);
      return { 
        success: true, 
        message: 'Approval recorded. Counter-approval required before proceeding.' 
      };
    }

    // Move to next step
    return this.moveToNextStep(instance, route, currentStep);
  }

  private handleRejection(instance: WorkflowInstance, route: WorkflowRoute, currentStep: WorkflowStep, action: WorkflowAction) {
    const escalationPath = this.findEscalationPath(route, currentStep.id, 'rejection');
    
    if (escalationPath) {
      return this.escalateWorkflow(instance, route, escalationPath, action);
    } else {
      instance.status = 'rejected';
      instance.completedAt = new Date();
      this.sendRejectionNotification(instance, currentStep, action);
      return { 
        success: true, 
        message: 'Document rejected. Workflow terminated.' 
      };
    }
  }

  private handleManualEscalation(instance: WorkflowInstance, route: WorkflowRoute, currentStep: WorkflowStep, action: WorkflowAction) {
    const escalationPath = this.findEscalationPath(route, currentStep.id, 'manual');
    
    if (escalationPath) {
      return this.escalateWorkflow(instance, route, escalationPath, action);
    } else {
      return { 
        success: false, 
        message: 'No escalation path available for manual escalation' 
      };
    }
  }

  private handleChangeRequest(instance: WorkflowInstance, route: WorkflowRoute, currentStep: WorkflowStep, action: WorkflowAction) {
    instance.status = 'pending';
    this.sendChangeRequestNotification(instance, currentStep, action);
    return { 
      success: true, 
      message: 'Change request sent to document initiator' 
    };
  }

  private moveToNextStep(instance: WorkflowInstance, route: WorkflowRoute, currentStep: WorkflowStep) {
    const nextStep = this.getNextStep(route, currentStep);
    
    if (nextStep) {
      instance.currentStepId = nextStep.id;
      instance.status = 'in-progress';
      this.sendApprovalNotification(instance, nextStep);
      return { 
        success: true, 
        nextStep, 
        message: `Approved. Moved to next step: ${nextStep.name}` 
      };
    } else {
      instance.status = 'completed';
      instance.completedAt = new Date();
      this.sendCompletionNotification(instance);
      return { 
        success: true, 
        message: 'Document fully approved. Workflow completed.' 
      };
    }
  }

  private escalateWorkflow(instance: WorkflowInstance, route: WorkflowRoute, escalationPath: EscalationPath, triggerAction: WorkflowAction) {
    const escalationAction: WorkflowAction = {
      id: this.generateId(),
      stepId: triggerAction.stepId,
      actionType: 'escalate',
      performedBy: 'system',
      performedAt: new Date(),
      comments: `Auto-escalated due to ${escalationPath.condition}`,
      escalatedTo: escalationPath.escalateToRoles,
      reasonCode: escalationPath.condition
    };

    instance.history.push(escalationAction);
    
    if (escalationPath.toStepId) {
      instance.currentStepId = escalationPath.toStepId;
      const targetStep = route.steps.find(step => step.id === escalationPath.toStepId);
      if (targetStep) {
        this.sendEscalationNotification(instance, targetStep, escalationPath, triggerAction);
      }
    }

    instance.status = 'escalated';
    
    return { 
      success: true, 
      escalated: true, 
      message: `Escalated to ${escalationPath.escalateToRoles.join(', ')} due to ${escalationPath.condition}` 
    };
  }

  checkTimeouts(): void {
    const now = new Date();
    
    for (const instance of this.instances.values()) {
      if (instance.status !== 'in-progress' && instance.status !== 'pending') continue;
      
      const route = this.routes.get(instance.workflowRouteId);
      if (!route) continue;
      
      const currentStep = route.steps.find(step => step.id === instance.currentStepId);
      if (!currentStep || !currentStep.timeoutHours) continue;
      
      const stepStartTime = this.getStepStartTime(instance, currentStep.id);
      const timeoutTime = new Date(stepStartTime.getTime() + (currentStep.timeoutHours * 60 * 60 * 1000));
      
      if (now > timeoutTime) {
        this.handleTimeout(instance, route, currentStep);
      }
    }
  }

  private handleTimeout(instance: WorkflowInstance, route: WorkflowRoute, currentStep: WorkflowStep): void {
    const escalationPath = this.findEscalationPath(route, currentStep.id, 'timeout');
    
    if (escalationPath) {
      const timeoutAction: WorkflowAction = {
        id: this.generateId(),
        stepId: currentStep.id,
        actionType: 'escalate',
        performedBy: 'system',
        performedAt: new Date(),
        comments: `Escalated due to timeout (${currentStep.timeoutHours} hours)`,
        reasonCode: 'timeout'
      };
      
      this.escalateWorkflow(instance, route, escalationPath, timeoutAction);
    }
  }

  private findApplicableRoute(documentType: string, department?: string, branch?: string): WorkflowRoute | null {
    for (const route of this.routes.values()) {
      if (route.documentType === documentType || route.documentType === 'general') {
        if (!route.department || route.department === department) {
          if (!route.branch || route.branch === branch) {
            return route;
          }
        }
      }
    }
    return null;
  }

  private findEscalationPath(route: WorkflowRoute, stepId: string, condition: string): EscalationPath | null {
    return route.escalationPaths.find(path => 
      path.fromStepId === stepId && path.condition === condition
    ) || null;
  }

  private getNextStep(route: WorkflowRoute, currentStep: WorkflowStep): WorkflowStep | null {
    const currentOrder = currentStep.order;
    return route.steps
      .filter(step => step.order > currentOrder)
      .sort((a, b) => a.order - b.order)[0] || null;
  }

  private getStepStartTime(instance: WorkflowInstance, stepId: string): Date {
    const stepActions = instance.history.filter(action => action.stepId === stepId);
    return stepActions.length > 0 ? stepActions[0].performedAt : instance.initiatedAt;
  }

  private canUserPerformAction(userId: string, step: WorkflowStep): boolean {
    return step.roleRequired.some(role => this.userHasRole(userId, role));
  }

  private userHasRole(userId: string, role: string): boolean {
    return true;
  }

  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendApprovalNotification(instance: WorkflowInstance, step: WorkflowStep): void {
    const notification: NotificationPayload = {
      type: 'approval-request',
      workflowInstanceId: instance.id,
      documentId: instance.documentId,
      recipients: step.roleRequired,
      subject: `Approval Required: ${instance.metadata.routeName}`,
      message: `A document requires your approval in step: ${step.name}`,
      actionUrl: `/workflow/approve/${instance.id}`,
      priority: 'medium',
      metadata: {
        stepName: step.name,
        documentType: instance.metadata.documentType
      }
    };
    
    this.notificationQueue.push(notification);
  }

  private sendCounterApprovalNotification(instance: WorkflowInstance, step: WorkflowStep, originalAction: WorkflowAction): void {
    if (!step.counterApprovalRoles) return;
    
    const notification: NotificationPayload = {
      type: 'counter-approval-required',
      workflowInstanceId: instance.id,
      documentId: instance.documentId,
      recipients: step.counterApprovalRoles,
      subject: `Counter-Approval Required: ${instance.metadata.routeName}`,
      message: `A document has been approved and requires counter-approval verification`,
      actionUrl: `/workflow/counter-approve/${instance.id}/${originalAction.id}`,
      priority: 'high',
      metadata: {
        stepName: step.name,
        originalApprover: originalAction.performedBy
      }
    };
    
    this.notificationQueue.push(notification);
  }

  private sendEscalationNotification(instance: WorkflowInstance, step: WorkflowStep, escalationPath: EscalationPath, triggerAction: WorkflowAction): void {
    const notification: NotificationPayload = {
      type: 'escalation',
      workflowInstanceId: instance.id,
      documentId: instance.documentId,
      recipients: escalationPath.escalateToRoles,
      subject: `Escalated: ${instance.metadata.routeName}`,
      message: `A document has been escalated to your attention due to ${escalationPath.condition}`,
      actionUrl: `/workflow/approve/${instance.id}`,
      priority: 'urgent',
      metadata: {
        escalationReason: escalationPath.condition,
        originalStep: step.name,
        triggerAction: triggerAction.actionType
      }
    };
    
    this.notificationQueue.push(notification);
  }

  private sendRejectionNotification(instance: WorkflowInstance, step: WorkflowStep, action: WorkflowAction): void {
    const notification: NotificationPayload = {
      type: 'approval-rejected',
      workflowInstanceId: instance.id,
      documentId: instance.documentId,
      recipients: [instance.initiatedBy],
      subject: `Document Rejected: ${instance.metadata.routeName}`,
      message: `Your document has been rejected at step: ${step.name}`,
      actionUrl: `/documents/${instance.documentId}`,
      priority: 'high',
      metadata: {
        rejectedBy: action.performedBy,
        rejectionComments: action.comments,
        stepName: step.name
      }
    };
    
    this.notificationQueue.push(notification);
  }

  private sendCompletionNotification(instance: WorkflowInstance): void {
    const notification: NotificationPayload = {
      type: 'approval-granted',
      workflowInstanceId: instance.id,
      documentId: instance.documentId,
      recipients: [instance.initiatedBy],
      subject: `Document Approved: ${instance.metadata.routeName}`,
      message: `Your document has been fully approved and the workflow is complete`,
      actionUrl: `/documents/${instance.documentId}`,
      priority: 'medium',
      metadata: {
        completedAt: instance.completedAt,
        totalSteps: instance.history.length
      }
    };
    
    this.notificationQueue.push(notification);
  }

  private sendChangeRequestNotification(instance: WorkflowInstance, step: WorkflowStep, action: WorkflowAction): void {
    const notification: NotificationPayload = {
      type: 'approval-request',
      workflowInstanceId: instance.id,
      documentId: instance.documentId,
      recipients: [instance.initiatedBy],
      subject: `Changes Requested: ${instance.metadata.routeName}`,
      message: `Changes have been requested for your document at step: ${step.name}`,
      actionUrl: `/documents/${instance.documentId}/edit`,
      priority: 'medium',
      metadata: {
        requestedBy: action.performedBy,
        changeComments: action.comments,
        stepName: step.name
      }
    };
    
    this.notificationQueue.push(notification);
  }

  getWorkflowInstance(instanceId: string): WorkflowInstance | null {
    return this.instances.get(instanceId) || null;
  }

  getWorkflowRoute(routeId: string): WorkflowRoute | null {
    return this.routes.get(routeId) || null;
  }

  getAllWorkflowRoutes(): WorkflowRoute[] {
    return Array.from(this.routes.values());
  }

  getAllActiveRoutes(): WorkflowRoute[] {
    return Array.from(this.routes.values()).filter(route => route.isActive);
  }

  getInstancesByUser(userId: string): WorkflowInstance[] {
    return Array.from(this.instances.values()).filter(instance => 
      instance.initiatedBy === userId || 
      instance.history.some(action => action.performedBy === userId)
    );
  }

  getPendingApprovals(userId: string): WorkflowInstance[] {
    const pendingInstances: WorkflowInstance[] = [];
    
    for (const instance of this.instances.values()) {
      if (instance.status !== 'in-progress' && instance.status !== 'pending') continue;
      
      const route = this.routes.get(instance.workflowRouteId);
      if (!route) continue;
      
      const currentStep = route.steps.find(step => step.id === instance.currentStepId);
      if (!currentStep) continue;
      
      if (this.canUserPerformAction(userId, currentStep)) {
        pendingInstances.push(instance);
      }
    }
    
    return pendingInstances;
  }

  getNotificationQueue(): NotificationPayload[] {
    const queue = [...this.notificationQueue];
    this.notificationQueue = [];
    return queue;
  }

  private initializeDefaultRoutes(): void {
    const academicRoute: WorkflowRoute = {
      id: 'route_academic_default',
      name: 'Academic Document Approval',
      description: 'Standard workflow for academic document approval',
      type: 'sequential',
      documentType: 'academic',
      requiresCounterApproval: true,
      autoEscalation: {
        enabled: true,
        timeoutHours: 72
      },
      steps: [
        {
          id: 'step_hod_review',
          name: 'HOD Review',
          description: 'Initial review by Head of Department',
          roleRequired: ['hod'],
          approverRole: 'HOD',
          order: 1,
          isOptional: false,
          requiredApprovals: 1,
          timeoutHours: 48,
          escalationRoles: ['program-head']
        },
        {
          id: 'step_program_head_approval',
          name: 'Program Head Approval',
          description: 'Approval by Program Department Head',
          roleRequired: ['program-head'],
          approverRole: 'Program Department Head',
          order: 2,
          isOptional: false,
          requiredApprovals: 1,
          requiresCounterApproval: true,
          counterApprovalRoles: ['registrar'],
          timeoutHours: 72,
          escalationRoles: ['registrar']
        },
        {
          id: 'step_registrar_final',
          name: 'Registrar Final Approval',
          description: 'Final approval by Registrar',
          roleRequired: ['registrar'],
          approverRole: 'Registrar',
          order: 3,
          isOptional: false,
          requiredApprovals: 1,
          timeoutHours: 96,
          escalationRoles: ['principal']
        }
      ],
      escalationPaths: [
        {
          id: 'esc_hod_reject',
          condition: 'rejection',
          fromStepId: 'step_hod_review',
          toStepId: 'step_program_head_approval',
          escalateToRoles: ['program-head'],
          requiresReason: true,
          notificationTemplate: 'Document rejected by HOD, escalated to Program Head'
        },
        {
          id: 'esc_timeout_hod',
          condition: 'timeout',
          fromStepId: 'step_hod_review',
          toStepId: 'step_program_head_approval',
          escalateToRoles: ['program-head'],
          requiresReason: false,
          notificationTemplate: 'HOD review timeout, escalated to Program Head'
        }
      ],
      isActive: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.routes.set(academicRoute.id, academicRoute);
  }

  private initializeDefaultRules(): void {
  }
}
