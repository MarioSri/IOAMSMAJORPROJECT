import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSupabaseApprovals } from '@/hooks/useSupabaseApprovals';
import { useSupabaseTrackDocuments } from '@/hooks/useSupabaseTrackDocuments';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  ArrowRight,
  Activity,
  Eye
} from 'lucide-react';

interface AnalyticsData {
  documentStats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    avgProcessingTime: number;
  };
  departmentStats: Array<{
    name: string;
    documents: number;
    approvalRate: number;
    avgTime: number;
  }>;
  trends: Array<{
    period: string;
    documents: number;
    approvals: number;
    rejections: number;
  }>;
  userActivity: {
    activeUsers: number;
    documentsToday: number;
    approvalsToday: number;
    peakHours: string;
  };
}

interface AnalyticsWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const AnalyticsWidget: React.FC<AnalyticsWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const { approvalCards } = useSupabaseApprovals();
  const { trackDocuments } = useSupabaseTrackDocuments();
  const { departmentStats, monthlyTrends, isConnected } = useAnalytics();
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const allDocs = [...trackDocuments, ...approvalCards];
    const approved = allDocs.filter(d => d.status === 'approved').length;
    const rejected = allDocs.filter(d => d.status === 'rejected').length;
    const pending = allDocs.filter(d => d.status === 'pending').length;

    const completedDocs = allDocs.filter(d => d.status === 'approved' || d.status === 'rejected');
    let avgTime = 0;
    if (completedDocs.length > 0) {
      const totalTime = completedDocs.reduce((sum, doc) => {
        const submitted = new Date(doc.submittedDate || Date.now());
        const completed = new Date(doc.updated_at || Date.now());
        return sum + (completed.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgTime = totalTime / completedDocs.length;
    }

    const deptStatsFormatted = departmentStats.map(stat => ({
      name: stat.department_name,
      documents: stat.submitted,
      approvalRate: stat.submitted > 0 ? (stat.approved / stat.submitted) * 100 : 0,
      avgTime: stat.avg_processing_time
    }));

    const trendsFormatted = monthlyTrends.slice(-4).map(trend => ({
      period: `${trend.month} ${trend.year}`,
      documents: trend.documents,
      approvals: trend.approved,
      rejections: trend.rejected
    }));

    setAnalytics({
      documentStats: {
        total: allDocs.length,
        approved,
        rejected,
        pending,
        avgProcessingTime: avgTime
      },
      departmentStats: deptStatsFormatted,
      trends: trendsFormatted,
      userActivity: {
        activeUsers: 0,
        documentsToday: allDocs.filter(d => new Date(d.submittedDate || '').toDateString() === new Date().toDateString()).length,
        approvalsToday: allDocs.filter(d => d.status === 'approved' && new Date(d.updated_at || '').toDateString() === new Date().toDateString()).length,
        peakHours: 'Initial'
      }
    });
  }, [trackDocuments, approvalCards, departmentStats, monthlyTrends]);

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, direction: 'stable' as const };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'stable' as const
    };
  };

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const totalDocs = analytics.documentStats.total;
  const approvalRate = totalDocs > 0 ? (analytics.documentStats.approved / totalDocs) * 100 : 0;
  const rejectionRate = totalDocs > 0 ? (analytics.documentStats.rejected / totalDocs) * 100 : 0;

  return (
    <Card className={cn(
      "shadow-elegant hover:shadow-glow transition-all duration-300",
      isSelected && "border-primary",
      isCustomizing && "cursor-pointer"
    )} onClick={onSelect}>
      <CardHeader className={cn(isMobile && "pb-3")}>
        <div className={cn(
          "flex justify-between",
          isMobile ? "flex-col gap-3" : "items-center"
        )}>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <BarChart3 className="w-5 h-5 text-primary" />
            Analytics
          </CardTitle>

          <div className={cn(
            "flex items-center gap-2",
            isMobile && "w-full justify-between"
          )}>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/analytics")}
              className={cn(isMobile && "text-xs")}
            >
              <Eye className="w-4 h-4 mr-1" />
              Details
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className={cn(
                "font-medium text-success",
                isMobile ? "text-sm" : "text-base"
              )}>
                Approval Rate
              </span>
            </div>
            <p className={cn(
              "font-bold text-success",
              isMobile ? "text-xl" : "text-2xl"
            )}>
              {approvalRate.toFixed(1)}%
            </p>
            <div className="flex items-center gap-1 mt-1">

            </div>
          </div>

          <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-warning" />
              <span className={cn(
                "font-medium text-warning",
                isMobile ? "text-sm" : "text-base"
              )}>
                Avg. Time
              </span>
            </div>
            <p className={cn(
              "font-bold text-warning",
              isMobile ? "text-xl" : "text-2xl"
            )}>
              {analytics.documentStats.avgProcessingTime}d
            </p>
            <div className="flex items-center gap-1 mt-1">

            </div>
          </div>
        </div>

        {/* Department Performance */}
        {analytics.departmentStats.length > 0 && (
          <div>
            <h4 className={cn(
              "font-semibold mb-2",
              isMobile ? "text-sm" : "text-base"
            )}>
              Top Performing Departments
            </h4>
            <div className="space-y-2">
              {analytics.departmentStats
                .sort((a, b) => b.approvalRate - a.approvalRate)
                .slice(0, 3)
                .map((dept, index) => (
                  <div
                    key={dept.name}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className={cn(
                        "font-medium",
                        isMobile ? "text-sm" : "text-base"
                      )}>
                        {dept.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-bold text-success",
                        isMobile ? "text-sm" : "text-base"
                      )}>
                        {dept.approvalRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dept.documents} docs
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recent Trends */}
        <div>
          <h4 className={cn(
            "font-semibold mb-2",
            isMobile ? "text-sm" : "text-base"
          )}>
            Recent Trends
          </h4>
          <div className="space-y-2">
            {analytics.trends.slice(-3).map((trend, index) => {
              const approvalRate = (trend.approvals / trend.documents) * 100;
              return (
                <div
                  key={trend.period}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                >
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    {trend.period}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-muted-foreground",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      {trend.documents} docs
                    </span>
                    <Badge
                      variant={approvalRate >= 90 ? "success" : approvalRate >= 80 ? "default" : "warning"}
                      className="text-xs"
                    >
                      {approvalRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User Activity */}
        {analytics.userActivity.documentsToday > 0 && (
          <div className="pt-2 border-t">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-2 bg-primary/10 rounded">
                <p className={cn(
                  "font-bold text-primary",
                  isMobile ? "text-lg" : "text-xl"
                )}>
                  {analytics.userActivity.activeUsers}
                </p>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Active Users
                </p>
              </div>
              <div className="p-2 bg-success/10 rounded">
                <p className={cn(
                  "font-bold text-success",
                  isMobile ? "text-lg" : "text-xl"
                )}>
                  {analytics.userActivity.documentsToday}
                </p>
                <p className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Today's Docs
                </p>
              </div>
            </div>

            <div className="mt-2 p-2 bg-muted/30 rounded text-center">
              <p className="text-xs text-muted-foreground">
                Peak Activity: {analytics.userActivity.peakHours}
              </p>
            </div>
          </div>
        )}

        {/* Widget Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>{isConnected ? 'Supabase Live' : 'Cached'}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/analytics")}
          >
            Full Report
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};