import React from 'react';
import { RoleDashboard } from './RoleDashboard';
import { useAuth } from '@/contexts/AuthContext';

export const ResponsiveDashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return <RoleDashboard />;
};