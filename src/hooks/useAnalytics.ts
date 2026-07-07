import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  analyticsService,
  AnalyticsMetric,
  DepartmentStat,
  DepartmentAnalytics,
  MonthlyTrend,
  UserActivity
} from '@/services/AnalyticsService';
import { useVisibilityRefetch } from './useVisibilityRefetch';
import { safeSetItem } from '@/utils/localStorageCache';

export interface AnalyticsData {
  metrics: AnalyticsMetric[];
  departmentStats: DepartmentStat[];
  departmentAnalytics: DepartmentAnalytics[];
  monthlyTrends: MonthlyTrend[];
  userActivity: UserActivity[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
}

export interface AnalyticsActions {
  createMetric: (metric: Omit<AnalyticsMetric, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMetric: (id: string, updates: Partial<AnalyticsMetric>) => Promise<void>;
  upsertDepartmentStat: (stat: Omit<DepartmentStat, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  upsertMonthlyTrend: (trend: Omit<MonthlyTrend, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  logActivity: (activity: Omit<UserActivity, 'id' | 'created_at'>) => Promise<void>;
  refreshData: () => Promise<void>;
}

// ─── Per-user cache helpers ────────────────────────────────────────────────────
function cacheKey(type: string, userId: string) {
  return `analytics_${type}_cache_${userId}`;
}

function readAnalyticsCache<T>(type: string, userId: string): T[] {
  try {
    const raw = localStorage.getItem(cacheKey(type, userId));
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeAnalyticsCache<T>(type: string, userId: string, data: T[]): void {
  try {
    safeSetItem(cacheKey(type, userId), JSON.stringify(data.slice(0, 100)));
  } catch {
    // Ignore quota errors
  }
}
// ───────────────────────────────────────────────────────────────────────────────

export function useAnalytics(): AnalyticsData & AnalyticsActions {
  const { user } = useAuth();

  // ── Initialise from cache so the very first render already has data ──────────
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>(() =>
    user ? readAnalyticsCache<AnalyticsMetric>('metrics', user.id) : []
  );
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>(() =>
    user ? readAnalyticsCache<DepartmentStat>('deptStats', user.id) : []
  );
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>(() =>
    user ? readAnalyticsCache<DepartmentAnalytics>('deptAnalytics', user.id) : []
  );
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>(() =>
    user ? readAnalyticsCache<MonthlyTrend>('trends', user.id) : []
  );
  const [userActivity, setUserActivity] = useState<UserActivity[]>(() =>
    user ? readAnalyticsCache<UserActivity>('activity', user.id) : []
  );

  const hasCachedData = useCallback((uid: string) => {
    return (
      readAnalyticsCache('metrics', uid).length > 0 ||
      readAnalyticsCache('deptStats', uid).length > 0 ||
      readAnalyticsCache('trends', uid).length > 0
    );
  }, []);

  // Only block the UI when there is truly nothing cached to display
  const [loading, setLoading] = useState<boolean>(() =>
    user ? !hasCachedData(user.id) : true
  );
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Silent background refresh when data already exists
    const currentlyHasData =
      metrics.length > 0 || departmentStats.length > 0 || monthlyTrends.length > 0;
    if (!currentlyHasData) {
      setLoading(true);
    }
    setError(null);

    try {
      const [metricsData, deptStats, trends, activity, deptAnalytics] = await Promise.all([
        analyticsService.getMetrics(user.id),
        analyticsService.getDepartmentStats(),
        analyticsService.getMonthlyTrends(new Date().getFullYear(), user.id),
        analyticsService.getUserActivity(user.id, 50),
        analyticsService.getDepartmentAnalytics(user.id),
      ]);

      setMetrics(metricsData);
      setDepartmentStats(deptStats);
      setMonthlyTrends(trends);
      setUserActivity(activity);
      setDepartmentAnalytics(deptAnalytics);
      setIsConnected(true);

      // Persist to cache for instant next-load
      writeAnalyticsCache('metrics', user.id, metricsData);
      writeAnalyticsCache('deptStats', user.id, deptStats);
      writeAnalyticsCache('trends', user.id, trends);
      writeAnalyticsCache('activity', user.id, activity);
      writeAnalyticsCache('deptAnalytics', user.id, deptAnalytics);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps


  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch whenever returning to the tab
  useVisibilityRefetch(loadData, !!user);

  useEffect(() => {
    if (!user) return;

    // Subscribe to metrics changes
    const unsubMetrics = analyticsService.subscribeToMetrics(
      (newMetric) => {
        setMetrics((prev) => {
          const updated = [newMetric, ...prev];
          writeAnalyticsCache('metrics', user.id, updated);
          return updated;
        });
      },
      (updatedMetric) => {
        setMetrics((prev) => {
          const updated = prev.map((m) => (m.id === updatedMetric.id ? updatedMetric : m));
          writeAnalyticsCache('metrics', user.id, updated);
          return updated;
        });
      },
      (deletedId) => {
        setMetrics((prev) => {
          const updated = prev.filter((m) => m.id !== deletedId);
          writeAnalyticsCache('metrics', user.id, updated);
          return updated;
        });
      }
    );

    // Subscribe to department stats changes
    const unsubDeptStats = analyticsService.subscribeToDepartmentStats(
      (newStat) => {
        setDepartmentStats((prev) => {
          const exists = prev.find(s => s.department_name === newStat.department_name);
          const updated = exists
            ? prev.map(s => s.department_name === newStat.department_name ? newStat : s)
            : [...prev, newStat];
          writeAnalyticsCache('deptStats', user.id, updated);
          return updated;
        });
      },
      (updatedStat) => {
        setDepartmentStats((prev) => {
          const updated = prev.map((s) => (s.id === updatedStat.id ? updatedStat : s));
          writeAnalyticsCache('deptStats', user.id, updated);
          return updated;
        });
      }
    );

    // Subscribe to monthly trends changes
    const unsubTrends = analyticsService.subscribeToMonthlyTrends(
      (newTrend) => {
        setMonthlyTrends((prev) => {
          const exists = prev.find(t => t.month === newTrend.month && t.year === newTrend.year);
          const updated = exists
            ? prev.map(t => t.month === newTrend.month && t.year === newTrend.year ? newTrend : t)
            : [...prev, newTrend];
          writeAnalyticsCache('trends', user.id, updated);
          return updated;
        });
      },
      (updatedTrend) => {
        setMonthlyTrends((prev) => {
          const updated = prev.map((t) => (t.id === updatedTrend.id ? updatedTrend : t));
          writeAnalyticsCache('trends', user.id, updated);
          return updated;
        });
      },
      user.id
    );

    const unsubDeptAnalytics = analyticsService.subscribeToDepartmentAnalytics(loadData, user.id);

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubMetrics();
      unsubDeptStats();
      unsubTrends();
      unsubDeptAnalytics();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, loadData]);

  // Actions
  const createMetric = useCallback(async (metric: Omit<AnalyticsMetric, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await analyticsService.createMetric(metric);
    } catch (err) {
      console.error('Error creating metric:', err);
      throw err;
    }
  }, []);

  const updateMetric = useCallback(async (id: string, updates: Partial<AnalyticsMetric>) => {
    try {
      await analyticsService.updateMetric(id, updates);
    } catch (err) {
      console.error('Error updating metric:', err);
      throw err;
    }
  }, []);

  const upsertDepartmentStat = useCallback(async (stat: Omit<DepartmentStat, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await analyticsService.upsertDepartmentStat(stat);
    } catch (err) {
      console.error('Error upserting department stat:', err);
      throw err;
    }
  }, []);

  const upsertMonthlyTrend = useCallback(async (trend: Omit<MonthlyTrend, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await analyticsService.upsertMonthlyTrend(trend);
    } catch (err) {
      console.error('Error upserting monthly trend:', err);
      throw err;
    }
  }, []);

  const logActivity = useCallback(async (activity: Omit<UserActivity, 'id' | 'created_at'>) => {
    try {
      await analyticsService.logActivity(activity);
    } catch (err) {
      console.error('Error logging activity:', err);
      throw err;
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    metrics,
    departmentStats,
    departmentAnalytics,
    monthlyTrends,
    userActivity,
    loading,
    error,
    isConnected,
    createMetric,
    updateMetric,
    upsertDepartmentStat,
    upsertMonthlyTrend,
    logActivity,
    refreshData
  };
}
