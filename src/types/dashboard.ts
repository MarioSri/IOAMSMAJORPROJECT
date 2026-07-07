export interface DashboardConfig {
  role: string;
  permissions: UserPermissions;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  theme: DashboardTheme;
}

export interface DashboardWidget {
  id: string;
  type: 'documents' | 'calendar' | 'notifications' | 'analytics' | 'quickActions' | 'workflow' | 'chat';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  visible: boolean;
  data?: any;
  permissions?: string[];
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: {
    mobile: { columns: number; rows: number };
    tablet: { columns: number; rows: number };
    desktop: { columns: number; rows: number };
  };
}

export interface DashboardTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface UserPermissions {
  canViewAllDocuments: boolean;
  canApproveDocuments: boolean;
  canRejectDocuments: boolean;
  canMassDistribute: boolean;
  canManageRoles: boolean;
  canViewAnalytics: boolean;
  canScheduleMeetings: boolean;
  canAccessEmergency: boolean;
  canManageWorkflows: boolean;
  canViewAllDepartments: boolean;
  canEscalateDocuments: boolean;
  canOverrideApprovals: boolean;

  canManageUsers: boolean;
  departments: string[];
  branches: string[];
  years: string[];
}

export interface DocumentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  inReview: number;
  emergency: number;
  byDepartment: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  trends: Array<{
    date: string;
    count: number;
    approved: number;
    rejected: number;
  }>;
}

export interface RoleConfig {
  role: string;
  displayName: string;
  color: string;
  icon: string;
  permissions: UserPermissions;
  defaultWidgets: string[];
  dashboardLayout: DashboardLayout;
  features: {
    massDistribution: boolean;
    escalationManagement: boolean;
    roleManagement: boolean;
    emergencyAccess: boolean;
    aiSummaries: boolean;
    workflowBuilder: boolean;
    realTimeChat: boolean;
    meetingScheduler: boolean;
    signatureDashboard: boolean;
    analyticsAccess: boolean;
  };
}