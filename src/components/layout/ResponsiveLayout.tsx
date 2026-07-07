import React, { ReactNode } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileHeader } from './MobileHeader';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ResponsiveLayoutProps {
  children: ReactNode;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ children }) => {
  const { isMobile } = useResponsive();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-background overflow-x-hidden">
        <MobileHeader />
        <main className="flex-1 w-full px-4 pt-4 pb-[max(6rem,env(safe-area-inset-bottom,2rem))]">
          {children}
        </main>
      </div>
    );
  }

  return (
    <DashboardLayout userRole={user.role} onLogout={handleLogout}>
      {children}
    </DashboardLayout>
  );
};