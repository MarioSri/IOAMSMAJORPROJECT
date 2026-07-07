import React, { useState, useEffect, useRef, useMemo } from "react";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseDocuments } from "@/hooks/useSupabaseDocuments";
import { NotificationDispatchService } from "@/services/NotificationDispatchService";
import { ChatPushService } from "@/services/ChatPushService";
import { documentService } from "@/services/DocumentService";
import { workflowService } from "@/services/WorkflowService";
import { recipientService } from "@/services/RecipientService";
import { supabase } from "@/lib/supabase";
import { sanitizeForLog } from "@/utils/sanitize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowRightLeft,
  Shield,
  Zap,
  BarChart3,
  Search,
  Filter,
  XCircle,
  Siren,
  AlertTriangle,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const documentHook = useSupabaseDocuments();

  // Cache recipient names from role_recipients table
  const recipientCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Pre-load recipients into cache
    recipientService.fetchRecipients().then(recipients => {
      for (const r of recipients) {
        recipientCacheRef.current.set(r.id, r.name);
      }
    }).catch(err => console.warn('Failed to preload recipients:', err));
  }, []);

  if (!user) return null;

  const handleDocumentSubmit = async (data: any) => {
    console.log("Document submitted:", sanitizeForLog(data?.title));

    const currentUserName = user?.name || user?.email?.split('@')[0] || 'User';
    const currentUserDept = user?.department || 'Department';
    const currentUserDesignation = user?.role || 'Employee';

    try {
      // Always use Supabase for all roles
      console.log('Using Supabase mode');
      await handleSupabaseSubmission(data, currentUserName, currentUserDept, currentUserDesignation);
    } catch (error) {
      console.error('Document submission failed:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit document",
        variant: "destructive"
      });
    }
  };

  const handleSupabaseSubmission = async (data: any, currentUserName: string, currentUserDept: string, currentUserDesignation: string) => {

    // Build recipients using role_recipients.id UUIDs from the form
    // data.recipients already contains role_recipients.id UUIDs from the RecipientSelector
    const recipients = await Promise.all(
      data.recipients.map(async (id: string) => ({
        id,
        name: await getRecipientName(id)
      }))
    );

    // Use the hook's createDocument method
    const result = await documentHook.createDocument({
      title: data.title,
      description: data.description,
      type: (data.documentTypes && data.documentTypes[0]) || data.type || 'document',
      priority: data.priority,
      submitter_id: user?.id || 'unknown',
      submitter_name: currentUserName,
      submitter_department: currentUserDept,
      submitter_designation: currentUserDesignation,
      is_emergency: data.isEmergency || false,
      files: data.files || [],
      recipients: recipients.map(r => r.name), // Display names for UI
      recipient_ids: data.recipients, // role_recipients UUIDs for matching
      source: 'document-management',
      file_assignments: data.assignments || {}, // Per-recipient file assignments
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create document');
    }

    const document = result.data;

    // Create workflow — rollback document if this fails to prevent orphans
    let workflow;
    try {
      workflow = await workflowService.createWorkflow({
        documentId: document.id,
        recipients,
        isParallel: data.isParallel || false,
        routingType: data.routingType || 'sequential',
        source: 'document-management',
        hasBypass: false,
      });
    } catch (workflowError) {
      console.error('❌ Workflow creation failed, rolling back document:', workflowError);
      // Delete orphaned document
      await supabase.from('documents').delete().eq('id', document.id);
      throw new Error('Failed to create approval workflow. Document has been rolled back.');
    }

    // Supabase workflow is the single source of truth - no localStorage needed
    // The useSupabaseApprovals hook will pick up new documents via realtime subscriptions

    // Dispatch global notifications to all recipients
    NotificationDispatchService.dispatch({
      recipientRowIds: data.recipients,
      title: `New Document for Approval: ${data.title}`,
      message: `${currentUserName} has submitted "${data.title}" and requires your approval.`,
      type: 'submission',
      urgent: data.priority === 'urgent' || data.priority === 'high',
      action_url: `${window.location.origin}/approvals`,
      document_id: document.id,
      emailParams: {
        type: 'submission',
        params: {
          docTitle: data.title,
          submitterName: currentUserName,
          approvalUrl: `${window.location.origin}/approvals`,
        },
      },
      pushPayload: {
        title: 'New Document for Approval',
        body: `${currentUserName} submitted "${data.title}"`,
        url: `${window.location.origin}/approvals`,
      },
    }).catch(err => console.error('[Documents] Dispatch failed:', err));

    // Notify channel members that a document chat channel was created
    ChatPushService.dispatch({
      document_id: document.id,
      exclude_user_id: user?.id,
      title: `New Chat Channel: ${data.title}`,
      body: `Join the discussion for "${data.title}" in Messages.`,
      action_url: `${window.location.origin}/messages`,
    }).catch(err => console.error('[Documents] ChatPush failed:', err));

    toast({
      title: "Document Submitted",
      description: `Your document has been saved to database and submitted to ${data.recipients.length} recipient(s).`,
    });
  };

  /** Resolve recipient ID (UUID) to display name via RecipientService */
  const getRecipientName = async (recipientId: string): Promise<string> => {
    // Check local cache first
    const cached = recipientCacheRef.current.get(recipientId);
    if (cached) return cached;
    // Fetch from service
    const name = await recipientService.getRecipientName(recipientId);
    recipientCacheRef.current.set(recipientId, name);
    return name;
  };

  const stats = useMemo(() => documentHook.getStatistics(), [documentHook.documents]);
  const uploaderRef = useRef<HTMLDivElement>(null);
  const [isUploaderVisible, setIsUploaderVisible] = useState(false);

  const handleNewDocumentClick = (): void => {
    if (isUploaderVisible) {
      setIsUploaderVisible(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setIsUploaderVisible(true);
      setTimeout(() => uploaderRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <ResponsiveLayout>
      <div className={cn(
        "container mx-auto p-4 sm:p-6 animate-fade-in relative z-10",
        isUploaderVisible ? "space-y-4" : "space-y-6"
      )}>
        {/* Header - Hidden when uploader is active */}
        {!isUploaderVisible && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Document Management</h1>
            <p className="text-base text-muted-foreground">Submit Your Permission Reports, Letters, and Circulars for Approval.</p>
          </div>
        )}

        {/* Main Action Card - Always visible to allow toggling/canceling */}
        <Card className={cn(
          "shadow-elegant transition-all duration-300 overflow-hidden relative",
          isUploaderVisible ? "border-primary bg-primary/5" : "border-primary/10"
        )}>
          
          <CardHeader className={cn("relative z-10", isUploaderVisible ? "pb-3" : "pb-6")}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  isUploaderVisible ? "bg-primary text-primary-foreground shadow-glow" : "bg-primary/10 text-primary"
                )}>
                  <FileText className={cn("w-6 h-6", isUploaderVisible && "animate-slowblink")} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight">Document Management</span>
                </div>
              </CardTitle>

              <Button
                onClick={handleNewDocumentClick}
                variant={isUploaderVisible ? "default" : "outline"}
                className={cn(
                  "w-full sm:w-auto font-bold transition-all duration-300",
                  isUploaderVisible ? "animate-slowblink shadow-glow bg-green-600 hover:bg-green-700 text-white" : "border-2 hover:bg-accent group text-foreground"
                )}
                size="lg"
              >
                {isUploaderVisible ? (
                  <>
                    <XCircle className="w-5 h-5 mr-2" />
                    CANCEL SUBMISSION
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    ACTIVATE SUBMISSION
                  </>
                )}
              </Button>
            </div>

            {isUploaderVisible && (
              <div className="bg-green-100 border border-green-200 rounded-lg p-3 mt-3 animate-slowblink">
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                  <FileText className="w-5 h-5 text-green-600" />
                  SUBMISSION MODE ACTIVE
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Statistics Grid - Hidden when uploader is active */}
        {!isUploaderVisible && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.pending || 0}</p>
                  </div>
                  <div className="p-2 bg-orange-100 rounded-full">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Submitted</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.total || 0}</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-full">
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Approved</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.approved || 0}</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Approval Rate</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.approvalRate || 0}%</p>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Avg. Time</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.averageTime || '0 hours'}</p>
                  </div>
                  <div className="p-2 bg-yellow-100 rounded-full">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Uploader Section */}
        {isUploaderVisible && (
          <div ref={uploaderRef} className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="shadow-elegant border-primary overflow-visible bg-primary/5">
              <CardContent className="p-0">
                <DocumentUploader 
                  userRole={user.role} 
                  onSubmit={async (data: any) => {
                    await handleDocumentSubmit(data);
                    setIsUploaderVisible(false);
                  }} 
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
};