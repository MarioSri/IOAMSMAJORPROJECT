import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { safeSetItem } from '@/utils/localStorageCache';

export interface AnalyticsMetric {
  id?: string;
  user_id: string;
  metric_type: string;
  metric_name: string;
  metric_value: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentStat {
  id?: string;
  user_id?: string;
  department_name: string;
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
  avg_processing_time: number;
  period_start: string;
  period_end: string;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlyTrend {
  id?: string;
  user_id?: string;
  month: string;
  year: number;
  documents: number;
  approved: number;
  rejected: number;
  pending: number;
  avg_time: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserActivity {
  id?: string;
  user_id: string;
  activity_type: string;
  activity_data?: Record<string, any>;
  created_at?: string;
}

export interface DepartmentAnalytics {
  department: string;
  total_received: number;
  approved: number;
  rejected: number;
  pending: number;
  approval_rate: number;
  avg_processing_time?: number;
}

class AnalyticsService {
  private channels: Map<string, RealtimeChannel> = new Map();

  // ============ Analytics Metrics ============
  async getMetrics(userId?: string): Promise<AnalyticsMetric[]> {
    try {
      let query = supabase.from('analytics_metrics').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching analytics metrics:', error);
      return this.getCachedMetrics(userId);
    }
  }

  // ============ Department Analytics (RPC) ============
  async getDepartmentAnalytics(userId: string): Promise<DepartmentAnalytics[]> {
    try {
      const { data, error } = await supabase.rpc('get_department_analytics', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error fetching department analytics:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error calling department analytics RPC:', error);
      return [];
    }
  }

  async createMetric(metric: Omit<AnalyticsMetric, 'id' | 'created_at' | 'updated_at'>): Promise<AnalyticsMetric | null> {
    try {
      const { data, error } = await supabase.from('analytics_metrics').insert(metric).select().single();
      if (error) throw error;
      this.cacheMetric(data);
      return data;
    } catch (error) {
      console.error('Error creating analytics metric:', error);
      this.cacheMetric(metric as AnalyticsMetric);
      return null;
    }
  }

  async updateMetric(id: string, updates: Partial<AnalyticsMetric>): Promise<void> {
    try {
      const { error } = await supabase.from('analytics_metrics').update(updates).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating analytics metric:', error);
    }
  }

  // ============ Department Stats ============
  async getDepartmentStats(periodStart?: string, periodEnd?: string): Promise<DepartmentStat[]> {
    try {
      let query = supabase.from('department_stats').select('*').order('department_name');
      if (periodStart && periodEnd) {
        query = query.gte('period_start', periodStart).lte('period_end', periodEnd);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching department stats:', error);
      throw error;
    }
  }

  async upsertDepartmentStat(stat: Omit<DepartmentStat, 'id' | 'created_at' | 'updated_at'>): Promise<DepartmentStat | null> {
    try {
      const { data, error } = await supabase.from('department_stats').upsert(stat, {
        onConflict: 'department_name,period_start,period_end,user_id'
      }).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error upserting department stat:', error);
      throw error;
    }
  }

  // ============ Monthly Trends ============
  async getMonthlyTrends(year?: number, userId?: string): Promise<MonthlyTrend[]> {
    try {
      let query = supabase.from('monthly_trends').select('*').order('year', { ascending: false }).order('month');
      if (year) query = query.eq('year', year);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      this.cacheMonthlyTrends(data || [], userId);
      return data || [];
    } catch (error) {
      console.error('Error fetching monthly trends:', error);
      return this.getCachedMonthlyTrends(userId);
    }
  }

  async upsertMonthlyTrend(trend: Omit<MonthlyTrend, 'id' | 'created_at' | 'updated_at'>): Promise<MonthlyTrend | null> {
    try {
      const { data, error } = await supabase.from('monthly_trends').upsert(trend, {
        onConflict: 'month,year,user_id'
      }).select().single();
      if (error) throw error;
      this.updateCachedMonthlyTrend(data, trend.user_id);
      return data;
    } catch (error) {
      console.error('Error upserting monthly trend:', error);
      this.updateCachedMonthlyTrend(trend as MonthlyTrend, trend.user_id);
      return null;
    }
  }

  // ============ User Activity ============
  async getUserActivity(userId: string, limit = 100): Promise<UserActivity[]> {
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }

  async logActivity(activity: Omit<UserActivity, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase.from('user_activity').insert(activity);
      if (error) throw error;
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }


  // ============ Real-time Subscriptions ============
  subscribeToMetrics(
    onInsert: (metric: AnalyticsMetric) => void,
    onUpdate: (metric: AnalyticsMetric) => void,
    onDelete: (id: string) => void
  ): () => void {
    const channelName = `analytics_metrics_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_metrics' }, (payload) => {
        onInsert(payload.new as AnalyticsMetric);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'analytics_metrics' }, (payload) => {
        onUpdate(payload.new as AnalyticsMetric);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'analytics_metrics' }, (payload) => {
        onDelete(payload.old.id);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  subscribeToDepartmentStats(
    onInsert: (stat: DepartmentStat) => void,
    onUpdate: (stat: DepartmentStat) => void
  ): () => void {
    const channelName = `department_stats_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'department_stats' }, (payload) => {
        onInsert(payload.new as DepartmentStat);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'department_stats' }, (payload) => {
        onUpdate(payload.new as DepartmentStat);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  subscribeToMonthlyTrends(
    onInsert: (trend: MonthlyTrend) => void,
    onUpdate: (trend: MonthlyTrend) => void,
    userId?: string
  ): () => void {
    const channelName = `monthly_trends_${userId ?? 'global'}_${Date.now()}`;
    const realtimeFilter = userId ? `user_id=eq.${userId}` : undefined;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monthly_trends', filter: realtimeFilter }, (payload) => {
        onInsert(payload.new as MonthlyTrend);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'monthly_trends', filter: realtimeFilter }, (payload) => {
        onUpdate(payload.new as MonthlyTrend);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  subscribeToDepartmentAnalytics(onRefresh: () => void, userId?: string): () => void {
    const channelName = `dept_analytics_${userId ?? 'global'}_${Date.now()}`;
    const realtimeFilter = userId ? `submitter_id=eq.${userId}` : undefined;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: realtimeFilter }, onRefresh)
      .subscribe();
    this.channels.set(channelName, channel);
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  // ============ Cache Layer (localStorage as fallback, keyed per-user) ============
  private metricsKey(userId?: string) {
    return userId ? `analytics_metrics_cache_${userId}` : 'analytics_metrics_cache';
  }
  private trendsKey(userId?: string) {
    return userId ? `monthly_trends_cache_${userId}` : 'monthly_trends_cache';
  }

  private getCachedMetrics(userId?: string): AnalyticsMetric[] {
    try {
      const cached = localStorage.getItem(this.metricsKey(userId));
      if (!cached) return [];
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }

  private cacheMetric(metric: AnalyticsMetric): void {
    try {
      const cached = this.getCachedMetrics(metric.user_id);
      cached.push(metric);
      safeSetItem(this.metricsKey(metric.user_id), JSON.stringify(cached.slice(-30)));
    } catch (error) {
      console.error('Error caching metric:', error);
    }
  }

  private getCachedMonthlyTrends(userId?: string): MonthlyTrend[] {
    try {
      const cached = localStorage.getItem(this.trendsKey(userId));
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  private cacheMonthlyTrends(trends: MonthlyTrend[], userId?: string): void {
    try {
      safeSetItem(this.trendsKey(userId), JSON.stringify(trends));
    } catch (error) {
      console.error('Error caching monthly trends:', error);
    }
  }

  private updateCachedMonthlyTrend(trend: MonthlyTrend, userId?: string): void {
    try {
      const cached = this.getCachedMonthlyTrends(userId);
      const index = cached.findIndex(t => t.month === trend.month && t.year === trend.year);
      if (index >= 0) cached[index] = trend;
      else cached.push(trend);
      this.cacheMonthlyTrends(cached, userId);
    } catch (error) {
      console.error('Error updating cached monthly trend:', error);
    }
  }
}

export const analyticsService = new AnalyticsService();
