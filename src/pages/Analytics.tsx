import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, FileText, Clock, CheckCircle2, XCircle, Calendar, Trophy, Award, Medal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseApprovals } from "@/hooks/useSupabaseApprovals";
import { useSupabaseTrackDocuments } from "@/hooks/useSupabaseTrackDocuments";
import { useAnalytics } from "@/hooks/useAnalytics";
import { supabase } from "@/lib/supabase";
import { computeModuleStats, rankModules, type TopPerformer } from "@/utils/topPerformersAnalytics";
import { useState, useEffect, useRef } from "react";

export default function Analytics() {
  const { user } = useAuth();
  const { approvalCards = [], loading: approvalsLoading } = useSupabaseApprovals();
  const { trackDocuments = [], loading: docsLoading } = useSupabaseTrackDocuments();
  const docsConnected = !approvalsLoading && !docsLoading;
  const { monthlyTrends, departmentAnalytics, loading: analyticsLoading, error: analyticsError, isConnected: analyticsConnected, upsertMonthlyTrend, upsertDepartmentStat } = useAnalytics();

  // ── Analytics-only Supabase state ────────────────────────────────────────────
  // Fetched via direct queries (no user scoping, no localStorage fallback).
  // Empty array on error so Top Performers shows N/A rather than stale cache.
  const [analyticsDocuments, setAnalyticsDocuments] = useState<any[]>([]);
  const [analyticsEmergencyDocs, setAnalyticsEmergencyDocs] = useState<any[]>([]);
  const [analyticsBypassDocs, setAnalyticsBypassDocs] = useState<any[]>([]);

  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);

  const [metrics, setMetrics] = useState({
    totalDocuments: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    avgProcessingTime: 0,
    todayDocuments: 0,
    activeSessions: 0,
    completedToday: 0,
  });

  const [weeklyMetrics, setWeeklyMetrics] = useState({
    docsThisWeek: 0,
    docsLastWeek: 0,
    signaturesThisWeek: 0,
    signaturesLastWeek: 0,
  });

  const [performanceMetrics, setPerformanceMetrics] = useState({
    fastestApprovalHours: 0 as number | null,
    longestProcessingDays: 0 as number | null,
    firstTimeApprovalRate: 0,
  });

  // Track last upserted values to avoid redundant Supabase writes
  const lastUpsertRef = useRef<string>('');
  const lastDeptUpsertRef = useRef<string>('');

  // ── Dedicated real-time fetch for Top Performers ──────────────────────────────
  // Queries all three module tables directly from Supabase.
  // Access scope is enforced purely by RLS — no client-side user filter.
  // On any Supabase error the state stays as an empty array; localStorage is
  // never read or written in this path.
  useEffect(() => {
    if (!user) return;

    const DOC_FIELDS = 'id,status,created_at,updated_at,submitted_date,is_emergency,source';
    const MIN_FIELDS = 'id,status,created_at,updated_at,submitted_date';

    const fetchTopPerformersData = async () => {
      const [docsRes, emgRes, bypassRes] = await Promise.all([
        supabase.from('documents').select(DOC_FIELDS).eq('submitter_id', user.id).order('created_at', { ascending: false }),
        supabase.from('emergency_documents').select(MIN_FIELDS).eq('submitter_id', user.id).order('created_at', { ascending: false }),
        supabase.from('bypass_documents').select(MIN_FIELDS).eq('submitter_id', user.id).order('created_at', { ascending: false }),
      ]);
      if (!docsRes.error) setAnalyticsDocuments(docsRes.data ?? []);
      if (!emgRes.error) setAnalyticsEmergencyDocs(emgRes.data ?? []);
      if (!bypassRes.error) setAnalyticsBypassDocs(bypassRes.data ?? []);
    };

    fetchTopPerformersData();

    // Subscribe to each table scoped to this user
    const channel = supabase
      .channel(`top-performers-realtime-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `submitter_id=eq.${user.id}` }, fetchTopPerformersData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_documents', filter: `submitter_id=eq.${user.id}` }, (payload: any) => {
        // Client-side guard as defence-in-depth
        if (payload.new?.submitter_id && payload.new.submitter_id !== user.id) return;
        fetchTopPerformersData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bypass_documents', filter: `submitter_id=eq.${user.id}` }, (payload: any) => {
        if (payload.new?.submitter_id && payload.new.submitter_id !== user.id) return;
        fetchTopPerformersData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const isConnected = docsConnected || analyticsConnected;

  useEffect(() => {
    // ── 1. Deduplicate: a document can appear in both trackDocuments and approvalCards
    const seenIds = new Set<string>();
    const allDocs = [...trackDocuments, ...approvalCards].filter(d => {
      if (!d.id || seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });

    const approved = allDocs.filter(d => d.status === 'approved').length;
    const rejected = allDocs.filter(d => d.status === 'rejected').length;
    const pending = allDocs.filter(d => d.status === 'pending').length;

    const today = new Date();
    const todayStr = today.toDateString();
    const todayDocs = allDocs.filter(d => {
      const date = d.submittedDate || d.submitted_date || d.created_at || '';
      return date && new Date(date).toDateString() === todayStr;
    }).length;

    // ── 2. Completed Tasks today (approved or rejected today)
    const completedToday = allDocs.filter(d => {
      if (d.status !== 'approved' && d.status !== 'rejected') return false;
      const date = d.updated_at || '';
      return date && new Date(date).toDateString() === todayStr;
    }).length;

    // ── 3. Avg processing time + performance metrics
    const completedDocs = allDocs.filter(d => d.status === 'approved' || d.status === 'rejected');
    let avgTime = 0;
    let fastestMs: number | null = null;
    let longestMs: number | null = null;
    if (completedDocs.length > 0) {
      const times = completedDocs.map(doc => {
        const submitted = new Date(doc.submittedDate || doc.submitted_date || doc.created_at || Date.now());
        const completed = new Date(doc.updated_at || Date.now());
        return Math.max(0, completed.getTime() - submitted.getTime());
      });
      const totalTime = times.reduce((s, t) => s + t, 0);
      avgTime = totalTime / completedDocs.length / (1000 * 60 * 60 * 24);
      fastestMs = Math.min(...times);
      longestMs = Math.max(...times);
    }
    setPerformanceMetrics({
      fastestApprovalHours: fastestMs !== null ? Math.round(fastestMs / (1000 * 60 * 60)) : null,
      longestProcessingDays: longestMs !== null ? parseFloat((longestMs / (1000 * 60 * 60 * 24)).toFixed(1)) : null,
      firstTimeApprovalRate: allDocs.length > 0 ? parseFloat(((approved / allDocs.length) * 100).toFixed(1)) : 0,
    });

    // ── 4. Weekly metrics
    const now = today.getTime();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const startOfThisWeek = now - dayOfWeek * 86400000;
    const startOfLastWeek = startOfThisWeek - 7 * 86400000;
    const thisWeekDocs = allDocs.filter(d => {
      const date = d.submittedDate || d.submitted_date || d.created_at || '';
      const t = date ? new Date(date).getTime() : 0;
      return t >= startOfThisWeek;
    });
    const lastWeekDocs = allDocs.filter(d => {
      const date = d.submittedDate || d.submitted_date || d.created_at || '';
      const t = date ? new Date(date).getTime() : 0;
      return t >= startOfLastWeek && t < startOfThisWeek;
    });
    setWeeklyMetrics({
      docsThisWeek: thisWeekDocs.length,
      docsLastWeek: lastWeekDocs.length,
      signaturesThisWeek: thisWeekDocs.filter(d => d.status === 'approved').length,
      signaturesLastWeek: lastWeekDocs.filter(d => d.status === 'approved').length,
    });

    setMetrics({
      totalDocuments: allDocs.length,
      approved,
      rejected,
      pending,
      avgProcessingTime: avgTime,
      todayDocuments: todayDocs,
      activeSessions: pending,
      completedToday,
    });

    if (user && allDocs.length > 0) {
      const currentMonth = new Date().toLocaleString('default', { month: 'short' });
      const currentYear = new Date().getFullYear();

      // ── 5. Guard: only write to Supabase if key values actually changed
      const upsertKey = `${currentMonth}-${currentYear}-${allDocs.length}-${approved}-${rejected}-${pending}-${avgTime.toFixed(2)}`;
      if (upsertKey !== lastUpsertRef.current) {
        lastUpsertRef.current = upsertKey;
        upsertMonthlyTrend({
          user_id: user.id,
          month: currentMonth,
          year: currentYear,
          documents: allDocs.length,
          approved,
          rejected,
          pending,
          avg_time: avgTime
        }).catch(console.error);
      }

      // ── 6. Auto-populate department_stats by department to record current view in Supabase table
      if (departmentAnalytics && departmentAnalytics.length > 0) {
        const monthNum = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        departmentAnalytics.forEach(dept => {
          const deptKey = `dept_${user.id}_${dept.department}_${monthNum}_${currentYear}_${dept.total_received}_${dept.approved}`;
          if (lastDeptUpsertRef.current.includes(deptKey)) return;

          // Calculate current month period
          const period_start = new Date(currentYear, monthNum - 1, 1).toISOString();
          const period_end = new Date(currentYear, monthNum, 0, 23, 59, 59, 999).toISOString();

          upsertDepartmentStat({
            user_id: user.id,
            department_name: dept.department,
            submitted: dept.total_received,
            approved: dept.approved,
            rejected: dept.rejected,
            pending: dept.pending,
            avg_processing_time: dept.avg_processing_time || 0,
            period_start,
            period_end
          }).catch(console.error);

          lastDeptUpsertRef.current += `|${deptKey}`;
        });
      }
    }
    // ── 7. Top Performers: rank Document Management, Emergency, Approval Chain with Bypass
    //
    // Documents from trackDocuments / approvalCards are tagged with a `source` field
    // (document-management, emergency-management, approval-chain-bypass) or
    // with `is_emergency = true`. Emergency and bypass docs also live in their own
    // dedicated Supabase tables which are fetched by the specialised hooks.
    //
    // Emergency Management docs: either from the emergency_documents table (emergencyDocuments)
    //   OR regular docs with is_emergency === true.
    // Approval Chain with Bypass docs: from bypass_documents table (bypassDocuments)
    //   OR regular docs with source === 'approval-chain-bypass'.
    // Document Management docs: regular docs that are neither emergency nor bypass.

    // ── 7. Top Performers — use analytics-specific Supabase data ─────────────────
    // analyticsDocuments / analyticsEmergencyDocs / analyticsBypassDocs are populated
    // by the dedicated useEffect above via direct Supabase queries with no localStorage
    // fallback. On Supabase error they remain empty arrays, producing N/A scores.

    // Document Management: rows in `documents` that are NOT emergency and NOT bypass
    const docMgmtDocs = analyticsDocuments.filter(d => {
      if (d.is_emergency) return false;
      const src = (d.source || '').toLowerCase();
      return src !== 'emergency-management' && src !== 'approval-chain-bypass';
    });

    // Emergency: normalise terminal statuses so scoring treats 'resolved'/'acknowledged' as 'approved'
    const normalisedEmergency = analyticsEmergencyDocs.map(d =>
      (d.status === 'resolved' || d.status === 'acknowledged') ? { ...d, status: 'approved' } : d
    );

    // Approval Chain with Bypass: normalise 'bypassed' → 'approved' for scoring
    const normalisedBypass = analyticsBypassDocs.map(d =>
      d.status === 'bypassed' ? { ...d, status: 'approved' } : d
    );

    const ranked = rankModules([
      { name: 'Document Management', stats: computeModuleStats(docMgmtDocs) },
      { name: 'Emergency Management', stats: computeModuleStats(normalisedEmergency) },
      { name: 'Approval Chain with Bypass', stats: computeModuleStats(normalisedBypass) },
    ]);
    setTopPerformers(ranked);
  }, [trackDocuments, approvalCards, analyticsDocuments, analyticsEmergencyDocs, analyticsBypassDocs, user, upsertMonthlyTrend]);

  useEffect(() => {
    const handleUpdate = () => {
      // Deduplicate on event-triggered updates as well
      const seenIds = new Set<string>();
      const allDocs = [...trackDocuments, ...approvalCards].filter(d => {
        if (!d.id || seenIds.has(d.id)) return false;
        seenIds.add(d.id);
        return true;
      });
      const approved = allDocs.filter(d => d.status === 'approved').length;
      const rejected = allDocs.filter(d => d.status === 'rejected').length;
      const pending = allDocs.filter(d => d.status === 'pending').length;

      setMetrics(prev => ({
        ...prev,
        totalDocuments: allDocs.length,
        approved,
        rejected,
        pending
      }));
    };

    window.addEventListener('document-submitted', handleUpdate);
    window.addEventListener('document-approved', handleUpdate);
    window.addEventListener('document-rejected', handleUpdate);
    window.addEventListener('workflow-updated', handleUpdate);

    return () => {
      window.removeEventListener('document-submitted', handleUpdate);
      window.removeEventListener('document-approved', handleUpdate);
      window.removeEventListener('document-rejected', handleUpdate);
      window.removeEventListener('workflow-updated', handleUpdate);
    };
  }, [trackDocuments, approvalCards]);

  if (!user) return null;

  // ── Department analytics: Uses RPC function to get real department-based statistics
  // Maps recipient departments (from role_recipients) to document counts.
  // Real-time updates via useAnalytics hook subscription.
  const deptStatsFormatted = departmentAnalytics.map(dept => ({
    name: dept.department,
    submitted: Number(dept.total_received),
    approved: Number(dept.approved),
    rejected: Number(dept.rejected),
    pending: Number(dept.pending),
  }));

  const trendsFormatted = monthlyTrends.map(trend => ({
    month: trend.month,
    documents: trend.documents,
    approved: trend.approved,
    rejected: trend.rejected,
    avgTime: trend.avg_time
  }));

  return (
    <ResponsiveLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">

        <div className="flex flex-col gap-2 mb-2 sm:mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Comprehensive insights into document workflow performance</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="shadow-sm border-muted/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-primary/10 rounded-lg shrink-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-2xl font-bold truncate">{metrics.totalDocuments}</p>
                    {isConnected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" title="Live"></div>}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Documents</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-[10px] sm:text-xs text-success font-medium">Live Updates</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-success/10 rounded-lg shrink-0">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-2xl font-bold truncate">{metrics.approved}</p>
                    {isConnected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" title="Live"></div>}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Approved</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{metrics.totalDocuments > 0 ? ((metrics.approved / metrics.totalDocuments) * 100).toFixed(1) : 0}% rate</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-warning/10 rounded-lg shrink-0">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-2xl font-bold truncate">{metrics.avgProcessingTime.toFixed(1)}</p>
                    {isConnected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" title="Live"></div>}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Avg. Days</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Processing time</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-destructive/10 rounded-lg shrink-0">
                  <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-2xl font-bold truncate">{metrics.rejected}</p>
                    {isConnected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" title="Live"></div>}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Rejected</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{metrics.totalDocuments > 0 ? ((metrics.rejected / metrics.totalDocuments) * 100).toFixed(1) : 0}% rate</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto overflow-y-hidden hide-scrollbar justify-start xs:justify-center sm:grid sm:grid-cols-4 h-auto p-1.5 bg-muted/30 backdrop-blur-md border border-muted/20 rounded-xl gap-1 shadow-sm">
            <TabsTrigger
              value="overview"
              className="flex-shrink-0 xs:flex-1 py-2.5 px-4 rounded-lg transition-all duration-300 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-elegant font-semibold text-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="flex-shrink-0 xs:flex-1 py-2.5 px-4 rounded-lg transition-all duration-300 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-elegant font-semibold text-sm"
            >
              Departments
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="flex-shrink-0 xs:flex-1 py-2.5 px-4 rounded-lg transition-all duration-300 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-elegant font-semibold text-sm"
            >
              Trends
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="flex-shrink-0 xs:flex-1 py-2.5 px-4 rounded-lg transition-all duration-300 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-elegant font-semibold text-sm"
            >
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Document Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm">Approved</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="w-16 xs:w-24 sm:w-32 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-success h-2 rounded-full" style={{ width: `${metrics.totalDocuments > 0 ? (metrics.approved / metrics.totalDocuments * 100) : 0}%` }}></div>
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">{metrics.totalDocuments > 0 ? (metrics.approved / metrics.totalDocuments * 100).toFixed(1) : "0"}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm">Rejected</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="w-16 xs:w-24 sm:w-32 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-destructive h-2 rounded-full" style={{ width: `${metrics.totalDocuments > 0 ? (metrics.rejected / metrics.totalDocuments * 100) : 0}%` }}></div>
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">{metrics.totalDocuments > 0 ? (metrics.rejected / metrics.totalDocuments * 100).toFixed(1) : "0"}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm">Pending</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="w-16 xs:w-24 sm:w-32 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-warning h-2 rounded-full" style={{ width: `${metrics.totalDocuments > 0 ? (metrics.pending / metrics.totalDocuments * 100) : 0}%` }}></div>
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">{metrics.totalDocuments > 0 ? (metrics.pending / metrics.totalDocuments * 100).toFixed(1) : "0"}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Performers
                  </CardTitle>
                  <CardDescription>Based On Workflow Metric</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topPerformers.map(performer => (
                      <div key={performer.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="hidden xs:inline-flex shrink-0">#{performer.rank}</Badge>
                          <span className="text-sm truncate">{performer.name}</span>
                        </div>
                        <span
                          className="text-sm font-semibold shrink-0"
                          title={performer.label !== 'N/A'
                            ? `Success: ${performer.breakdown.successRate}% · Speed: ${performer.breakdown.speedScore}% · Volume: ${performer.breakdown.volumeScore}%`
                            : 'No data available'}
                        >
                          {performer.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="departments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Department-Wise Analytics</CardTitle>
                <CardDescription>Document Submission And Approval Statistics By Department</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading department analytics...</p>
                  </div>
                ) : analyticsError ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-destructive mb-2">Error loading department analytics</p>
                    <p className="text-xs text-muted-foreground">{analyticsError}</p>
                  </div>
                ) : deptStatsFormatted.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No department data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Submit documents to recipients to see analytics</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deptStatsFormatted.map((dept) => (
                      <div key={dept.name} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{dept.name}</h3>
                          <Badge variant="outline">{dept.submitted} total</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span>{dept.approved} Approved</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span>{dept.rejected} Rejected</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-warning" />
                            <span>{dept.pending} Pending</span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-success h-2 rounded-full"
                              style={{ width: `${dept.submitted > 0 ? (dept.approved / dept.submitted) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dept.submitted > 0 ? ((dept.approved / dept.submitted) * 100).toFixed(1) : '0'}% approval rate
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Today's Trends
                </CardTitle>
                <CardDescription>Real-time activity for today ({new Date().toLocaleDateString()})</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">Documents Today</h4>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0"></div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.todayDocuments}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{metrics.approved} approved, {metrics.pending} pending</p>
                  </div>
                  <div className="p-3 sm:p-4 border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Documents</h4>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shrink-0"></div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.activeSessions}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Awaiting action</p>
                  </div>
                  <div className="p-3 sm:p-4 border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">Completed Today</h4>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted'}`}></div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.completedToday}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Approved / rejected today</p>
                  </div>
                  <div className="p-3 sm:p-4 border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">System Uptime</h4>
                      <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">—</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Operational status</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Weekly Trends
                </CardTitle>
                <CardDescription>Current week vs previous week comparison</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Documents Processed</h4>
                      {weeklyMetrics.docsThisWeek > weeklyMetrics.docsLastWeek ? (
                        <Badge variant="secondary" className="text-green-600 bg-green-50">
                          ↑ {weeklyMetrics.docsLastWeek > 0 ? Math.round(((weeklyMetrics.docsThisWeek - weeklyMetrics.docsLastWeek) / weeklyMetrics.docsLastWeek) * 100) : 0}%
                        </Badge>
                      ) : weeklyMetrics.docsThisWeek < weeklyMetrics.docsLastWeek ? (
                        <Badge variant="secondary" className="text-red-600 bg-red-50">
                          ↓ {weeklyMetrics.docsLastWeek > 0 ? Math.round(((weeklyMetrics.docsLastWeek - weeklyMetrics.docsThisWeek) / weeklyMetrics.docsLastWeek) * 100) : 0}%
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">→ 0%</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{weeklyMetrics.docsThisWeek}</p>
                    <p className="text-xs text-muted-foreground">vs {weeklyMetrics.docsLastWeek} last week</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Meetings Scheduled</h4>
                      <Badge variant="secondary" className="text-muted-foreground">—</Badge>
                    </div>
                    <p className="text-2xl font-bold">—</p>
                    <p className="text-xs text-muted-foreground">No meetings data source</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Approvals This Week</h4>
                      {weeklyMetrics.signaturesThisWeek >= weeklyMetrics.signaturesLastWeek ? (
                        <Badge variant="secondary" className="text-green-600 bg-green-50">
                          ↑ {weeklyMetrics.signaturesLastWeek > 0 ? Math.round(((weeklyMetrics.signaturesThisWeek - weeklyMetrics.signaturesLastWeek) / weeklyMetrics.signaturesLastWeek) * 100) : 0}%
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-red-600 bg-red-50">
                          ↓ {weeklyMetrics.signaturesLastWeek > 0 ? Math.round(((weeklyMetrics.signaturesLastWeek - weeklyMetrics.signaturesThisWeek) / weeklyMetrics.signaturesLastWeek) * 100) : 0}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{weeklyMetrics.signaturesThisWeek}</p>
                    <p className="text-xs text-muted-foreground">vs {weeklyMetrics.signaturesLastWeek} last week</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Active Users</h4>
                      <Badge variant="secondary" className="text-muted-foreground">—</Badge>
                    </div>
                    <p className="text-2xl font-bold">—</p>
                    <p className="text-xs text-muted-foreground">No user session data source</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Monthly Trends
                </CardTitle>
                <CardDescription>Document submission and processing trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trendsFormatted.map((month) => (
                    <div key={month.month} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{month.month} 2024</h3>
                        <Badge variant="outline">{month.documents} documents</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3 sm:gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Approved</p>
                          <p className="font-medium">{month.approved}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rejected</p>
                          <p className="font-medium">{month.rejected}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg. Processing</p>
                          <span className="text-sm font-medium whitespace-nowrap">{month.avgTime.toFixed(1)} days</span>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success Rate</p>
                          <p className="font-medium">{((month.approved / month.documents) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="shadow-sm border-muted/20">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl">System Performance Metrics</CardTitle>
                <CardDescription className="text-sm">Key performance indicators for workflow efficiency</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Processing Times</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Average Processing Time</span>
                        <span className="font-medium">{metrics.avgProcessingTime.toFixed(1)} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Fastest Approval</span>
                        <span className="font-medium">
                          {performanceMetrics.fastestApprovalHours !== null && metrics.approved > 0
                            ? `${performanceMetrics.fastestApprovalHours} hours`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Longest Processing</span>
                        <span className="font-medium">
                          {performanceMetrics.longestProcessingDays !== null && (metrics.approved + metrics.rejected) > 0
                            ? `${performanceMetrics.longestProcessingDays} days`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold">Quality Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">First-time Approval Rate</span>
                        <span className="font-medium">
                          {metrics.totalDocuments > 0 ? `${performanceMetrics.firstTimeApprovalRate}%` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Resubmission Rate</span>
                        <span className="font-medium">—</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">User Satisfaction</span>
                        <span className="font-medium">—</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveLayout>
  );
}