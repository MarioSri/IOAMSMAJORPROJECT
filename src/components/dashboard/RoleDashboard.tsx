import React, { useState, useEffect } from 'react';
import { DynamicDashboard } from './DynamicDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { getDashboardConfig } from '@/config/roleConfigs';
import { cn } from '@/lib/utils';
import { userProfileService } from '@/services/UserProfileService';
import {
  Crown,
  Shield,
  Users,
  Building,
  User
} from 'lucide-react';

interface ProfileData {
  name?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
}

export const RoleDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const emailKey = user.email;
        const profile = emailKey
          ? await userProfileService.fetchProfileByEmail(emailKey)
          : await userProfileService.fetchProfile(user.id);

        if (profile) {
          setProfileData({
            name: profile.name,
            department: profile.department,
            designation: profile.designation || profile.role,
            employeeId: profile.employee_id || profile.id
          });
        } else {
          setProfileData({
            name: '',
            department: '',
            designation: '',
            employeeId: ''
          });
        }
      } catch (error) {
        console.error('❌ [RoleDashboard] Error loading profile:', error);
        setError('Failed to load profile data');
        setProfileData(prev => prev ?? { name: '', department: '', designation: '', employeeId: '' });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id, user?.email]);

  if (!user) return null;

  const dashboardConfig = getDashboardConfig(user.role, user.department, user.branch);

  const getRoleIcon = () => {
    switch (user.role) {
      case 'principal': return Crown;
      case 'registrar': return Shield;
      case 'program-head': return Users;
      case 'hod': return Building;
      default: return User;
    }
  };

  const RoleIcon = getRoleIcon();

  const getRoleDescription = () => {
    switch (user.role) {
      case 'principal':
        return 'Complete institutional oversight with full administrative control, mass distribution capabilities, and system-wide analytics.';
      case 'registrar':
        return 'Academic administration with document approval authority, workflow management, and cross-departmental coordination.';
      case 'program-head':
        return `Program-specific management for ${user.branch || 'department'} with focused approval workflows and academic scheduling.`;
      case 'hod':
        return `Department leadership for ${user.department} with faculty management, document approvals, and departmental analytics.`;
      default:
        return 'Document submission and tracking with personal task management and communication tools.';
    }
  };

  const getEnabledFeatures = () => {
    return Object.entries(dashboardConfig.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
  };

  const enabledFeatures = getEnabledFeatures();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Role Welcome Banner */}
      <Card className="shadow-elegant bg-gradient-primary text-primary-foreground border-0">
        <CardContent className={cn("p-6", isMobile && "p-4")}>
          <div className={cn(
            "flex gap-4",
            isMobile ? "flex-col items-center text-center" : "items-center"
          )}>
            <div className={cn(
              "rounded-full bg-white/20 flex items-center justify-center shadow-lg shrink-0",
              isMobile ? "w-16 h-16" : "w-16 h-16" // Keep large icon on mobile for visual impact
            )}>
              <RoleIcon className={cn(
                "text-white",
                isMobile ? "w-8 h-8" : "w-8 h-8"
              )} />
            </div>

            <div className="flex-1">
              <h1 className={cn(
                "font-bold leading-tight",
                isMobile ? "text-xl" : "text-2xl"
              )}>
                Welcome to IAOMS Dashboard
              </h1>
              <p className={cn(
                "opacity-90 mt-1",
                isMobile ? "text-sm" : "text-base"
              )}>
                {profileData?.name
                  ? <>Logged in as <span className="font-semibold">{profileData.name}</span></>
                  : <span className="opacity-70">Loading profile...</span>
                }
              </p>
              <div className={cn(
                "flex flex-wrap gap-2 mt-3",
                isMobile ? "justify-center" : "justify-start"
              )}>
                <Badge className="bg-white/20 text-white border-white/30 font-medium">
                  Role: {dashboardConfig.displayName}
                </Badge>
                {profileData?.department && (
                  <Badge className="bg-white/20 text-white border-white/30">
                    {profileData.department}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Role Description */}
          {/* Role Description - Hidden on Mobile */}
          {!isMobile && (
            <div className="mt-4 p-4 bg-white/10 rounded-lg">
              <p className="opacity-90 text-base">
                {getRoleDescription()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Dynamic Dashboard */}
      <DynamicDashboard />
    </div>
  );
};
