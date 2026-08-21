import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Download,
  MessageSquare,
  Calendar,
  User,
  PenTool,
  Signature,
  Shield,
  FileClock,
  Trash2,
  ArrowRight,
  ArrowRightLeft,
  Building,
  CircleCheckBig,
  Siren,
  Users,
  Upload
} from "lucide-react";
import { DigitalSignature } from "@/components/signature/DigitalSignature";
import { useToast } from "@/hooks/use-toast";
import { isUserInvolvedInDocument } from "@/utils/recipientMatching";
import { useSupabaseTrackDocuments } from "@/hooks/useSupabaseTrackDocuments";
import { approvalService } from "@/services/ApprovalService";
import { workflowService } from "@/services/WorkflowService";
import { supabase } from "@/lib/supabase";
import { supabaseStorageService } from '@/services/SupabaseStorageService';
import isJpg from 'is-jpg';
import { useNavigate } from 'react-router-dom';

interface DocumentTrackerProps {
  userRole: string;
  userName?: string;
  onViewFile?: (file: File) => void;
  onViewFiles?: (files: File[]) => void; // Support for multiple files
}

interface Document {
  id: string;
  title: string;
  type: 'Letter' | 'Circular' | 'Report';
  submittedBy: string;
  submittedDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'in-review' | 'submitted';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  workflow: {
    currentStep: string;
    progress: number;
    steps: Array<{
      name: string;
      status: 'completed' | 'current' | 'pending' | 'rejected' | 'cancelled' | 'bypassed';
      assignee: string;
      assigneeId?: string;
      completedDate?: string;
      rejectedBy?: string;
      rejectedDate?: string;
      bypassReason?: string;
      escalated?: boolean;
      escalationLevel?: number;
    }>;
    routingType?: 'sequential' | 'parallel' | 'bidirectional';
    bypassedRecipients?: string[];
    resubmittedRecipients?: string[];
    hasBypass?: boolean; // For Emergency Management compatibility
    isParallel?: boolean; // For Emergency Management compatibility
  };
  requiresSignature: boolean;
  signedBy?: string[];
  submittedByDesignation?: string;
  description?: string;
  comments?: Array<{
    author: string;
    date: string;
    message: string;
  }>;
  files?: File[];
  signatureMetadata?: Array<Record<string, unknown>>;
  signedFileUrls?: Array<{ name?: string; storage_path?: string; storage_url?: string; type?: string }>;
  source?: string;
  isEmergency?: boolean;
  emergencyFeatures?: any;
  isBypass?: boolean;
}

