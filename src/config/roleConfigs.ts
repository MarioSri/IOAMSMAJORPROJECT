import { RoleConfig, UserPermissions } from '@/types/dashboard';

const branches = ['EEE', 'MECH', 'CSE', 'ECE', 'CSM', 'CSO', 'CSD', 'CSC'];
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export const roleConfigs: Record<string, RoleConfig> = {
  principal: {
    role: 'principal',
    displayName: 'Principal',
    color: '#22c55e',
    icon: 'Crown',
    permissions: {
      canViewAllDocuments: true,
      canApproveDocuments: true,
      canRejectDocuments: true,
      canMassDistribute: true,
      canManageRoles: true,
      canViewAnalytics: true,
      canScheduleMeetings: true,
      canAccessEmergency: true,
      canManageWorkflows: true,
      canViewAllDepartments: true,
      canEscalateDocuments: true,
      canOverrideApprovals: true,
      canManageUsers: true,
      departments: ['All'],
      branches: branches,
      years: years
    },
    defaultWidgets: [
      'quickActions', 'documents', 'calendar', 'workflow'
    ],
    dashboardLayout: {
      columns: 12,
      rows: 8,
      gap: 16,
      responsive: {
        mobile: { columns: 1, rows: 12 },
        tablet: { columns: 2, rows: 8 },
        desktop: { columns: 3, rows: 6 }
      }
    },
    features: {
      massDistribution: true,
      escalationManagement: true,
      roleManagement: true,
      emergencyAccess: true,
      aiSummaries: true,
      workflowBuilder: true,
      realTimeChat: true,
      meetingScheduler: true,
      signatureDashboard: true,
      analyticsAccess: true
    }
  },



  registrar: {
    role: 'registrar',
    displayName: 'Registrar',
    color: '#3b82f6',
    icon: 'Shield',
    permissions: {
      canViewAllDocuments: true,
      canApproveDocuments: true,
      canRejectDocuments: true,
      canMassDistribute: true,
      canManageRoles: false,
      canViewAnalytics: true,
      canScheduleMeetings: true,
      canAccessEmergency: true,
      canManageWorkflows: true,
      canViewAllDepartments: true,
      canEscalateDocuments: true,
      canOverrideApprovals: false,
      canManageUsers: false,
      departments: ['All'],
      branches: branches,
      years: years
    },
    defaultWidgets: [
      'quickActions', 'documents', 'calendar', 'workflow'
    ],
    dashboardLayout: {
      columns: 12,
      rows: 6,
      gap: 16,
      responsive: {
        mobile: { columns: 1, rows: 10 },
        tablet: { columns: 2, rows: 6 },
        desktop: { columns: 3, rows: 4 }
      }
    },
    features: {
      massDistribution: true,
      escalationManagement: true,
      roleManagement: false,
      emergencyAccess: true,
      aiSummaries: true,
      workflowBuilder: true,
      realTimeChat: true,
      meetingScheduler: true,
      signatureDashboard: true,
      analyticsAccess: true
    }
  },

  'program-head': {
    role: 'program-head',
    displayName: 'Program Head',
    color: '#8b5cf6',
    icon: 'Users',
    permissions: {
      canViewAllDocuments: false,
      canApproveDocuments: true,
      canRejectDocuments: true,
      canMassDistribute: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canScheduleMeetings: true,
      canAccessEmergency: true,
      canManageWorkflows: false,
      canViewAllDepartments: false,
      canEscalateDocuments: true,
      canOverrideApprovals: false,
      canManageUsers: false,
      departments: [],
      branches: [],
      years: []
    },
    defaultWidgets: [
      'quickActions', 'documents', 'calendar'
    ],
    dashboardLayout: {
      columns: 12,
      rows: 6,
      gap: 16,
      responsive: {
        mobile: { columns: 1, rows: 8 },
        tablet: { columns: 2, rows: 5 },
        desktop: { columns: 3, rows: 4 }
      }
    },
    features: {
      massDistribution: false,
      escalationManagement: false,
      roleManagement: false,
      emergencyAccess: true,
      aiSummaries: true,
      workflowBuilder: false,
      realTimeChat: true,
      meetingScheduler: true,
      signatureDashboard: true,
      analyticsAccess: true
    }
  },

  hod: {
    role: 'hod',
    displayName: 'Head of Department',
    color: '#f59e0b',
    icon: 'Building',
    permissions: {
      canViewAllDocuments: false,
      canApproveDocuments: true,
      canRejectDocuments: true,
      canMassDistribute: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canScheduleMeetings: true,
      canAccessEmergency: true,
      canManageWorkflows: false,
      canViewAllDepartments: false,
      canEscalateDocuments: true,
      canOverrideApprovals: false,
      canManageUsers: false,
      departments: [],
      branches: [],
      years: years
    },
    defaultWidgets: [
      'quickActions', 'documents', 'calendar'
    ],
    dashboardLayout: {
      columns: 12,
      rows: 6,
      gap: 16,
      responsive: {
        mobile: { columns: 1, rows: 8 },
        tablet: { columns: 2, rows: 5 },
        desktop: { columns: 3, rows: 4 }
      }
    },
    features: {
      massDistribution: false,
      escalationManagement: false,
      roleManagement: false,
      emergencyAccess: true,
      aiSummaries: true,
      workflowBuilder: false,
      realTimeChat: true,
      meetingScheduler: true,
      signatureDashboard: true,
      analyticsAccess: true
    }
  },

  employee: {
    role: 'employee',
    displayName: 'Employee',
    color: '#6b7280',
    icon: 'User',
    permissions: {
      canViewAllDocuments: true,
      canApproveDocuments: true,
      canRejectDocuments: false,
      canMassDistribute: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canScheduleMeetings: true,
      canAccessEmergency: true,
      canManageWorkflows: true,
      canViewAllDepartments: false,
      canEscalateDocuments: false,
      canOverrideApprovals: false,
      canManageUsers: false,
      departments: [],
      branches: [],
      years: []
    },
    defaultWidgets: [
      'quickActions', 'documents', 'calendar'
    ],
    dashboardLayout: {
      columns: 12,
      rows: 4,
      gap: 16,
      responsive: {
        mobile: { columns: 1, rows: 6 },
        tablet: { columns: 2, rows: 4 },
        desktop: { columns: 3, rows: 3 }
      }
    },
    features: {
      massDistribution: false,
      escalationManagement: false,
      roleManagement: false,
      emergencyAccess: true,
      aiSummaries: true,
      workflowBuilder: true,
      realTimeChat: true,
      meetingScheduler: true,
      signatureDashboard: false,
      analyticsAccess: true
    }
  }
};

export function getDashboardConfig(userRole: string, userDepartment?: string, userBranch?: string, userYear?: string) {
  const config = roleConfigs[userRole] ?? roleConfigs.employee;

  if (userDepartment && userBranch) {
    config.permissions.departments = [userDepartment];
    config.permissions.branches = [userBranch];

    if (userYear) {
      config.permissions.years = [userYear];
    }
  }

  return config;
}