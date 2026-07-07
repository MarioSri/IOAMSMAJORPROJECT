import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Search,
  Bell,
  User,
  CheckSquare,
  Calendar,
  MessageSquare,
  GitBranch,
  BarChart3,
  ArrowRightLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';

export const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  if (!user) return null;

  const getNavItems = () => {
    const baseItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
      { path: '/messages', icon: MessageSquare, label: 'Chat' },
      { path: '/documents', icon: FileText, label: 'Docs' },
    ];

    // Show Approvals for all except employees, Analytics and Workflow for employees
    if (user.permissions.canApprove) {
      baseItems.push({ path: '/approvals', icon: CheckSquare, label: 'Approve' });
    } else if (user.role === 'employee') {
      baseItems.push({ path: '/analytics', icon: BarChart3, label: 'Analytics' });
    }

    return baseItems;
  };

  const navItems = getNavItems();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50 safe-area-pb">
      <div className="grid grid-flow-col auto-cols-fr gap-2 p-3 pb-4">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={isActive(item.path) ? "default" : "ghost"}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col h-18 px-3 py-2 relative touch-manipulation",
              "min-w-[56px] min-h-[56px]", // Enhanced touch target requirements
              isActive(item.path) && "bg-primary/10 text-primary"
            )}
          >
            <div className="relative">
              <item.icon className="w-6 h-6 mb-2" />
              {item.path === '/approvals' && unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 text-xs bg-destructive">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </div>
            <span className="text-xs font-medium leading-tight">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};