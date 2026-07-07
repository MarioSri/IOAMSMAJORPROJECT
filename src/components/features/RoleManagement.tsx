import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Users,
  Crown,
  Shield,
  Building,
  User,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Settings,
  Search,
  Filter
} from 'lucide-react';

interface UserRole {
  id: string;
  name: string;
  email: string;
  role: 'Principal' | 'Registrar' | 'HOD' | 'Program Head' | 'Employee';
  department?: string;
  branch?: string;
  year?: string;
  permissions: string[];
  isActive: boolean;
  lastLogin: Date;
  documentsSubmitted: number;
  documentsApproved: number;
}

interface RoleTemplate {
  role: string;
  displayName: string;
  permissions: string[];
  icon: React.ComponentType<any>;
  color: string;
}

interface RoleManagementProps {
  userRole: string;
  className?: string;
}

export const RoleManagement: React.FC<RoleManagementProps> = ({ userRole, className }) => {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserRole | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { toast } = useToast();

  const roleTemplates: RoleTemplate[] = [
    {
      role: 'Principal',
      displayName: 'Principal',
      permissions: ['view_all', 'approve_all', 'manage_users', 'system_admin', 'emergency_access'],
      icon: Crown,
      color: 'text-green-600'
    },
    {
      role: 'Registrar',
      displayName: 'Registrar',
      permissions: ['view_all', 'approve_documents', 'manage_workflows', 'view_analytics'],
      icon: Shield,
      color: 'text-blue-600'
    },
    {
      role: 'HOD',
      displayName: 'Head of Department',
      permissions: ['view_department', 'approve_department', 'manage_faculty', 'view_analytics'],
      icon: Building,
      color: 'text-purple-600'
    },
    {
      role: 'Program Head',
      displayName: 'Program Head',
      permissions: ['view_program', 'approve_program', 'manage_students', 'schedule_meetings'],
      icon: Users,
      color: 'text-orange-600'
    },
    {
      role: 'Employee',
      displayName: 'Employee',
      permissions: ['submit_documents', 'view_own', 'schedule_meetings'],
      icon: User,
      color: 'text-gray-600'
    }
  ];

  const branches = ['CSE', 'EEE', 'ECE', 'MECH', 'CSM', 'CSO', 'CSD', 'CSC'];
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const departments = [
    'Computer Science & Engineering',
    'Electrical Engineering',
    'Electronics & Communication',
    'Mechanical Engineering',
    'Computer Science & Mathematics',
    'Computer Science & Operations',
    'Computer Science & Data Science',
    'Computer Science & Cybersecurity'
  ];

  useEffect(() => {
    // Fetch users from Supabase
    const fetchUsers = async () => {
      try {
        const { data, error } = await (await import('@/lib/supabase')).supabase
          .from('role_recipients')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;

        const mappedUsers: UserRole[] = (data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department || '',
          branch: u.branch || '',
          permissions: u.permissions || [],
          isActive: u.is_active,
          lastLogin: u.last_login ? new Date(u.last_login) : undefined,
          documentsSubmitted: 0,
          documentsApproved: 0
        }));

        setUsers(mappedUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      }
    };

    fetchUsers();
  }, []);

  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;

      return matchesSearch && matchesRole && matchesDepartment;
    });
  };

  const getRoleIcon = (role: string) => {
    const template = roleTemplates.find(t => t.role === role);
    return template?.icon || User;
  };

  const getRoleColor = (role: string) => {
    const template = roleTemplates.find(t => t.role === role);
    return template?.color || 'text-gray-600';
  };

  const updateUserRole = (userId: string, newRole: string, newPermissions: string[]) => {
    setUsers(prev => prev.map(user =>
      user.id === userId
        ? { ...user, role: newRole as any, permissions: newPermissions }
        : user
    ));

    toast({
      title: "Role Updated",
      description: "User role and permissions have been updated",
    });
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(prev => prev.map(user =>
      user.id === userId ? { ...user, isActive: !user.isActive } : user
    ));
  };

  const deleteUser = (userId: string) => {
    setUsers(prev => prev.filter(user => user.id !== userId));
    toast({
      title: "User Removed",
      description: "User has been removed from the system",
    });
  };

  const filteredUsers = getFilteredUsers();
  const totalUsers = users.length;
  const activeUsers = users.filter(user => user.isActive).length;
  const roleDistribution = roleTemplates.map(template => ({
    role: template.role,
    count: users.filter(user => user.role === template.role).length,
    color: template.color
  }));

  return (
    <div className={cn("space-y-6", className)}>
      {/* Role Management Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeUsers}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-lg">
                <Settings className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roleTemplates.length}</p>
                <p className="text-sm text-muted-foreground">Role Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {roleDistribution.map((role) => {
              const RoleIcon = roleTemplates.find(t => t.role === role.role)?.icon || User;
              return (
                <div key={role.role} className="text-center p-4 border rounded-lg">
                  <div className="flex justify-center mb-2">
                    <RoleIcon className={cn("w-8 h-8", role.color)} />
                  </div>
                  <p className="text-2xl font-bold">{role.count}</p>
                  <p className="text-sm text-muted-foreground">{role.role}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="shadow-elegant">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              User Management
            </CardTitle>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">All Roles</option>
              {roleTemplates.map(template => (
                <option key={template.role} value={template.role}>{template.role}</option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Users List */}
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const RoleIcon = getRoleIcon(user.role);
              return (
                <div key={user.id} className="p-4 border rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <h4 className="font-medium">{user.name}</h4>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <RoleIcon className={cn("w-4 h-4", getRoleColor(user.role))} />
                            <Badge variant="outline">{user.role}</Badge>
                          </div>
                          {user.department && (
                            <Badge variant="secondary" className="text-xs">{user.branch}</Badge>
                          )}
                          {user.year && (
                            <Badge variant="secondary" className="text-xs">{user.year}</Badge>
                          )}
                          <Badge variant={user.isActive ? "success" : "secondary"} className="text-xs">
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm">
                        <p className="font-medium">{user.documentsSubmitted}</p>
                        <p className="text-muted-foreground">Submitted</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{user.documentsApproved}</p>
                        <p className="text-muted-foreground">Approved</p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditing(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleUserStatus(user.id)}
                        >
                          {user.isActive ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-success" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Templates */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Role Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roleTemplates.map((template) => {
              const TemplateIcon = template.icon;
              return (
                <div key={template.role} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <TemplateIcon className={cn("w-6 h-6", template.color)} />
                    <div>
                      <h4 className="font-medium">{template.displayName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {users.filter(u => u.role === template.role).length} users
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Default Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};