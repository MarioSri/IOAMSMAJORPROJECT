import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportBlockchainEvent } from './BlockchainAuditService';
import { safeSetItem } from '@/utils/localStorageCache';

function deriveEmergencyRoutingType(doc: {
  bypass_mode?: boolean;
  use_smart_delivery?: boolean;
  auto_escalation?: boolean;
}): string {
  if (doc.bypass_mode) return 'BYPASS';
  if (doc.use_smart_delivery) return 'PARALLEL';
  if (doc.auto_escalation) return 'AUTOFORWARD';
  return 'SEQUENTIAL';
}

interface EmergencyDocument {
  id?: string;
  title: string;
  description: string;
  reason?: string;
  urgency_level: 'medium' | 'urgent' | 'high' | 'critical';
  submitter_id: string;
  submitter_name: string;
  submitter_role?: string;
  status?: 'submitted' | 'acknowledged' | 'resolved' | 'rejected' | 'escalated';
  document_types?: string[];
  files?: any[];
  recipients?: string[];
  recipient_names?: string[];
  auto_escalation?: boolean;
  escalation_timeout?: number;
  escalation_time_unit?: string;
  cyclic_escalation?: boolean;
  bypass_mode?: boolean;
  use_smart_delivery?: boolean;
  escalation_level?: number;
  current_recipient_index?: number;
  escalation_stopped?: boolean;
  rejected_by?: string;
  assignments?: any;
}

interface EmergencyNotification {
  document_id: string;
  recipient_id: string;
  channel: 'email' | 'sms' | 'push' | 'whatsapp' | 'escalation';
  title: string;
  message?: string;
  urgency_level: string;
  delivered?: boolean;
  escalation_level?: number;
}

interface EmergencyNotificationSettings {
  document_id: string;
  use_profile_defaults?: boolean;
  override_for_emergency?: boolean;
  notification_strategy?: 'recipient-based' | 'document-based';
  channels?: any[];
  scheduling_options?: any;
  recipient_settings?: any;
}

class SupabaseEmergencyService {
  private static instance: SupabaseEmergencyService;
  private subscriptions: Map<string, RealtimeChannel> = new Map();

  static getInstance(): SupabaseEmergencyService {
    if (!SupabaseEmergencyService.instance) {
      SupabaseEmergencyService.instance = new SupabaseEmergencyService();
    }
    return SupabaseEmergencyService.instance;
  }

  // Create emergency document
  async createEmergencyDocument(document: EmergencyDocument) {
    const { data, error } = await supabase
      .from('emergency_documents')
      .insert([document])
      .select()
      .single();

    if (error) throw error;
    reportBlockchainEvent({
      documentId: data.id,
      action: 'EMERGENCY_SUBMITTED',
      workflowStep: 'Emergency Submission',
      routingType: deriveEmergencyRoutingType(document),
      comment: document.reason ?? null,
    }).catch(() => {});
    return data;
  }

