import { NotificationDispatchService } from './NotificationDispatchService';
import { ChatPushService } from './ChatPushService';

interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  enabled: boolean;
  interval: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
}

interface UserNotificationPreferences {
  email: NotificationChannel;
  sms: NotificationChannel;
  push: NotificationChannel;
  whatsapp: NotificationChannel;
}

interface EmergencyNotificationSettings {
  useProfileDefaults: boolean;
  overrideForEmergency: boolean;
  notificationStrategy: 'recipient-based' | 'document-based';
  channels: NotificationChannel[];
  schedulingOptions: {
    interval: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
}

interface EmergencyDocument {
  id: string;
  title: string;
  description: string;
  urgencyLevel: 'medium' | 'urgent' | 'high' | 'critical';
  submittedBy: string;
  autoEscalation?: boolean;
  escalationTimeout?: number;
  escalationTimeUnit?: string;
  cyclicEscalation?: boolean;
}

class EmergencyNotificationService {
  private static instance: EmergencyNotificationService;

  static getInstance(): EmergencyNotificationService {
    if (!EmergencyNotificationService.instance) {
      EmergencyNotificationService.instance = new EmergencyNotificationService();
    }
    return EmergencyNotificationService.instance;
  }

  private getUserPreferences(recipientId: string): UserNotificationPreferences {
    return {
      email: { type: 'email', enabled: true, interval: 1, unit: 'seconds' },
      sms: { type: 'sms', enabled: true, interval: 1, unit: 'seconds' },
      push: { type: 'push', enabled: true, interval: 1, unit: 'seconds' },
      whatsapp: { type: 'whatsapp', enabled: true, interval: 1, unit: 'seconds' }
    };
  }

  private async sendWithProfileSettings(
    recipients: string[],
    document: EmergencyDocument
  ): Promise<void> {
    for (const recipientId of recipients) {
      const preferences = this.getUserPreferences(recipientId);
      
      Object.values(preferences).forEach(channel => {
        if (channel.enabled) {
          this.deliverNotification(recipientId, document, channel);
        }
      });
    }
  }

  private async sendWithEmergencyOverride(
    recipients: string[],
    document: EmergencyDocument,
    settings: EmergencyNotificationSettings
  ): Promise<void> {
    if (settings.notificationStrategy === 'document-based') {
      recipients.forEach(recipientId => {
        settings.channels.forEach(channel => {
          this.scheduleNotification(recipientId, document, channel);
        });
      });
      } else {
        recipients.forEach(recipientId => {
        const recipientSettings = this.getRecipientSpecificSettings(recipientId, settings);
        recipientSettings.forEach(channel => {
          this.scheduleNotification(recipientId, document, channel);
        });
      });
    }
  }

  private getRecipientSpecificSettings(
    recipientId: string,
    settings: EmergencyNotificationSettings
  ): NotificationChannel[] {
    const saved = localStorage.getItem(`emergency-recipient-settings-${recipientId}`);
    if (saved) {
      return JSON.parse(saved);
    }
    return settings.channels;
  }

  private scheduleNotification(
    recipientId: string,
    document: EmergencyDocument,
    channel: NotificationChannel
  ): void {
    const intervalMs = this.convertToMilliseconds(channel.interval, channel.unit);
    
    if (document.urgencyLevel === 'critical') {
      this.deliverNotification(recipientId, document, channel);
    }
    
    const notificationId = `${document.id}-${recipientId}-${channel.type}`;

    setTimeout(() => {
      this.deliverNotification(recipientId, document, channel);

      const recurringInterval = setInterval(() => {
        this.deliverNotification(recipientId, document, channel);
      }, intervalMs);
      
      localStorage.setItem(`notification-interval-${notificationId}`, recurringInterval.toString());
    }, document.urgencyLevel === 'critical' ? 0 : intervalMs);
  }

  private convertToMilliseconds(interval: number, unit: string): number {
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000
    };
    return interval * (multipliers[unit as keyof typeof multipliers] || multipliers.minutes);
  }

