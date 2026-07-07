import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  MessageSquare,
  GitBranch,
  CheckSquare,
  BarChart3,
  Bell,
  AlertTriangle,
  Search,
  Crown,
  Shield,
  Users,
  Briefcase,
  User
} from 'lucide-react';
import { AdvancedSignatureIcon } from '@/components/ui/signature-icon';

export const NavigationOverview: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const getRoleInfo = () => {
    switch (user.role) {
      case "principal":
        return { 
          icon: Crown, 
          title: "Principal", 
          color: "bg-purple-100 text-purple-700 border-purple-200",
          description: "Institution Principal"
        };
      case "registrar":
        return { 
          icon: Shield, 
          title: "Registrar", 
          color: "bg-blue-100 text-blue-700 border-blue-200",
          description: "Academic Registrar"
        };
      case "program-head":
        return { 
          icon: Users, 
          title: "Program Head", 
          color: "bg-green-100 text-green-700 border-green-200",
          description: "Program Department Head"
        };
      case "hod":
        return { 
          icon: Users, 
          title: "HOD", 
          color: "bg-orange-100 text-orange-700 border-orange-200",
          description: "Head of Department"
        };
      case "employee":
        return { 
          icon: Briefcase, 
          title: "Employee", 
          color: "bg-gray-100 text-gray-700 border-gray-200",
          description: "Staff Member"
        };
      default:
        return { 
          icon: User, 
          title: "User", 
          color: "bg-gray-100 text-gray-700 border-gray-200",
          description: "System User"
        };
    }
  };

  const getNavigationItems = () => {
    const commonItems = [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, category: "Main" },
      { title: "Documents", url: "/documents", icon: FileText, category: "Core" },
      { title: "Calendar", url: "/calendar", icon: Calendar, category: "Core" },
      { title: "Messages", url: "/messages", icon: MessageSquare, category: "Communication" },
      { title: "Advanced Signature", url: "/advanced-signature", icon: AdvancedSignatureIcon, category: "Tools" },
      { title: "Reminders", url: "/reminders", icon: Bell, category: "Tools" },
      { title: "Emergency", url: "/emergency", icon: AlertTriangle, category: "Tools" },
    ];

    const adminItems = [
      { title: "Approvals", url: "/approvals", icon: CheckSquare, category: "Management" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, category: "Management" },
    ];

    const roleSpecificItems = {
      principal: [...commonItems, ...adminItems],
      registrar: [...commonItems, ...adminItems],
      "program-head": [...commonItems, ...adminItems],
      hod: [...commonItems, ...adminItems],
      employee: [...commonItems, 
        { title: "Approvals", url: "/approvals", icon: CheckSquare, category: "Management" },
        { title: "Bi-Directional Routing", url: "/approval-routing", icon: CheckSquare, category: "Management" },
        { title: "Analytics", url: "/analytics", icon: BarChart3, category: "Management" }
      ],
    };

    return roleSpecificItems[user.role as keyof typeof roleSpecificItems] || commonItems;
  };

  const roleInfo = getRoleInfo();
  const RoleIcon = roleInfo.icon;
  const navigationItems = getNavigationItems();

  const groupedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof navigationItems>);

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <RoleIcon className="w-6 h-6 text-primary" />
          Main Navigation - {roleInfo.title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-sm font-medium border", roleInfo.color)}>
            {roleInfo.description}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {navigationItems.length} Navigation Items
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {category}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.url}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Permissions Summary */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Role Permissions
          </h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                user.permissions.canApprove ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm">Can Approve Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                user.permissions.canViewAllDepartments ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm">View All Departments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                user.permissions.canViewAnalytics ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm">View Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                user.permissions.canManageUsers ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm">Manage Users</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NavigationOverview;