  // Get all emergency documents
  async getEmergencyDocuments(filters?: { status?: string; submitter_id?: string }) {
    let query = supabase
      .from('emergency_documents')
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

  // Get emergency document by ID
  async getEmergencyDocumentById(id: string) {
    const { data, error } = await supabase
      .from('emergency_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // Update emergency document
  async updateEmergencyDocument(id: string, updates: Partial<EmergencyDocument>) {
    const { data, error } = await supabase
      .from('emergency_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (updates.status || updates.bypass_mode !== undefined) {
      const actionMap: Record<string, string> = {
        acknowledged: 'EMERGENCY_APPROVED',
        resolved: 'EMERGENCY_APPROVED',
        rejected: 'EMERGENCY_REJECTED',
        escalated: 'EMERGENCY_ESCALATED',
      };
      const action = updates.bypass_mode
        ? 'EMERGENCY_BYPASSED'
        : (updates.status ? (actionMap[updates.status] ?? 'STATUS_CHANGED') : 'STATUS_CHANGED');
      reportBlockchainEvent({
        documentId: id,
        action,
        workflowStep: updates.status ?? null,
        routingType: deriveEmergencyRoutingType(data),
      }).catch(() => {});
    }
    return data;
  }

  // Delete emergency document
  async deleteEmergencyDocument(id: string) {
    const { error } = await supabase
      .from('emergency_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Create notification
  async createNotification(notification: EmergencyNotification) {
    const { data, error } = await supabase
      .from('emergency_notifications')
      .insert([notification])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get notifications for document
  async getNotificationsByDocument(documentId: string) {
    const { data, error } = await supabase
      .from('emergency_notifications')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get notifications for recipient
  async getNotificationsByRecipient(recipientId: string) {
    const { data, error } = await supabase
      .from('emergency_notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Create notification settings
  async createNotificationSettings(settings: EmergencyNotificationSettings) {
    const { data, error } = await supabase
      .from('emergency_notification_settings')
      .insert([settings])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get notification settings for document
  async getNotificationSettings(documentId: string) {
    const { data, error } = await supabase
      .from('emergency_notification_settings')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (error) throw error;
    return data;
  }

  // Create escalation
  async createEscalation(escalation: any) {
    const { data, error } = await supabase
      .from('emergency_escalations')
      .insert([escalation])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update escalation
  async updateEscalation(documentId: string, updates: any) {
    const { data, error } = await supabase
      .from('emergency_escalations')
      .update(updates)
      .eq('document_id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get escalation for document
  async getEscalation(documentId: string) {
    const { data, error } = await supabase
      .from('emergency_escalations')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (error) throw error;
    return data;
  }

  // Subscribe to emergency documents changes
  subscribeToEmergencyDocuments(
    callback: (payload: any) => void,
    filters?: { status?: string; submitter_id?: string }
  ): RealtimeChannel {
    const channelKey = filters?.submitter_id || filters?.status || 'all';
    const channelName = `emergency-documents-${channelKey}`;
    
    // Unsubscribe existing channel if any
    if (this.subscriptions.has(channelName)) {
      this.subscriptions.get(channelName)?.unsubscribe();
    }

    // Supabase Realtime supports one filter per listener;
    // prefer submitter_id scope so each user only receives their own rows.
    const realtimeFilter = filters?.submitter_id
      ? `submitter_id=eq.${filters.submitter_id}`
      : filters?.status
        ? `status=eq.${filters.status}`
        : undefined;

    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_documents',
          filter: realtimeFilter,
        },
        callback
      )
      .subscribe();

    this.subscriptions.set(channelName, channel);
    return channel;
  }

  // Subscribe to notifications
  subscribeToNotifications(
    recipientId: string,
    callback: (payload: any) => void
  ): RealtimeChannel {
    const channelName = `emergency-notifications-${recipientId}`;
    
    if (this.subscriptions.has(channelName)) {
      this.subscriptions.get(channelName)?.unsubscribe();
    }

    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_notifications',
          filter: `recipient_id=eq.${recipientId}`,
        },
        callback
      )
      .subscribe();

    this.subscriptions.set(channelName, channel);
    return channel;
  }

  // Unsubscribe from channel
  unsubscribe(channelName: string) {
    const channel = this.subscriptions.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.subscriptions.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.subscriptions.forEach((channel) => {
      channel.unsubscribe();
    });
    this.subscriptions.clear();
  }

  // Cache management - sync with localStorage
  async syncToCache(document: any) {
    try {
      const cached = JSON.parse(localStorage.getItem('emergency-cache') || '[]');
      const index = cached.findIndex((d: any) => d.id === document.id);
      
      if (index >= 0) {
        cached[index] = document;
      } else {
        cached.unshift(document);
      }
      
      safeSetItem('emergency-cache', JSON.stringify(cached.slice(0, 25)));
      // Note: User ID is stored separately by the hook
    } catch (error) {
      console.warn('Cache sync failed:', error);
    }
  }

  // Get from cache
  getFromCache() {
    try {
      return JSON.parse(localStorage.getItem('emergency-cache') || '[]');
    } catch {
      return [];
    }
  }

  // Clear cache
  clearCache() {
    localStorage.removeItem('emergency-cache');
    localStorage.removeItem('emergency-cache-user');
  }
}

export const supabaseEmergencyService = SupabaseEmergencyService.getInstance();
export type { EmergencyDocument, EmergencyNotification, EmergencyNotificationSettings };
