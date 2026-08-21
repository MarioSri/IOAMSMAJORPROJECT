import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportBlockchainEvent } from './BlockchainAuditService';
import { safeSetItem } from '@/utils/localStorageCache';

interface BypassDocument {
  id?: string;
  title: string;
  description?: string;
  document_types?: string[];
  routing_type: 'sequential' | 'parallel' | 'bidirectional';
  priority?: string;
  submitter_id: string;
  submitter_name: string;
  submitter_role?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'bypassed';
  files?: any[];
  file_assignments?: any;
  recipients?: string[];
  recipient_names?: string[];
  bypassed_recipients?: string[];
  resubmitted_recipients?: string[];
  signed_by?: string[];
  total_recipients?: number;
  signature_count?: number;
}

interface BypassWorkflowStep {
  document_id: string;
  step_order: number;
  name: string;
  assignee: string;
  recipient_id?: string;
  status?: 'pending' | 'current' | 'completed' | 'bypassed';
  completed_date?: string;
}

class SupabaseBypassService {
  private static instance: SupabaseBypassService;
  private subscriptions: Map<string, RealtimeChannel> = new Map();

  static getInstance(): SupabaseBypassService {
    if (!SupabaseBypassService.instance) {
      SupabaseBypassService.instance = new SupabaseBypassService();
    }
    return SupabaseBypassService.instance;
  }

  async createBypassDocument(document: BypassDocument) {
    const { data, error } = await supabase
      .from('bypass_documents')
      .insert([document])
      .select()
      .single();

    if (error) throw error;
    reportBlockchainEvent({
      documentId: data.id,
      action: 'SUBMITTED_WITH_BYPASS',
      workflowStep: 'Submission',
      routingType: (document.routing_type as string)?.toUpperCase() ?? null,
    }).catch(() => {});
    return data;
  }

  async getBypassDocuments(filters?: { status?: string; submitter_id?: string }) {
    let query = supabase
      .from('bypass_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.submitter_id) {
      query = query.eq('submitter_id', filters.submitter_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateBypassDocument(id: string, updates: Partial<BypassDocument>) {
    const { data, error } = await supabase
      .from('bypass_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (updates.status) {
      const bypassActionMap: Record<string, string> = {
        approved: 'BYPASS_APPROVED',
        rejected: 'BYPASS_REJECTED',
        bypassed: 'BYPASSED',
      };
      const action = bypassActionMap[updates.status] ?? 'BYPASS_UPDATED';
      reportBlockchainEvent({
        documentId: id,
        action,
        workflowStep: updates.status,
        routingType: (data.routing_type as string)?.toUpperCase() ?? null,
      }).catch(() => {});
    }
    return data;
  }

  async deleteBypassDocument(id: string) {
    const { error } = await supabase
      .from('bypass_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async createWorkflowSteps(steps: BypassWorkflowStep[]) {
    const { data, error } = await supabase
      .from('bypass_workflow_steps')
      .insert(steps)
      .select();

    if (error) throw error;
    return data;
  }

  async getWorkflowSteps(documentId: string) {
    const { data, error } = await supabase
      .from('bypass_workflow_steps')
      .select('*')
      .eq('document_id', documentId)
      .order('step_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async updateWorkflowStep(id: string, updates: Partial<BypassWorkflowStep>) {
    const { data, error } = await supabase
      .from('bypass_workflow_steps')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  subscribeToBypassDocuments(callback: (payload: any) => void, filters?: { status?: string; submitter_id?: string }): RealtimeChannel {
    const channelName = `bypass-documents-${filters?.status || 'all'}-${filters?.submitter_id || 'all'}`;
    
    if (this.subscriptions.has(channelName)) {
      this.subscriptions.get(channelName)?.unsubscribe();
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bypass_documents',
          filter: filters?.status 
            ? `status=eq.${filters.status}` 
            : (filters?.submitter_id ? `submitter_id=eq.${filters.submitter_id}` : undefined),
        },
        callback
      )
      .subscribe();

    this.subscriptions.set(channelName, channel);
    return channel;
  }

  unsubscribe(channelName: string) {
    const channel = this.subscriptions.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.subscriptions.delete(channelName);
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach((channel) => {
      channel.unsubscribe();
    });
    this.subscriptions.clear();
  }

  async syncToCache(document: any) {
    try {
      const cached = JSON.parse(localStorage.getItem('bypass-cache') || '[]');
      const index = cached.findIndex((d: any) => d.id === document.id);
      
      if (index >= 0) {
        cached[index] = document;
      } else {
        cached.unshift(document);
      }
      
      safeSetItem('bypass-cache', JSON.stringify(cached.slice(0, 25)));
    } catch (error) {
      console.warn('Cache sync failed:', error);
    }
  }

  getFromCache() {
    try {
      return JSON.parse(localStorage.getItem('bypass-cache') || '[]');
    } catch {
      return [];
    }
  }

  clearCache() {
    localStorage.removeItem('bypass-cache');
  }
}

export const supabaseBypassService = SupabaseBypassService.getInstance();
export type { BypassDocument, BypassWorkflowStep };
