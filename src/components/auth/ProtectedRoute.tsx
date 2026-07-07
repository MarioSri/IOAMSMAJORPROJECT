import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-animation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
}

// ─── Protected Route ──────────────────────────────────────────────────────────
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (location.pathname !== '/') {
      localStorage.setItem('iaoms-redirect-path', location.pathname);
    }
    return <Navigate to="/" replace />;
  }

  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.some(permission => {
      switch (permission) {
        case 'canApprove': return user.permissions.canApprove;
        case 'canViewAllDepartments': return user.permissions.canViewAllDepartments;
        case 'canManageWorkflows': return user.permissions.canManageWorkflows;
        case 'canViewAnalytics': return user.permissions.canViewAnalytics;
        case 'canManageUsers': return user.permissions.canManageUsers;
        default: return false;
      }
    });
    if (!hasPermission) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

