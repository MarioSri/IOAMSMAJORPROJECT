import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { DocumentStats } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  AlertTriangle,
  Building,
  Calendar,
  Zap
} from 'lucide-react';

interface StatsWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);

      if (!userRole) return;

      // Fetch real stats from Supabase
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*');

        if (error) throw error;

        const docs = data || [];
        const byDepartment: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const byPriority: Record<string, number> = {};

        docs.forEach((d: any) => {
          if (d.submitter_department) byDepartment[d.submitter_department] = (byDepartment[d.submitter_department] || 0) + 1;
          if (d.type) byType[d.type] = (byType[d.type] || 0) + 1;
          if (d.priority) byPriority[d.priority] = (byPriority[d.priority] || 0) + 1;
        });

        setStats({
          total: docs.length,
          pending: docs.filter((d: any) => d.status === 'pending').length,
          approved: docs.filter((d: any) => d.status === 'approved').length,
          rejected: docs.filter((d: any) => d.status === 'rejected').length,
          inReview: docs.filter((d: any) => d.status === 'in-review').length,
          emergency: docs.filter((d: any) => d.is_emergency).length,
          byDepartment,
          byType,
          byPriority,
          trends: []
        });
      } catch (err) {
        console.error('[StatsWidget] Failed to fetch stats from Supabase:', err);
        setStats({
          total: 0, pending: 0, approved: 0, rejected: 0, inReview: 0, emergency: 0,
          byDepartment: {}, byType: {}, byPriority: {}, trends: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userRole]);

  const getStatsCards = () => {
    if (!stats) return [];

    const baseStats = [
      {
        title: "Total Documents",
        value: stats.total.toString(),
        change: "0%",
        icon: FileText,
        color: "text-blue-500",
        bgColor: "bg-blue-50",
        trend: "stable"
      },
      {
        title: "Pending Reviews",
        value: stats.pending.toString(),
        change: "0",
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-yellow-50",
        trend: "stable"
      },
      {
        title: "Approved",
        value: stats.approved.toString(),
        change: "0",
        icon: CheckCircle,
        color: "text-success",
        bgColor: "bg-green-50",
        trend: "stable"
      },
      {
        title: "Rejected",
        value: stats.rejected.toString(),
        change: "0",
        icon: XCircle,
        color: "text-destructive",
        bgColor: "bg-red-50",
        trend: "stable"
      }
    ];



    if (permissions?.canViewAllDepartments) {
      baseStats.push({
        title: "Departments",
        value: Object.keys(stats.byDepartment).length.toString(),
        change: "+0",
        icon: Building,
        color: "text-purple-500",
        bgColor: "bg-purple-50",
        trend: "stable"
      });
    }

    return baseStats;
  };

  const statsCards = getStatsCards();

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Dashboard Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
          )}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

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
          <TrendingUp className="w-5 h-5 text-primary" />
          Dashboard Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
        )}>
          {statsCards.map((stat, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border hover:shadow-md transition-all duration-200 animate-scale-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "rounded-full flex items-center justify-center",
                  stat.bgColor,
                  isMobile ? "p-2" : "p-3"
                )}>
                  <stat.icon className={cn(
                    stat.color,
                    isMobile ? "w-4 h-4" : "w-5 h-5"
                  )} />
                </div>
                <div className={cn(
                  "text-right",
                  stat.trend === 'up' ? 'text-success' :
                    stat.trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {stat.change}
                  </span>
                </div>
              </div>

              <div>
                <p className={cn(
                  "font-bold",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  {stat.value}
                </p>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {stat.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Role-Specific Metrics */}
        {stats && (userRole === 'principal' || userRole === 'registrar') && (
          <div className="mt-6 pt-4 border-t">
            <h4 className={cn(
              "font-semibold mb-3",
              isMobile ? "text-sm" : "text-base"
            )}>
              Department Overview
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats.byDepartment).slice(0, 4).map(([dept, count]) => (
                <div key={dept} className="text-center p-2 bg-muted/30 rounded">
                  <p className={cn(
                    "font-bold",
                    isMobile ? "text-lg" : "text-xl"
                  )}>
                    {count}
                  </p>
                  <p className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {dept}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};