export const DocumentTracker: React.FC<DocumentTrackerProps> = ({ userRole, userName, onViewFile, onViewFiles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [comment, setComment] = useState('');
  const [submittedDocuments, setSubmittedDocuments] = useState<Document[]>([]);
  const [removedDocuments, setRemovedDocuments] = useState<string[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState({
    name: 'Current User',
    department: '',
    designation: ''
  });
  const [approvalComments, setApprovalComments] = useState<{ [key: string]: any[] }>({});

  // Recipient selection for resend
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [selectedDocForResend, setSelectedDocForResend] = useState<Document | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const { toast } = useToast();

  // Confirmation dialog state for Remove action
  const [removeConfirmDoc, setRemoveConfirmDoc] = useState<any | null>(null);
  const [removing, setRemoving] = useState(false);

  // Use Supabase as primary source
  const {
    trackDocuments: supabaseDocuments,
    loading,
    error,
    deleteDocument: deleteSupabaseDocument,
    removeDocument,
    refetch
  } = useSupabaseTrackDocuments();

  // Use Supabase as single source of truth - no localStorage merge
  const trackDocuments = supabaseDocuments;



  const getDocumentFileEntries = (doc: Document): any[] => {
    const signedFiles = doc.signedFileUrls;
    if (Array.isArray(signedFiles) && signedFiles.length > 0) return signedFiles;
    return Array.isArray(doc.files) ? doc.files : [];
  };

  // Use real-time documents with normalization
  useEffect(() => {
    if (trackDocuments && trackDocuments.length > 0) {
      console.log('🔄 [DocumentTracker] Processing documents:', trackDocuments.length);
      const normalizedDocs = (trackDocuments as any[]).map(doc => {
        // Already normalized
        if ('submittedBy' in doc && 'workflow' in doc && 'requiresSignature' in doc) {
          return doc;
        }

        // Normalize from Supabase format
        // Build real workflow from joined document_workflows/workflow_steps if available
        const joinedWorkflow = doc.document_workflows?.[0];
        const realWorkflow = joinedWorkflow
          ? {
              currentStep: joinedWorkflow.current_step || 'Initial Review',
              progress: (() => {
                const steps = joinedWorkflow.workflow_steps || [];
                if (!steps.length) {
                  return ['approved', 'completed', 'partially-approved'].includes(doc.status) ? 100 : (joinedWorkflow.progress ?? 0);
                }
                
                // If the workflow is globally marked as finished
                if (['approved', 'completed', 'partially-approved'].includes(doc.status)) {
                  return 100;
                }

                const completedStepsCount = steps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
                const rejectedStepsCount = steps.filter((s: any) => s.status === 'rejected').length;
                
                // If rejected, we include the rejected step as part of the 'progress' (so it doesn't drop to 0)
                if (doc.status === 'rejected') {
                  return Math.round(((completedStepsCount + rejectedStepsCount) / steps.length) * 100);
                }

                return Math.round((completedStepsCount / steps.length) * 100);
              })(),
              steps: (joinedWorkflow.workflow_steps || []).map((s: any) => ({
                name: s.name || s.step_name || 'Review',
                assignee: s.assignee || s.assignee_name || '',
                assigneeId: s.assignee_id || '',
                status: s.status || 'pending',
                completedDate: s.completed_date,
                rejectedDate: s.rejected_date,
                rejectedBy: s.rejected_by,
                bypassReason: s.bypass_reason,
              })),
            }
          : doc.workflow
          ? {
              currentStep: doc.workflow.currentStep || 'Initial Review',
              progress: (() => {
                const steps = doc.workflow.steps || [];
                if (!steps.length) {
                  return ['approved', 'completed', 'partially-approved'].includes(doc.status) ? 100 : (doc.workflow.progress ?? 0);
                }
                if (['approved', 'completed', 'partially-approved'].includes(doc.status)) return 100;
                
                const completedCount = steps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
                const rejectedCount = steps.filter((s: any) => s.status === 'rejected').length;
                
                if (doc.status === 'rejected') {
                  return Math.round(((completedCount + rejectedCount) / steps.length) * 100);
                }
                return Math.round((completedCount / steps.length) * 100);
              })(),
              steps: doc.workflow.steps || [],
            }
          : {
              currentStep: doc.status === 'rejected' ? 'Rejected' : 'Initial Review',
              progress: (() => {
                if (['approved', 'completed', 'partially-approved'].includes(doc.status)) return 100;
                const steps = (doc as any).document_workflows?.[0]?.workflow_steps || (doc as any).workflow_steps || [];
                if (!steps.length) return doc.status === 'rejected' ? 100 : 0;
                
                const completedCount = steps.filter((s: any) => s.status === 'completed' || s.status === 'bypassed').length;
                const rejectedCount = steps.filter((s: any) => s.status === 'rejected').length;
                
                if (doc.status === 'rejected') {
                  return Math.round(((completedCount + rejectedCount) / steps.length) * 100);
                }
                return Math.round((completedCount / steps.length) * 100);
              })(),
              steps: [],
            };

        return {
          id: doc.id,
          title: doc.title || 'Untitled Document',
          type: doc.type || 'Report',
          submittedBy: doc.submitter_name || doc.submittedBy || 'Unknown',
          submittedDate: (doc.submitted_date || doc.submittedDate || new Date().toISOString()).split('T')[0],
          status: doc.status === 'in_progress' ? 'in-review' : (doc.status || 'pending'),
          priority: doc.priority || 'medium',
          workflow: realWorkflow,
          isEmergency: doc.is_emergency || false,
          source: doc.source || 'document-management',
          requiresSignature: doc.requiresSignature ?? true,
          signedBy: doc.signed_by || doc.signedBy || [],
          signatureMetadata: doc.signature_metadata || doc.signatureMetadata || [],
          signedFileUrls: doc.signed_file_urls || doc.signedFileUrls || [],
          submittedByDesignation: doc.submitter_designation || doc.submittedByDesignation || '',
          description: doc.description || '',
          comments: doc.comments || [],
          files: doc.files
        } as Document;
      });
      setSubmittedDocuments(normalizedDocs);
    } else {
      // ✅ Clear stale state when trackDocuments is empty (e.g. after user change or session reset)
      setSubmittedDocuments([]);
    }
  }, [trackDocuments]);

  // Load user profile and listen for Supabase real-time updates
  useEffect(() => {
    const loadUserProfile = () => {
      const savedProfile = localStorage.getItem('user-profile');
      if (savedProfile) {
        try {
          const parsedProfile = JSON.parse(savedProfile);
          setCurrentUserProfile({
            name: userName || parsedProfile.name || 'Current User',
            department: parsedProfile.department || '',
            designation: parsedProfile.designation || ''
          });
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else if (userName) {
        setCurrentUserProfile({
          name: userName,
          department: '',
          designation: ''
        });
      }
    };

    const loadApprovalComments = async () => {
      if (!supabaseDocuments || supabaseDocuments.length === 0) return;

      // Fetch all document comments concurrently instead of sequentially
      const results = await Promise.all(
        supabaseDocuments.map(async (doc) => {
          try {
            const dbComments = await approvalService.getComments(doc.id);
            return { id: doc.id, comments: dbComments };
          } catch {
            return { id: doc.id, comments: [] };
          }
        })
      );

      const allComments: { [key: string]: any[] } = {};
      for (const { id, comments } of results) {
        if (comments.length > 0) {
          allComments[id] = comments.map((c: any) => ({
            id: c.id,
            author: c.author_name,
            date: c.created_at?.split('T')[0] || '',
            message: c.message,
            isShared: c.is_shared,
          }));
        }
      }
      setApprovalComments(allComments);
    };

    loadUserProfile();
    loadApprovalComments();

    return () => {};
  }, [userName, supabaseDocuments]);

  const getStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in-review': return <FileClock className="h-4 w-4 text-blue-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string): "success" | "warning" | "default" | "destructive" => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': return 'warning';
      case 'in-review': return 'default';
      case 'submitted': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
      case 'Critical Priority': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent':
      case 'urgent priority':
      case 'Urgent Priority': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
      case 'high priority':
      case 'High Priority': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
      case 'medium priority':
      case 'Medium Priority': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityTextColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
      case 'Critical Priority': return 'text-red-600 font-bold';
      case 'urgent':
      case 'urgent priority':
      case 'Urgent Priority': return 'text-yellow-600 font-bold';
      case 'high':
      case 'high priority':
      case 'High Priority': return 'text-orange-600 font-semibold';
      case 'medium':
      case 'medium priority':
      case 'Medium Priority': return 'text-blue-600';
      case 'low': return 'text-green-600';
      case 'normal':
      case 'Normal Priority': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  // Combine submitted documents
  const allDocuments = [...submittedDocuments];

  const filteredDocuments = allDocuments.filter(doc => {
    const notRemoved = !removedDocuments.includes(doc.id);
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.submittedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;

    // Server-side filter (submitter_id = user.id) already guarantees ownership.
    // No client-side name comparison needed — it was causing silent exclusion
    // when submitter_name didn't exactly match localStorage user-profile.name.
    const shouldShow = notRemoved && matchesSearch && matchesStatus && matchesType;

    return shouldShow;
  });

  const handleApprove = (docId: string) => {
    if (selectedDocument?.requiresSignature) {
      setShowSignatureDialog(true);
    } else {
      toast({
        title: "Document Approved",
        description: `Document ${docId} has been approved`,
      });
    }
  };

  const handleReject = (docId: string) => {
    toast({
      title: "Document Rejected",
      description: `Document ${docId} has been rejected`,
      variant: "destructive"
    });
  };

  const handleSignatureCapture = (signatureData: string) => {
    toast({
      title: "Signature Captured",
      description: "Digital signature has been applied to the document",
    });
    setShowSignatureDialog(false);
  };

  /** Determine if a document's workflow is still in progress (not yet completed). */
  const isWorkflowInProgress = (doc: any): boolean => {
    const completedStatuses = ['approved', 'partially-approved', 'rejected', 'completed'];
    const docStatus = (doc.status ?? doc.document_status ?? '').toLowerCase();
    
    console.log('🔍 [isWorkflowInProgress] Checking document:', {
      title: doc.title,
      status: doc.status,
      document_status: doc.document_status,
      normalized: docStatus,
      isCompleted: completedStatuses.includes(docStatus)
    });
    
    return !completedStatuses.includes(docStatus);
  };

  /** Executes the confirmed remove action (called from the dialog). */
  const handleRemove = async (doc: any) => {
    if (!doc) return;
    setRemoving(true);
    try {
      const result = await removeDocument(doc.id);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to remove document');
      }

      setRemovedDocuments(prev => [...prev, doc.id]);
      window.dispatchEvent(new CustomEvent('document-removed', { detail: { docId: doc.id } }));

      const isArchive = result.action === 'archived';
      toast({
        title: isArchive ? 'Moved to Archive' : 'Workflow Removed',
        description: isArchive
          ? 'The completed workflow has been archived and removed from your tracking list.'
          : 'The workflow and all associated data have been permanently removed.',
        variant: isArchive ? 'default' : 'destructive',
      });
    } catch (err: any) {
      console.error('[DocumentTracker] Failed to remove document:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to remove document',
        variant: 'destructive',
      });
    } finally {
      setRemoving(false);
      setRemoveConfirmDoc(null);
    }
  };

  // Helper function to create a PDF-like file for viewing documents without attached files
  const createDocumentFile = (document: Document): File => {
    // Create HTML content for the document
    const htmlContent = `
  < !DOCTYPE html >
    <html>
      <head>
        <meta charset="UTF-8">
          <title>${document.title}</title>
          <style>
            body {
              font - family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
    }
            h1 {
              color: #2563eb;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
    }
            h2 {
              color: #374151;
            margin-top: 30px;
    }
            p {
              margin: 10px 0;
    }
            .info {
              background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
    }
            .status {
              display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
    }
            .approved {background: #dcfce7; color: #166534; }
            .pending {background: #fef3c7; color: #92400e; }
            .rejected {background: #fee2e2; color: #991b1b; }
            .in-review {background: #dbeafe; color: #1e40af; }
          </style>
      </head>
      <body>
        <h1>${document.title}</h1>
        <div class="info">
          <p><strong>Type:</strong> ${document.type}</p>
          <p><strong>Submitted by:</strong> ${document.submittedBy}</p>
          <p><strong>Date:</strong> ${document.submittedDate}</p>
          <p><strong>Status:</strong> <span class="status ${document.status}">${document.status.toUpperCase()}</span></p>
          <p><strong>Priority:</strong> ${document.priority}</p>
        </div>
        <h2>Workflow Progress</h2>
        <p><strong>Current Step:</strong> ${document.workflow.currentStep}</p>
        <p><strong>Progress:</strong> ${document.workflow.progress}%</p>
        ${document.description ? `<h2>Description</h2><p>${document.description}</p>` : ''}
        <h2>Workflow Steps</h2>
        <ul>
          ${document.workflow.steps.map(step => `
      <li>
        <strong>${step.name}</strong> - ${step.assignee} 
        ${step.status === 'completed' ? '✓' : step.status === 'current' ? '⏳' : '⏸'}
      </li>
    `).join('')}
        </ul>
        ${document.requiresSignature ? `
    <h2>Digital Signatures</h2>
    <p>${document.signedBy && document.signedBy.length > 0 ? `Signed by: ${document.signedBy.join(', ')}` : 'Pending signature'}</p>
  ` : ''}
      </body>
    </html>
`;

    // Create a Blob from the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });

    // Create a File object with a .html extension
    const fileName = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    return new File([blob], fileName, { type: 'text/html' });
  };


  return (
    <div className="space-y-6">

      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Document Tracking & Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents by title or submitter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    All Status
                  </div>
                </SelectItem>
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    Pending
                  </div>
                </SelectItem>

                <SelectItem value="approved">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Approved
                  </div>
                </SelectItem>
                <SelectItem value="rejected">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Rejected
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Letter">Letter</SelectItem>
                <SelectItem value="Circular">Circular</SelectItem>
                <SelectItem value="Report">Report</SelectItem>
                <SelectItem value="Emergency">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    Emergency
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <div className="space-y-4">
        {filteredDocuments.map((document) => {
          const isEmergency = document.isEmergency;
          const isBypass = document.source === 'approval-chain-bypass';

          return (
            <Card id={document.id} key={document.id} className={`hover:shadow-md transition-shadow ${
              isEmergency ? 'border-destructive bg-red-50 animate-pulse' : 
              isBypass ? 'border-blue-500 bg-blue-50' : ''
            }`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Document Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{document.title}</h3>
                          {isEmergency && (
                            <Badge variant="destructive" className="animate-pulse">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              EMERGENCY
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {document.type ? (document.type.charAt(0).toUpperCase() + document.type.slice(1)) : ''}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{String(document.submittedBy || '')}</span>
                            {document.submittedByDesignation && (
                              <span className="text-xs text-muted-foreground"> • {String(document.submittedByDesignation).toUpperCase()}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {String(document.submittedDate || '')}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                        {getStatusIcon(document.status)}
                        <Badge variant={getStatusBadge(document.status)}>
                          {document.status === 'submitted' ? 'Pending' : document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                        </Badge>
                        <Badge variant="outline" className={getPriorityTextColor(document.priority)}>
                          {typeof document.priority === 'string' && document.priority.includes('Priority')
                            ? document.priority
                            : `${document.priority.charAt(0).toUpperCase() + document.priority.slice(1)} Priority`}
                        </Badge>

                      </div>
                    </div>

                    {/* Workflow Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Workflow Progress</span>
                        <span>{String(document.workflow?.progress ?? 0)}%</span>
                      </div>
                      <Progress value={document.workflow?.progress ?? 0} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        Current Step: {String(document.workflow?.currentStep ?? 'N/A')}
                      </p>
                    </div>

                    {/* Workflow Steps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CircleCheckBig className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <div>Submission</div>
                          <div className="text-xs text-muted-foreground">{document.submittedBy}</div>
                        </div>
                      </div>
                      {(document.workflow?.steps || []).map((step, index) => {
                        const isAfterRejection = (document.workflow?.steps || [])
                          .slice(0, index)
                          .some(s => s.status === 'rejected');

                        return (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            {/* Show red X for rejected steps */}
                            {step.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                            {/* 🆕 Show red X for bypassed steps (Approval Chain with Bypass) */}
                            {step.status === 'bypassed' && <XCircle className="h-4 w-4 text-red-600" />}
                            {/* Show circle-x for cancelled steps */}
                            {step.status === 'cancelled' && (
                              isAfterRejection ? (
                                <XCircle className="h-4 w-4 text-black" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-gray-400 flex items-center justify-center">
                                  <span className="text-gray-400 text-[10px]" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>✕</span>
                                </div>
                              )
                            )}
                            {/* Regular completed steps */}
                            {step.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                            {/* Current and pending steps */}
                            {step.status === 'current' && <Clock className="h-4 w-4 text-blue-600" />}
                            {step.status === 'pending' && <div className="h-4 w-4 rounded-full border border-gray-300" />}
                            <div className="flex-1">
                              <div className={`${step.status === 'current' ? 'font-semibold' : ''} `}>
                                {String(step.name || '')}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-muted-foreground">{String(step.assignee || '')}</div>
                                {/* Dynamic escalation badges */}
                                {step.escalated && step.escalationLevel && (
                                  <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-700">
                                    Escalated {step.escalationLevel}x
                                  </Badge>
                                )}
                                {/* 🆕 Bypassed status for Approval Chain with Bypass */}
                                {step.status === 'bypassed' && (
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                                    BYPASS
                                  </Badge>
                                )}
                                {/* 🆕 Re-Submitted status for Bi-Directional Routing */}
                                {document.workflow?.resubmittedRecipients &&
                                  document.workflow.resubmittedRecipients.some((name: string) =>
                                    step.assignee.toLowerCase().includes(name.toLowerCase())
                                  ) && (
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                                      Re-Submitted
                                    </Badge>
                                  )}
                                {/* Rejected with bypass indicator (Emergency Management) */}
                                {step.status === 'rejected' && document.workflow?.hasBypass && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                    BYPASS
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Signature Status */}
                    {document.requiresSignature && (
                      <div className="flex items-center gap-2 text-sm">
                        <Signature className="h-4 w-4" />
                        {(() => {
                          const currentSignedCount = document.signedBy?.length || 0;

                          if (currentSignedCount > 0) {
                            return (
                              <>
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  {`Signed by ${currentSignedCount} Recipient${currentSignedCount !== 1 ? 's' : ''} `}
                                </span>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                  {`${currentSignedCount} Signature${currentSignedCount !== 1 ? 's' : ''} `}
                                </Badge>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <span>Pending Signatures</span>
                                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                                  0 Signatures
                                </Badge>
                              </>
                            );
                          }
                        })()}
                      </div>
                    )}

                    {/* Description */}
                    {document.description && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm font-medium">Description</span>
                        </div>
                        <div className="bg-muted p-3 rounded text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{document.submittedBy}</span>
                            <span className="text-muted-foreground">{document.submittedDate}</span>
                          </div>
                          <p>{document.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Comments (excluding shared comments) */}
                    {((document.comments && document.comments.length > 0) || (approvalComments[document.id] && approvalComments[document.id].length > 0)) && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm font-medium">Comments</span>
                        </div>
                        {/* Original comments */}
                        {document.comments && document.comments.map((comment, index) => (
                          <div key={`original - ${index} `} className="bg-muted p-3 rounded text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium">{comment.author}</span>
                              <span className="text-muted-foreground">{comment.date}</span>
                            </div>
                            <p>{comment.message}</p>
                          </div>
                        ))}
                        {/* Approval comments from Approval Center (Send Comment only, not shared comments) */}
                        {approvalComments[document.id] && approvalComments[document.id].map((comment, index) => (
                          <div key={`approval - ${index} `} className="bg-muted p-3 rounded text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium">{comment.author}</span>
                              <span className="text-muted-foreground">{comment.date}</span>
                            </div>
                            <p>{comment.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 min-w-[150px]">
                    <Button variant="outline" size="sm" onClick={() => setRemoveConfirmDoc(document)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                      const documentFiles = getDocumentFileEntries(document);

                      if (documentFiles && documentFiles.length > 0) {
                        try {
                          const reconstructedFiles: File[] = [];

                          for (const file of documentFiles) {
                            const fileName = file.file_name || file.name || 'Unknown File';
                            const fileType = file.file_type || file.type || 'application/octet-stream';

                            // ── NEW: Supabase Storage URL path ──────────────
                            if (file.storage_url && file.storage_url.length > 0) {
                              try {
                                console.log('🌐 [Track Documents] Fetching from Supabase Storage:', fileName);
                                const fetchedFile = await supabaseStorageService.fetchFileFromUrl(
                                  file.storage_url,
                                  fileName
                                );
                                reconstructedFiles.push(fetchedFile);
                                console.log('✅ [Track Documents] File fetched from Supabase Storage:', fileName);
                                continue;
                              } catch (urlErr) {
                                console.warn('⚠️ [Track Documents] URL fetch failed, trying fallback:', urlErr);
                              }
                            }

                            // ── LEGACY: base64 data URL fallback ────────────
                            const fileData = file.data || file;
                            if (typeof fileData === 'string' && fileData.startsWith('data:')) {
                              try {
                                const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
                                if (!matches) throw new Error('Invalid data URL format');

                                const mimeType = matches[1] || fileType;
                                const base64Data = matches[2];
                                const binaryString = atob(base64Data);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                  bytes[i] = binaryString.charCodeAt(i);
                                }

                                if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' ||
                                  fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
                                  const isValidJpg = isJpg(bytes);
                                  if (!isValidJpg) {
                                    throw new Error(`Invalid JPEG file: ${fileName}.`);
                                  }
                                }

                                const blob = new Blob([bytes], { type: mimeType });
                                reconstructedFiles.push(new File([blob], fileName, { type: mimeType }));
                              } catch (err) {
                                console.error('❌ [Track Documents] Failed to reconstruct file:', fileName, err);
                                toast({ title: "File Error", description: `Failed to load ${fileName}`, variant: "destructive" });
                              }
                            } else if (fileData instanceof File) {
                              reconstructedFiles.push(fileData);
                            }
                          }

                          // Persisted signed artifacts already contain the baked signature;
                          // attach overlays only when falling back to an unsigned original.
                          if ((!document.signedFileUrls || document.signedFileUrls.length === 0) &&
                            document.signatureMetadata && reconstructedFiles.length > 0) {
                            reconstructedFiles.forEach(f => {
                              (f as any).signatureMetadata = (document as any).signatureMetadata;
                            });
                          }

                          if (reconstructedFiles.length > 1 && onViewFiles) {
                            onViewFiles(reconstructedFiles);
                          } else if (reconstructedFiles.length > 0 && onViewFile) {
                            onViewFile(reconstructedFiles[0]);
                          }
                        } catch (error) {
                          console.error('Error loading files:', error);
                          toast({ title: "Error", description: "Failed to load files", variant: "destructive" });
                        }
                      } else if (onViewFile) {
                        const file = createDocumentFile(document);
                        onViewFile(file);
                      }
                    }}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                      const documentFiles = getDocumentFileEntries(document);

                      if (documentFiles && documentFiles.length > 0) {
                        try {
                          console.log('📥 [Track Documents] Starting download for', documentFiles.length, 'files');

                          for (const file of documentFiles) {
                            const fileName = file.file_name || file.name || 'Document';

                            // ── NEW: Supabase Storage URL path ──────────────
                            if (file.storage_url && file.storage_url.length > 0) {
                              try {
                                console.log('🌐 [Track Documents] Downloading from Supabase Storage:', fileName);
                                const blob = await supabaseStorageService.downloadFile(file.storage_path);
                                const url = URL.createObjectURL(blob);
                                const link = window.document.createElement('a');
                                link.href = url;
                                link.download = fileName;
                                window.document.body.appendChild(link);
                                link.click();
                                window.document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                console.log('✅ [Track Documents] File downloaded from Supabase Storage:', fileName);
                                continue;
                              } catch (urlErr) {
                                console.warn('⚠️ [Track Documents] Storage download failed, trying fallback:', urlErr);
                              }
                            }

                            // ── LEGACY: base64 data URL fallback ────────────
                            const fileData = file.data || file;
                            const fileType = file.type || 'application/octet-stream';

                            if (typeof fileData === 'string' && fileData.startsWith('data:')) {
                              try {
                                const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
                                if (matches && matches.length === 3) {
                                  const mimeType = matches[1];
                                  const base64Data = matches[2];
                                  const byteCharacters = atob(base64Data);
                                  const byteNumbers = new Array(byteCharacters.length);
                                  for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                  }
                                  const byteArray = new Uint8Array(byteNumbers);
                                  const blob = new Blob([byteArray], { type: mimeType });
                                  const url = URL.createObjectURL(blob);
                                  const link = window.document.createElement('a');
                                  link.href = url;
                                  link.download = fileName;
                                  window.document.body.appendChild(link);
                                  link.click();
                                  window.document.body.removeChild(link);
                                  URL.revokeObjectURL(url);
                                  console.log('✅ [Track Documents] File downloaded (base64):', fileName);
                                }
                              } catch (err) {
                                console.error('❌ [Track Documents] Failed to download file:', fileName, err);
                              }
                            } else if (fileData instanceof File || fileData instanceof Blob) {
                              const url = URL.createObjectURL(fileData);
                              const link = window.document.createElement('a');
                              link.href = url;
                              link.download = fileName;
                              window.document.body.appendChild(link);
                              link.click();
                              window.document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                              console.log('✅ [Track Documents] File downloaded (blob):', fileName);
                            }
                          }

                          toast({
                            title: "Download Complete",
                            description: `${documentFiles.length} file(s) downloaded successfully`,
                          });
                        } catch (error) {
                          console.error('❌ [Track Documents] Download failed:', error);
                          toast({ title: "Download Failed", description: "Failed to download files", variant: "destructive" });
                        }
                      } else {
                        const htmlFile = createDocumentFile(document);
                        const url = URL.createObjectURL(htmlFile);
                        const link = window.document.createElement('a');
                        link.href = url;
                        link.download = htmlFile.name;
                        link.click();
                        URL.revokeObjectURL(url);
                        toast({ title: "Download Started", description: `${document.title} downloaded as HTML` });
                      }
                    }}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>

                    {/* 🆕 Bi-Directional Routing: Resend & Re-Upload Buttons */}
                    {(() => {
                      const isBidirectional = (document as any).routingType === 'bidirectional';
                      const hasBypassedRecipients = (document as any).workflow?.bypassedRecipients?.length > 0;
                      const isOwner = document.submittedBy === currentUserProfile.name ||
                        document.submittedBy === userRole ||
                        (document as any).submittedByDesignation === userRole ||
                        (document as any).submittedByDesignation === currentUserProfile.designation;

                      console.log('🔍 [Bi-Directional Buttons Check]:', {
                        title: document.title,
                        routingType: (document as any).routingType,
                        isBidirectional,
                        bypassedRecipients: (document as any).workflow?.bypassedRecipients,
                        hasBypassedRecipients,
                        submittedBy: document.submittedBy,
                        currentUser: currentUserProfile.name,
                        userRole,
                        isOwner,
                        showButtons: isBidirectional && hasBypassedRecipients && isOwner
                      });

                      return isBidirectional && hasBypassedRecipients && isOwner;
                    })() && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                            onClick={() => {
                              setSelectedDocForResend(document);
                              setSelectedRecipients([]); // Start with none selected
                              setShowResendDialog(true);
                            }}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Choose & Resend
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-700"
                            onClick={() => {
                              // Open file upload dialog
                              const fileInput = window.document.createElement('input');
                              fileInput.type = 'file';
                              fileInput.multiple = true;
                              fileInput.accept = '.pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg';

                              fileInput.onchange = async (e: any) => {
                                const files = Array.from(e.target.files || []) as File[];

                                if (files.length > 0) {
                                  console.log('📤 Re-uploading files:', files.map(f => f.name));

                                  // Convert files to base64
                                  const convertFilesToBase64 = async (files: File[]) => {
                                    const filePromises = files.map(file => {
                                      return new Promise((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          resolve({
                                            name: file.name,
                                            size: file.size,
                                            type: file.type,
                                            data: reader.result as string
                                          });
                                        };
                                        reader.readAsDataURL(file);
                                      });
                                    });
                                    return Promise.all(filePromises);
                                  };

                                  const serializedFiles = await convertFilesToBase64(files);

                                  // Update document files in Supabase
                                  try {
                                    await workflowService.updateDocumentFiles(document.id, serializedFiles as any[]);

                                    // Refresh from Supabase
                                    await refetch();

                                    toast({
                                      title: "Document Updated",
                                      description: `✅ ${files.length} file(s) uploaded. Click Resend to send to rejected recipients.`,
                                      duration: 4000,
                                    });
                                  } catch (err) {
                                    console.error('Failed to update files:', err);
                                    toast({
                                      title: "Error",
                                      description: "Failed to upload files. Please try again.",
                                      variant: "destructive"
                                    });
                                  }
                                }
                              };

                              fileInput.click();
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Re-Upload Document
                          </Button>
                        </>
                      )}


                    {userRole === 'Principal' || userRole === 'Registrar' || userRole === 'HOD' ? (
                      <>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() => setSelectedDocument(document)}
                              disabled={document.status === 'approved' || document.status === 'rejected'}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Review & Approve Document</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <Label>Document</Label>
                                  <p>{document.title}</p>
                                </div>
                                <div>
                                  <Label>Type</Label>
                                  <p>{document.type}</p>
                                </div>
                                <div>
                                  <Label>Submitted By</Label>
                                  <p>{document.submittedBy}</p>
                                </div>
                                <div>
                                  <Label>Date</Label>
                                  <p>{document.submittedDate}</p>
                                </div>
                              </div>

                              {document.requiresSignature && (
                                <div>
                                  <Label className="text-base font-semibold">Digital Signature Required</Label>
                                  <DigitalSignature
                                    userRole={userRole}
                                    userName={currentUserProfile.name}
                                    onSignatureCapture={handleSignatureCapture}
                                  />
                                </div>
                              )}

                              <div>
                                <Label htmlFor="comment">Add Comment (Optional)</Label>
                                <Textarea
                                  id="comment"
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  placeholder="Add your review comments here..."
                                  className="mt-2"
                                />
                              </div>

                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => handleReject(document.id)}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                                <Button onClick={() => handleApprove(document.id)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDocuments.length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
              <p className="text-muted-foreground">
                No documents match your current search and filter criteria.
              </p>
            </CardContent>
          </Card>
        )}
        {/* Loading indicator — only shown when there are no cached cards yet */}
        {loading && filteredDocuments.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-muted-foreground text-sm">Loading your documents…</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Smart Remove Confirmation Dialog ────────────────────────────── */}
      <Dialog open={!!removeConfirmDoc} onOpenChange={(open) => { if (!open && !removing) setRemoveConfirmDoc(null); }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md rounded-2xl sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {removeConfirmDoc && isWorkflowInProgress(removeConfirmDoc) ? (
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  Remove Workflow
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <div className="font-medium text-emerald-600 text-sm flex items-center gap-1">
                    🟢 Completed Workflow
                  </div>
                  <div className="flex items-center gap-2 text-lg">
                    <FileClock className="h-5 w-5 text-muted-foreground" />
                    Remove from Tracking
                  </div>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-muted-foreground">
              {removeConfirmDoc && isWorkflowInProgress(removeConfirmDoc) ? (
                <span>
                  <span className="font-semibold text-foreground block mb-1">
                    "{removeConfirmDoc?.title}"
                  </span>
                  This Workflow Is Still <span className="font-medium text-amber-600 dark:text-amber-400">In Progress</span>. Removing It Will{' '}
                  <span className="font-medium text-destructive">Permanently Delete</span> All Related Approvals,
                  Chat Messages, Analytics Records, and Workflow Data.
                </span>
              ) : (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground block mb-2">
                    "{removeConfirmDoc?.title}"
                  </span>
                  <p>
                    This workflow is already completed. It will be moved to the Archive and removed from your active tracking list. Audit records will remain for history and compliance.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={removing}
              onClick={() => setRemoveConfirmDoc(null)}
            >
              Cancel
            </Button>
            <Button
              variant={removeConfirmDoc && isWorkflowInProgress(removeConfirmDoc) ? 'destructive' : 'default'}
              size="sm"
              disabled={removing}
              onClick={() => handleRemove(removeConfirmDoc)}
            >
              {removing ? (
                <><span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin mr-2" />Processing…</>
              ) : removeConfirmDoc && isWorkflowInProgress(removeConfirmDoc) ? (
                <><Trash2 className="h-4 w-4 mr-2" />Remove Permanently</>
              ) : (
                <><FileClock className="h-4 w-4 mr-2" />Move to Archive</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Recipient Selection Dialog for Resend/Re-Upload ────────────────────────────── */}
      <Dialog open={showResendDialog} onOpenChange={setShowResendDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Choose Recipients to Resend
            </DialogTitle>
            <DialogDescription>
              Select which rejected recipients should receive the document again.
              You can re-upload files before resending.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Document Info */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-semibold">{selectedDocForResend?.title}</p>
              <p className="text-sm text-muted-foreground">
                {selectedDocForResend?.workflow?.bypassedRecipients?.length || 0} recipient(s) rejected this document
              </p>
            </div>

            {/* Recipient Selection List */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Recipients:</Label>
              {selectedDocForResend?.workflow?.bypassedRecipients?.map((recipientName: string) => {
                const step = selectedDocForResend.workflow.steps.find(
                  s => s.assignee.toLowerCase().includes(recipientName.toLowerCase())
                );
                
                return (
                  <div
                    key={recipientName}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedRecipients(prev =>
                        prev.includes(recipientName)
                          ? prev.filter(r => r !== recipientName)
                          : [...prev, recipientName]
                      );
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(recipientName)}
                      onChange={() => {}}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{recipientName}</span>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                          BYPASSED
                        </Badge>
                      </div>
                      {step?.bypassReason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reason: {step.bypassReason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Select All / Deselect All */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRecipients(selectedDocForResend?.workflow?.bypassedRecipients || []);
                }}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecipients([])}
              >
                Deselect All
              </Button>
            </div>

            {/* Re-Upload Section */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-2 block">
                Re-Upload Files (Optional)
              </Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const fileInput = document.createElement('input');
                  fileInput.type = 'file';
                  fileInput.multiple = true;
                  fileInput.accept = '.pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg';

                  fileInput.onchange = async (e: any) => {
                    const files = Array.from(e.target.files || []) as File[];
                    
                    if (files.length > 0 && selectedDocForResend) {
                      try {
                        const convertFilesToBase64 = async (files: File[]) => {
                          return Promise.all(
                            files.map(file => 
                              new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  resolve({
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                    data: reader.result as string
                                  });
                                };
                                reader.readAsDataURL(file);
                              })
                            )
                          );
                        };

                        const serializedFiles = await convertFilesToBase64(files);
                        await workflowService.updateDocumentFiles(
                          selectedDocForResend.id, 
                          serializedFiles as any[]
                        );

                        toast({
                          title: "Files Updated",
                          description: `✅ ${files.length} file(s) uploaded successfully`,
                        });
                      } catch (err) {
                        console.error('Failed to upload files:', err);
                        toast({
                          title: "Error",
                          description: "Failed to upload files",
                          variant: "destructive"
                        });
                      }
                    }
                  };

                  fileInput.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload New Files
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Upload revised documents before resending to selected recipients
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowResendDialog(false);
                setSelectedRecipients([]);
                setSelectedDocForResend(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={selectedRecipients.length === 0}
              onClick={async () => {
                if (!selectedDocForResend || selectedRecipients.length === 0) return;

                try {
                  // Call selective resend function
                  const resetCount = await workflowService.resendToSelectedRecipients(
                    selectedDocForResend.id,
                    selectedRecipients
                  );

                  await refetch();

                  toast({
                    title: "Document Resent",
                    description: `✅ Approval card resent to ${resetCount} selected recipient(s)`,
                  });

                  setShowResendDialog(false);
                  setSelectedRecipients([]);
                  setSelectedDocForResend(null);
                } catch (err) {
                  console.error('Failed to resend:', err);
                  toast({
                    title: "Error",
                    description: "Failed to resend document",
                    variant: "destructive"
                  });
                }
              }}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Resend to {selectedRecipients.length} Recipient(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
