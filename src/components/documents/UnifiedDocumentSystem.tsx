/**
 * Unified Document System Integration
 * Connects Track Documents, Approval Center, Document Management, Emergency Management, and Approval Chain with Bypass
 */

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseApprovals } from '@/hooks/useSupabaseApprovals';
import { useSupabaseTrackDocuments } from '@/hooks/useSupabaseTrackDocuments';
import { useToast } from '@/hooks/use-toast';

export const UnifiedDocumentSystem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { approvalCards, loading: approvalsLoading, error: approvalsError } = useSupabaseApprovals();
  const { trackDocuments, loading: docsLoading, error: docsError } = useSupabaseTrackDocuments();
  const loading = approvalsLoading || docsLoading;
  const error = approvalsError || docsError || null;
  const { toast } = useToast();

  // Real-time status monitoring
  useEffect(() => {
    if (error) {
      console.error('Real-time document system error:', error);
      toast({
        title: "System Error",
        description: error,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [error, toast]);

  // Real-time notifications
  useEffect(() => {
    const handleDocumentCreated = (event: CustomEvent) => {
      const { document } = event.detail;
      
      if (document && user) {
        // Check if user should be notified
        const isRecipient = document.recipientIds?.some((id: string) => 
          id.toLowerCase().includes(user.role?.toLowerCase() || '')
        ) || document.recipients?.some((name: string) => 
          name.toLowerCase().includes(user.name?.toLowerCase() || '')
        );

        if (isRecipient) {
          toast({
            title: "New Document Requires Approval",
            description: `${document.title} has been submitted for your review`,
            duration: 5000,
          });
        }
      }
    };

    const handleDocumentApproved = (event: CustomEvent) => {
      const { documentId, approvedBy } = event.detail;
      
      toast({
        title: "Document Approved",
        description: `Document approved by ${approvedBy}`,
        duration: 3000,
      });
    };

    const handleDocumentRejected = (event: CustomEvent) => {
      const { documentId, rejectedBy, reason } = event.detail;
      
      toast({
        title: "Document Rejected",
        description: `Document rejected by ${rejectedBy}`,
        variant: "destructive",
        duration: 4000,
      });
    };

    const handleEmergencyDocument = (event: CustomEvent) => {
      const { document } = event.detail;
      
      if (document) {
        toast({
          title: "🚨 Emergency Document",
          description: `${document.title} requires immediate attention`,
          duration: 8000,
        });
      }
    };

    const handleRecipientsUpdated = (event: CustomEvent) => {
      const { documentId, recipients } = event.detail;
      
      toast({
        title: "Recipients Updated",
        description: `Document recipients have been updated in real-time`,
        duration: 3000,
      });
    };

    // Register event listeners
    window.addEventListener('document-created', handleDocumentCreated as EventListener);
    window.addEventListener('document-approved', handleDocumentApproved as EventListener);
    window.addEventListener('document-rejected', handleDocumentRejected as EventListener);
    window.addEventListener('emergency-document-created', handleEmergencyDocument as EventListener);
    window.addEventListener('recipients-updated', handleRecipientsUpdated as EventListener);

    return () => {
      window.removeEventListener('document-created', handleDocumentCreated as EventListener);
      window.removeEventListener('document-approved', handleDocumentApproved as EventListener);
      window.removeEventListener('document-rejected', handleDocumentRejected as EventListener);
      window.removeEventListener('emergency-document-created', handleEmergencyDocument as EventListener);
      window.removeEventListener('recipients-updated', handleRecipientsUpdated as EventListener);
    };
  }, [user, toast]);

  // System status indicator
  const systemStatus = {
    trackDocuments: trackDocuments.length,
    approvalCards: approvalCards.length,
    loading,
    error: !!error
  };

  // Add system status to window for debugging
  useEffect(() => {
    (window as any).documentSystemStatus = systemStatus;
  }, [systemStatus]);

  return (
    <>
      {children}
      
      {/* System Status Indicator (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded-lg font-mono">
          <div>📄 Track: {systemStatus.trackDocuments}</div>
          <div>✅ Approvals: {systemStatus.approvalCards}</div>
          <div>🔄 Loading: {systemStatus.loading ? 'Yes' : 'No'}</div>
          <div>❌ Error: {systemStatus.error ? 'Yes' : 'No'}</div>
        </div>
      )}
    </>
  );
};

export default UnifiedDocumentSystem;