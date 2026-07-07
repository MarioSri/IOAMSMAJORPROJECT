export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  roleRequired: string[];
  approverRole: string; // For UI compatibility
  order: number;
  isOptional: boolean;
  requiredApprovals: number; // For UI compatibility
  requiresCounterApproval?: boolean;
  counterApprovalRoles?: string[];
  timeoutHours?: number;
  escalationRoles?: string[];
}

export type WorkflowStepStatus = 'pending' | 'current' | 'completed' | 'rejected' | 'bypassed' | 'cancelled' | 'resent';

export interface WorkflowStepInstance {
  id: string;
  workflow_id: string;
  name: string;
  step_order: number;
  assignee: string;
  assignee_id: string;
  status: WorkflowStepStatus;
  completed_date?: string | null;
  rejected_date?: string | null;
  rejected_by?: string | null;
  bypass_reason?: string | null;
  bypassed_at?: string | null;
  resent_at?: string | null;
  reupload_file_id?: string | null;
  file_version_at_action?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowRoute {
  id: string;
  name: string;
  description: string; // For UI compatibility
  type: 'sequential' | 'parallel' | 'bidirectional'; // For UI compatibility - Added bidirectional
  documentType: 'academic' | 'administrative' | 'financial' | 'general';
  department?: string;
  branch?: string;
  steps: WorkflowStep[];
  escalationPaths: EscalationPath[];
  requiresCounterApproval: boolean; // For UI compatibility
  autoEscalation: { // For UI compatibility
    enabled: boolean;
    timeoutHours: number;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationPath {
  id: string;
  condition: 'rejection' | 'timeout' | 'inaction' | 'manual';
  fromStepId: string;
  toStepId?: string;
  escalateToRoles: string[];
  requiresReason: boolean;
  notificationTemplate: string;
}

export interface WorkflowInstance {
  id: string;
  documentId: string;
  workflowRouteId: string;
  currentStepId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'rejected' | 'escalated' | 'partially-approved';
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  history: WorkflowAction[];
  metadata: Record<string, any>;
}

export interface WorkflowAction {
  id: string;
  stepId: string;
  actionType: 'approve' | 'reject' | 'escalate' | 'comment' | 'request-changes' | 'counter-approve' | 'bypass' | 'resend';
  performedBy: string;
  performedAt: Date;
  comments?: string;
  attachments?: string[];
  reasonCode?: string;
  nextStepId?: string;
  escalatedTo?: string[];
  isCounterApproval?: boolean;
  originalActionId?: string;
}

export interface ApprovalRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  isActive: boolean;
}

export interface RuleCondition {
  type: 'role' | 'document-type' | 'amount' | 'department' | 'time-elapsed' | 'previous-action';
  operator: 'equals' | 'contains' | 'greater-than' | 'less-than' | 'in' | 'not-in';
  value: any;
  field?: string;
}

export interface RuleAction {
  type: 'route-to' | 'escalate-to' | 'notify' | 'require-counter-approval' | 'set-timeout' | 'parallel-approve';
  target: string[];
  parameters?: Record<string, any>;
}

export interface NotificationPayload {
  type: 'approval-request' | 'approval-granted' | 'approval-rejected' | 'escalation' | 'timeout-warning' | 'counter-approval-required';
  workflowInstanceId: string;
  documentId: string;
  recipients: string[];
  subject: string;
  message: string;
  actionUrl: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata: Record<string, any>;
}

export interface WorkflowMetrics {
  averageCompletionTime: number;
  bottleneckSteps: string[];
  escalationRate: number;
  rejectionRate: number;
  timeoutRate: number;
  counterApprovalUsage: number;
}