  private deliverNotification(
    recipientId: string,
    document: EmergencyDocument,
    channel: NotificationChannel
  ): void {
    const notification = {
      id: `${Date.now()}-${recipientId}`,
      recipientId,
      documentId: document.id,
      channel: channel.type,
      title: `EMERGENCY: ${document.title}`,
      message: document.description,
      urgencyLevel: document.urgencyLevel,
      timestamp: new Date().toISOString(),
      delivered: true
    };

    const logs = JSON.parse(localStorage.getItem('emergency-notification-logs') || '[]');
    logs.unshift(notification);
    localStorage.setItem('emergency-notification-logs', JSON.stringify(logs.slice(0, 1000)));

    switch (channel.type) {
      case 'email':
        console.log(`Email sent to ${recipientId}: ${notification.title}`);
        break;
      case 'sms':
        console.log(`SMS sent to ${recipientId}: ${notification.title}`);
        break;
      case 'push':
        this.sendBrowserNotification(notification);
        break;
      case 'whatsapp':
        console.log(`WhatsApp sent to ${recipientId}: ${notification.title}`);
        break;
    }
  }

  private sendBrowserNotification(notification: any): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.urgencyLevel === 'critical'
      });
    }
  }

  async sendEmergencyNotification(
    recipients: string[],
    document: EmergencyDocument,
    settings: EmergencyNotificationSettings
  ): Promise<void> {
    if (settings.useProfileDefaults) {
      await this.sendWithProfileSettings(recipients, document);
    } else if (settings.overrideForEmergency) {
      await this.sendWithEmergencyOverride(recipients, document, settings);
    } else {
      await this.sendWithProfileSettings(recipients, document);
    }

    // Dispatch real notifications via global notification system (email + push + in-app)
    NotificationDispatchService.dispatch({
      recipientRowIds: recipients,
      title: `EMERGENCY: ${document.title}`,
      message: document.description,
      type: 'emergency',
      urgent: true,
      document_id: document.id,
      emailParams: {
        type: 'emergency',
        params: {
          title: document.title,
          urgency: document.urgencyLevel,
          message: document.description,
        },
      },
      pushPayload: {
        title: `🚨 EMERGENCY: ${document.title}`,
        body: document.description,
        url: `${window.location.origin}/emergency`,
      },
    }).catch(err => console.error('[Emergency] Dispatch failed:', err));

    // Notify all channel members of the emergency discussion channel
    ChatPushService.dispatch({
      document_id: document.id,
      title: `🚨 Emergency Channel: ${document.title}`,
      body: `An emergency discussion channel has been created — check Messages.`,
      action_url: `${window.location.origin}/messages`,
    }).catch(err => console.error('[Emergency] ChatPush failed:', err));

    const emergencyLog = {
      id: document.id,
      document,
      recipients,
      settings,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    
    const logs = JSON.parse(localStorage.getItem('emergency-submissions') || '[]');
    logs.unshift(emergencyLog);
    localStorage.setItem('emergency-submissions', JSON.stringify(logs.slice(0, 100)));
  }

  getSchedulingOptions(): Array<{value: string, label: string, interval: number, unit: string}> {
    return [
      { value: '1min', label: 'Every 1 minute', interval: 1, unit: 'minutes' },
      { value: '15min', label: 'Every 15 minutes', interval: 15, unit: 'minutes' },
      { value: '1hour', label: 'Hourly', interval: 1, unit: 'hours' },
      { value: '1day', label: 'Daily', interval: 1, unit: 'days' },
      { value: '1week', label: 'Weekly', interval: 1, unit: 'weeks' },
      { value: 'custom', label: 'Custom Interval', interval: 0, unit: 'minutes' }
    ];
  }

  handleDocumentRejection(documentId: string, rejectedBy: string): void {
    const escalationData = JSON.parse(localStorage.getItem(`escalation-${documentId}`) || '{}');
    escalationData.escalationStopped = true;
    escalationData.rejectedBy = rejectedBy;
    escalationData.status = 'rejected';
    localStorage.setItem(`escalation-${documentId}`, JSON.stringify(escalationData));

    this.stopNotifications(documentId);
  }

  handleCyclicEscalation(documentId: string, recipients: string[]): void {
    const escalationData = JSON.parse(localStorage.getItem(`escalation-${documentId}`) || '{}');
    
    if (escalationData.escalationStopped) {
      return;
    }

    const currentIndex = escalationData.currentRecipientIndex || 0;
    const nextIndex = (currentIndex + 1) % recipients.length;
    
    escalationData.currentRecipientIndex = nextIndex;
    escalationData.escalationLevel = (escalationData.escalationLevel || 0) + 1;
    
    if (nextIndex === 0 && escalationData.escalationLevel > recipients.length) {
      escalationData.returnedToOriginal = true;
    }
    
    localStorage.setItem(`escalation-${documentId}`, JSON.stringify(escalationData));

    const nextRecipient = recipients[nextIndex];
    this.sendEscalationNotification(documentId, nextRecipient, escalationData.escalationLevel);
  }

  private sendEscalationNotification(documentId: string, recipientId: string, escalationLevel: number): void {
    const document = this.getDocumentById(documentId);
    if (!document) return;

    const notification = {
      id: `${Date.now()}-${recipientId}`,
      recipientId,
      documentId,
      channel: 'escalation',
      title: `ESCALATED EMERGENCY (Level ${escalationLevel}): ${document.title}`,
      message: `This document has been escalated due to no response. Please review urgently.`,
      urgencyLevel: document.urgencyLevel,
      timestamp: new Date().toISOString(),
      escalationLevel,
      delivered: true
    };

    const logs = JSON.parse(localStorage.getItem('emergency-notification-logs') || '[]');
    logs.unshift(notification);
    localStorage.setItem('emergency-notification-logs', JSON.stringify(logs.slice(0, 1000)));
  }

  private getDocumentById(documentId: string): EmergencyDocument | null {
    const submissions = JSON.parse(localStorage.getItem('emergency-submissions') || '[]');
    const submission = submissions.find((s: any) => s.id === documentId);
    return submission ? submission.document : null;
  }

  /**
   * @deprecated Use {@link EscalationService.initializeEscalation} instead.
   * This localStorage-based implementation is superseded by the Supabase-backed
   * EscalationService which persists escalation state server-side.
   */
  initializeEscalation(document: EmergencyDocument, recipients: string[]): void {
    if (!document.autoEscalation) return;

    const escalationData = {
      documentId: document.id,
      recipients,
      originalRecipients: [...recipients],
      currentRecipientIndex: 0,
      escalationLevel: 0,
      escalationStopped: false,
      cyclicEscalation: document.cyclicEscalation || true,
      timeout: document.escalationTimeout || 24,
      timeUnit: document.escalationTimeUnit || 'hours'
    };

    localStorage.setItem(`escalation-${document.id}`, JSON.stringify(escalationData));

    const timeoutMs = this.convertToMilliseconds(escalationData.timeout, escalationData.timeUnit);
    
    setTimeout(() => {
      this.checkForEscalation(document.id);
    }, timeoutMs);
  }

  private checkForEscalation(documentId: string): void {
    const escalationData = JSON.parse(localStorage.getItem(`escalation-${documentId}`) || '{}');
    
    if (escalationData.escalationStopped) {
      return;
    }

    const hasResponse = this.checkRecipientResponse(documentId, escalationData.recipients[escalationData.currentRecipientIndex]);
    
    if (!hasResponse) {
      this.handleCyclicEscalation(documentId, escalationData.recipients);
      
      const timeoutMs = this.convertToMilliseconds(escalationData.timeout, escalationData.timeUnit);
      setTimeout(() => {
        this.checkForEscalation(documentId);
      }, timeoutMs);
    }
  }

  private checkRecipientResponse(documentId: string, recipientId: string): boolean {
    const responses = JSON.parse(localStorage.getItem(`document-responses-${documentId}`) || '[]');
    return responses.some((response: any) => response.recipientId === recipientId);
  }

  stopNotifications(documentId: string): void {
    const logs = JSON.parse(localStorage.getItem('emergency-notification-logs') || '[]');
    logs.forEach((log: any) => {
      if (log.documentId === documentId) {
        const intervalId = localStorage.getItem(`notification-interval-${log.id}`);
        if (intervalId) {
          clearInterval(parseInt(intervalId));
          localStorage.removeItem(`notification-interval-${log.id}`);
        }
      }
    });

    localStorage.removeItem(`escalation-${documentId}`);
  }
}

export const emergencyNotificationService = EmergencyNotificationService.getInstance();
export type { 
  NotificationChannel, 
  UserNotificationPreferences, 
  EmergencyNotificationSettings, 
  EmergencyDocument 
};