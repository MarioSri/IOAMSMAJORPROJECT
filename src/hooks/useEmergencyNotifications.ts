import { useState, useEffect } from 'react';
import { emergencyNotificationService } from '@/services/EmergencyNotificationService';
import type { EmergencyNotificationSettings, EmergencyDocument } from '@/services/EmergencyNotificationService';

interface NotificationLog {
  id: string;
  recipientId: string;
  documentId: string;
  channel: string;
  title: string;
  message: string;
  urgencyLevel: string;
  timestamp: string;
  delivered: boolean;
}

interface EmergencySubmissionLog {
  id: string;
  document: EmergencyDocument;
  recipients: string[];
  settings: EmergencyNotificationSettings;
  timestamp: string;
  status: string;
}

function loadLogsFromStorage() {
  return {
    notifications: JSON.parse(localStorage.getItem('emergency-notification-logs') || '[]') as NotificationLog[],
    submissions: JSON.parse(localStorage.getItem('emergency-submissions') || '[]') as EmergencySubmissionLog[],
  };
}

export function useEmergencyNotifications() {
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [submissionLogs, setSubmissionLogs] = useState<EmergencySubmissionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  function refreshLogs() {
    try {
      const { notifications, submissions } = loadLogsFromStorage();
      setNotificationLogs(notifications);
      setSubmissionLogs(submissions);
    } catch (error) {
      console.error('Failed to load emergency notification logs:', error);
    }
  }

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function sendEmergencyNotification(
    recipients: string[],
    document: EmergencyDocument,
    settings: EmergencyNotificationSettings
  ) {
    setIsLoading(true);
    try {
      await emergencyNotificationService.sendEmergencyNotification(recipients, document, settings);
      refreshLogs();
      return { success: true };
    } catch (error) {
      console.error('Failed to send emergency notification:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  }

  function stopNotifications(documentId: string) {
    emergencyNotificationService.stopNotifications(documentId);
    setNotificationLogs(prev =>
      prev.map(log => log.documentId === documentId ? { ...log, delivered: false } : log)
    );
  }

  function getNotificationStats() {
    const total = notificationLogs.length;
    const delivered = notificationLogs.filter(log => log.delivered).length;
    const byChannel = notificationLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.channel] = (acc[log.channel] ?? 0) + 1;
      return acc;
    }, {});
    const byUrgency = notificationLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.urgencyLevel] = (acc[log.urgencyLevel] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total,
      delivered,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      byChannel,
      byUrgency
    };
  }

  function getRecentNotifications(limit: number = 10) {
    return notificationLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  function getActiveEmergencies() {
    return submissionLogs.filter(log => log.status === 'sent');
  }

  function getSchedulingOptions() {
    return emergencyNotificationService.getSchedulingOptions();
  }

  return {
    notificationLogs,
    submissionLogs,
    isLoading,
    sendEmergencyNotification,
    stopNotifications,
    getNotificationStats,
    getRecentNotifications,
    getActiveEmergencies,
    getSchedulingOptions
  };
}
