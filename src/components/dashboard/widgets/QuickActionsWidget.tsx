import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  Bell,
  Users,
  FileText,
  Eye,
  CheckSquare,
  BarChart3,
  GitBranch,
  MessageSquare,
  Zap,
  Settings,
  Upload,
  Download,
  Share,
  Archive,
  ArrowRightLeft
} from 'lucide-react';

interface QuickActionsWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const getActionsForRole = () => {
    // Actions based on actual navigation items available for admin roles (principal, registrar, program-head, hod)
    const adminRoleActions = [
      {
        label: "Track Documents",
        icon: Eye,
        path: "/track-documents",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        description: "Track Document status"
      },
      {
        label: "Approval Center",
        icon: CheckSquare,
        path: "/approvals",
        color: "text-warning",
        bgColor: "bg-yellow-50",
        description: "Review pending approvals"
      },
      {
        label: "Calendar",
        icon: Calendar,
        path: "/calendar",
        color: "text-blue-500",
        bgColor: "bg-blue-50",
        description: "Schedule meetings and events"
      },
      {
        label: "Messages",
        icon: MessageSquare,
        path: "/messages",
        color: "text-indigo-500",
        bgColor: "bg-indigo-50",
        description: "Communication center"
      },
      {
        label: "Document Management",
        icon: FileText,
        path: "/documents",
        color: "text-success",
        bgColor: "bg-success/10",
        description: "Manage documents"
      },
      {
        label: "Emergency Management",
        icon: AlertTriangle,
        path: "/emergency",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        description: "Emergency submissions"
      },
      {
        label: "Approval Chain with Bypass",
        icon: ArrowRightLeft,
        path: "/approval-routing",
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        description: "Approval routing management"
      },
      {
        label: "Analytics Dashboard",
        icon: BarChart3,
        path: "/analytics",
        color: "text-green-600",
        bgColor: "bg-green-50",
        description: "View analytics"
      }
    ];

    // Actions based on actual navigation items available for employee role
    const employeeRoleActions = [
      {
        label: "Track Documents",
        icon: Eye,
        path: "/track-documents",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        description: "Track Document status"
      },
      {
        label: "Approval Center",
        icon: CheckSquare,
        path: "/approvals",
        color: "text-warning",
        bgColor: "bg-yellow-50",
        description: "Review pending approvals"
      },
      {
        label: "Calendar",
        icon: Calendar,
        path: "/calendar",
        color: "text-blue-500",
        bgColor: "bg-blue-50",
        description: "Schedule meetings and events"
      },
      {
        label: "Messages",
        icon: MessageSquare,
        path: "/messages",
        color: "text-indigo-500",
        bgColor: "bg-indigo-50",
        description: "Communication center"
      },
      {
        label: "Document Management",
        icon: FileText,
        path: "/documents",
        color: "text-success",
        bgColor: "bg-success/10",
        description: "Manage documents"
      },
      {
        label: "Emergency Management",
        icon: AlertTriangle,
        path: "/emergency",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        description: "Emergency submissions"
      },
      {
        label: "Approval Chain with Bypass",
        icon: ArrowRightLeft,
        path: "/approval-routing",
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        description: "Approval routing management"
      },
      {
        label: "Analytics Dashboard",
        icon: BarChart3,
        path: "/analytics",
        color: "text-green-600",
        bgColor: "bg-green-50",
        description: "View analytics"
      }
    ];

    const roleSpecificActions = {
      principal: adminRoleActions,
      registrar: adminRoleActions,
      'program-head': adminRoleActions,
      hod: adminRoleActions,
      employee: employeeRoleActions
    };

    return roleSpecificActions[userRole as keyof typeof roleSpecificActions] || employeeRoleActions;
  };

  const actions = getActionsForRole();

  return (
    <Card className={cn(
      "shadow-elegant hover:shadow-glow transition-all duration-300",
      isSelected && "border-primary",
      isCustomizing && "cursor-pointer"
    )} onClick={onSelect}>
      <CardHeader className={cn(isMobile && "pb-3")}>
        <CardTitle className={cn(
          "flex items-center gap-2",
          isMobile ? "text-lg" : "text-xl"
        )}>
          <Zap className="w-5 h-5 text-primary" />
          Quick Actions
          <Badge variant="outline" className="ml-auto">
            {actions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid gap-3",
          isMobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4"
        )}>
          {actions.map((action, index) => (
            <Button
              key={action.path}
              variant="outline"
              onClick={() => navigate(action.path)}
              className={cn(
                "flex flex-col gap-2 transition-all duration-200 hover:shadow-md animate-scale-in",
                isMobile ? "h-auto min-h-[5rem] p-3" : "h-24 p-4"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={cn(
                "rounded-full flex items-center justify-center",
                action.bgColor,
                isMobile ? "p-2" : "p-3"
              )}>
                <action.icon className={cn(
                  action.color,
                  isMobile ? "w-4 h-4" : "w-5 h-5"
                )} />
              </div>
              <div className="text-center">
                <span className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {action.label}
                </span>
                {!isMobile && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {action.description}
                  </p>
                )}
              </div>
            </Button>
          ))}
        </div>


      </CardContent>
    </Card>
  );
};

export default QuickActionsWidget;