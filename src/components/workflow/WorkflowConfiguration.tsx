import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResponsive } from '@/hooks/useResponsive';
import { RecipientSelector } from '@/components/approval/RecipientSelector';
import { LoadingState } from '@/components/ui/loading-states';
import { BiDirectionalWorkflowEngine } from '@/services/BiDirectionalWorkflowEngine';
import { WorkflowRoute, WorkflowStep } from '@/types/workflow';
import { cn } from '@/lib/utils';
import { ClockLoading } from '@/components/ui/loading-animation';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  ArrowRight,
  ArrowDown,
  Shield,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Copy,
  RotateCcw,
  Upload,
  FileText,
  File,
  X,
  ChevronsRight,
  Eye,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileViewer } from '@/components/documents/FileViewer';
import { documentService } from '@/services/DocumentService';
import { workflowService } from '@/services/WorkflowService';
import { recipientService } from '@/services/RecipientService';
import { useTutorialContext } from "@/contexts/TutorialContext";
import { useRecipientNames } from "@/hooks/useRecipientNames";
import { supabaseStorageService } from "@/services/SupabaseStorageService";
import { formatFileSize } from "@/utils/fileSize";

interface WorkflowConfigurationProps {
  className?: string;
  hideWorkflowsTab?: boolean;
  bypassService?: any;
  onSuccess?: () => void;
  borderAnimationDuration?: string;
}

export const WorkflowConfiguration: React.FC<WorkflowConfigurationProps> = ({ 
  className, 
  hideWorkflowsTab = false, 
  bypassService, 
  onSuccess,
  borderAnimationDuration = "3s" 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useResponsive();
  const [workflowEngine] = useState(() => new BiDirectionalWorkflowEngine());
  const [workflows, setWorkflows] = useState<WorkflowRoute[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRoute | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [activeTab, setActiveTab] = useState('workflows');

  // Form states
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowType, setWorkflowType] = useState<'sequential' | 'parallel' | 'bidirectional'>('sequential');

  const [autoEscalation, setAutoEscalation] = useState(false);
  const [escalationTimeout, setEscalationTimeout] = useState(24);
  const [escalationTimeUnit, setEscalationTimeUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'>('hours');

  // Step form states
  const [stepName, setStepName] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [stepRole, setStepRole] = useState('');
  const [stepRequiredApprovals, setStepRequiredApprovals] = useState(1);

  // Document management states
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentPriority, setDocumentPriority] = useState('low');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assigningFile, setAssigningFile] = useState<File | null>(null);
  const [documentAssignments, setDocumentAssignments] = useState<{ [key: string]: string[] }>({});
  const [stepTimeoutHours, setStepTimeoutHours] = useState(24);
  const [stepEscalationRoles, setStepEscalationRoles] = useState<string[]>([]);

  const [viewingFile, setViewingFile] = useState<File | null>(null);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Resolve recipient names for display
  const allRecipientNames = useRecipientNames(selectedRecipients);

  const availableRoles = ['principal', 'registrar', 'program-head', 'hod', 'employee'];

  let tutorialContext;
  try {
    tutorialContext = useTutorialContext();
  } catch (e) {
    tutorialContext = null;
  }

  const isAdvancedApprovalActive = tutorialContext?.isActive && tutorialContext?.isAdvanced;
  const currentAdvStepId = isAdvancedApprovalActive ? tutorialContext.steps[tutorialContext.currentStep]?.id : null;

  const isSequentialStep = currentAdvStepId === 'adv-approval-routing-sequential';
  const isParallelStep = currentAdvStepId === 'adv-approval-routing-parallel';
  const isBidirectionalStep = currentAdvStepId === 'adv-approval-routing-bidirectional';
  const isApprovalAssignmentStep = currentAdvStepId === 'adv-approval-assignment';

  const isApprovalTutorialActive = isSequentialStep || isParallelStep || isBidirectionalStep || isApprovalAssignmentStep;

  // Mock data for tutorial previews
  const displayFiles = isApprovalAssignmentStep && uploadedFiles.length === 0
    ? [new window.File([""], "Contract_Draft.pdf", { type: "application/pdf" }), new window.File([""], "Budget_Report.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })]
    : uploadedFiles;

  const displayRecipients = isApprovalAssignmentStep && selectedRecipients.length === 0
    ? ["mock_hod", "mock_principal"]
    : selectedRecipients;

  // Resolve names for all display recipients (including mock ones)
  const allDisplayRecipientNames = useRecipientNames(displayRecipients);

  // Document management constants
  const documentTypeOptions = [
    { id: "letter", label: "Letter", icon: FileText },
    { id: "circular", label: "Circular", icon: File },
    { id: "report", label: "Report", icon: FileText },
  ];

  // Document management functions
  const handleDocumentTypeChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setDocumentTypes([typeId]);
    } else {
      setDocumentTypes([]);
    }
  };

  const handleDocumentTypeRadio = (typeId: string) => {
    setDocumentTypes([typeId]);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleViewFile = (file: File) => {
    // Open the file in the FileViewer modal instead of a new tab
    setViewingFile(file);
    setShowFileViewer(true);
  };

  useEffect(() => {
    if (user) {
      refreshWorkflows();
    }
  }, [user]);

  useEffect(() => {
    if ((hideWorkflowsTab || isApprovalTutorialActive) && !selectedWorkflow && !isCreating) {
      setIsCreating(true);
      setIsEditing(true);
      setActiveTab('designer');
    }
  }, [hideWorkflowsTab, selectedWorkflow, isCreating, isApprovalTutorialActive]);

  useEffect(() => {
    if (isSequentialStep) setWorkflowType('sequential');
    if (isParallelStep) setWorkflowType('parallel');
    if (isBidirectionalStep) setWorkflowType('bidirectional');
  }, [isSequentialStep, isParallelStep, isBidirectionalStep]);

  const refreshWorkflows = () => {
    const allWorkflows = workflowEngine.getAllWorkflowRoutes();
    setWorkflows(allWorkflows);
  };

  const resetForms = () => {
    setWorkflowName('');
    setWorkflowDescription('');
    setWorkflowType('sequential');

    setAutoEscalation(false);
    setEscalationTimeout(24);
    setEscalationTimeUnit('hours');
    // Reset document management fields
    setDocumentTitle('');
    setDocumentTypes([]);
    setUploadedFiles([]);
    setSelectedRecipients([]);
    setDocumentDescription('');
    setDocumentPriority('low');
    setDocumentAssignments({});
    resetStepForm();
  };

  const resetStepForm = () => {
    setStepName('');
    setStepDescription('');
    setStepRole('');
    setStepRequiredApprovals(1);
    setStepTimeoutHours(24);
    setStepEscalationRoles([]);

  };

  const loadWorkflow = (workflow: WorkflowRoute) => {
    setSelectedWorkflow(workflow);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description);
    setWorkflowType(workflow.type);

    setAutoEscalation(workflow.autoEscalation.enabled);
    setEscalationTimeout(workflow.autoEscalation.timeoutHours);
    setEscalationTimeUnit('hours');
  };

  const loadStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setStepName(step.name);
    setStepDescription(step.description);
    setStepRole(step.approverRole);
    setStepRequiredApprovals(step.requiredApprovals);
    setStepTimeoutHours(step.timeoutHours || 24);
    setStepEscalationRoles(step.escalationRoles || []);

  };

  const handleSaveWorkflow = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // If this is a document submission (has document title and files), create tracking card
      if (documentTitle && (uploadedFiles.length > 0 || selectedRecipients.length > 0)) {
        // Set submitting state briefly for visual feedback
        setIsSubmitting(true);

        // Capture current values needed for background processing to avoid race conditions with form reset
        const submissionData = {
          documentTitle,
          documentTypes: [...documentTypes],
          uploadedFiles: [...uploadedFiles],
          selectedRecipients: [...selectedRecipients],
          documentDescription,
          documentPriority,
          documentAssignments: { ...documentAssignments },
          workflowType,
          user: { ...user },
          currentUserName: user?.name || 'User',
          currentUserDept: user?.department || 'Department',
          currentUserDesignation: user?.role || 'Employee',
          currentUserRole: user?.role || 'employee'
        };

        console.log('📋 [Approval Chain Bypass] Initiating fast-track submission...');

        // Optimistically transition the UI immediately for "instant" feel
        setTimeout(() => {
          // Reset form
          setDocumentTitle('');
          setDocumentTypes([]);
          setUploadedFiles([]);
          setSelectedRecipients([]);
          setDocumentDescription('');
          setDocumentPriority('low');
          setDocumentAssignments({});
          setIsSubmitting(false);

          // Redirect callback
          if (onSuccess) {
            onSuccess();
          }

          toast({
            title: "Bypass Document Submitted",
            description: "Your bypass document is being processed and sent to the selected recipients instantly.",
            duration: 3000
          });
        }, 100);

        // Primary background submission logic
        (async () => {
          try {
            // 1. Parallel prep: Resolve recipient names + pre-upload files to Supabase Storage
            const [recipientNames, uploadedFilesMetadata] = await Promise.all([
              Promise.all(submissionData.selectedRecipients.map((id: string) => recipientService.getRecipientName(id))),
              (async () => {
                if (submissionData.uploadedFiles.length === 0) return [];
                try {
                  const tempDocId = `bypass-${Date.now()}`;
                  const results = await supabaseStorageService.uploadFiles(
                    submissionData.uploadedFiles,
                    tempDocId
                  );
                  console.log(`[Bypass] ✅ Pre-uploaded ${results.length} file(s) to Supabase Storage.`);
                  return results;
                } catch (uploadErr) {
                  console.warn('[Bypass] ⚠️ File pre-upload failed, submitting without files:', uploadErr);
                  return [];
                }
              })()
            ]);

            // Lean file descriptors for bypass_documents.files (no raw data)
            const filesForBypassTable = uploadedFilesMetadata.map((f: any) => ({
              name: f.file_name,
              file_name: f.file_name,
              type: f.file_type,
              file_type: f.file_type,
              size: f.file_size,
              file_size: f.file_size,
              storage_path: f.storage_path,
              storage_url: f.storage_url,
            }));

            const totalRecipients = submissionData.selectedRecipients.length;

            // 2. Submit to Bypass Service (Supabase)
            let createdBypassDocId: string | null = null;
            if (bypassService) {
              try {
                const bypassDoc = {
                  title: submissionData.documentTitle,
                  description: submissionData.documentDescription,
                  document_types: submissionData.documentTypes,
                  routing_type: submissionData.workflowType,
                  priority: submissionData.documentPriority,
                  submitter_id: submissionData.user?.id || 'unknown',
                  submitter_name: submissionData.currentUserName,
                  submitter_role: submissionData.currentUserRole,
                  status: totalRecipients > 0 ? 'pending' as const : 'approved' as const,
                  files: filesForBypassTable,
                  file_assignments: submissionData.documentAssignments,
                  recipients: submissionData.selectedRecipients,
                  recipient_names: recipientNames as string[],
                  bypassed_recipients: [],
                  resubmitted_recipients: [],
                  signed_by: [],
                  total_recipients: totalRecipients,
                  signature_count: 0
                };

                const result = await bypassService.createDocument(bypassDoc);
                if (result.success) {
                  createdBypassDocId = result.data.id;
                  console.log('✅ Bypass document created in Supabase:', createdBypassDocId);
                }
              } catch (error) {
                console.warn('⚠️ Bypass Supabase save failed:', error);
              }
            }

            // 3. Independent Background Tasks (Unified Workflow, Notifications)
            (async () => {
              try {
                const unifiedDoc = await documentService.createDocument({
                  title: submissionData.documentTitle,
                  description: submissionData.documentDescription,
                  type: submissionData.documentTypes[0] || 'Document',
                  priority: submissionData.documentPriority,
                  submitter_id: submissionData.user?.id || 'unknown',
                  submitter_name: submissionData.currentUserName,
                  submitter_department: submissionData.currentUserDept,
                  submitter_designation: submissionData.currentUserDesignation,
                  is_emergency: false,
                  files: [],
                  filesMetadata: uploadedFilesMetadata,
                  recipients: recipientNames as string[],
                  recipient_ids: submissionData.selectedRecipients,
                  source: 'approval-chain-bypass',
                });

                if (unifiedDoc) {
                  const recipients = submissionData.selectedRecipients.map((id: string, i: number) => ({
                    id,
                    name: (recipientNames as string[])[i] || 'Unknown'
                  }));

                  await workflowService.createWorkflow({
                    documentId: unifiedDoc.id,
                    recipients,
                    isParallel: submissionData.workflowType === 'parallel' || submissionData.workflowType === 'bidirectional',
                    routingType: submissionData.workflowType,
                    source: 'approval-chain-bypass',
                    hasBypass: true,
                  });

                  // Send Notifications
                  const { ExternalNotificationDispatcher } = await import('@/services/ExternalNotificationDispatcher');
                  for (const recipientId of submissionData.selectedRecipients) {
                    const recipientName = (recipientNames as string[])[submissionData.selectedRecipients.indexOf(recipientId)];
                    ExternalNotificationDispatcher.notifyRecipient(
                      recipientId,
                      recipientName,
                      {
                        type: 'approval',
                        documentTitle: submissionData.documentTitle,
                        submitter: submissionData.currentUserName,
                        priority: submissionData.documentPriority,
                        approvalCenterLink: `${window.location.origin}/approvals#${unifiedDoc.id}`,
                        recipientName: recipientName
                      }
                    ).catch(e => console.error('Notification failed:', e));
                  }
                }
              } catch (unifiedError) {
                console.error('❌ Background unified workflow creation failed:', unifiedError);
              }
            })();

          } catch (error) {
            console.error('❌ Background bypass submission error:', error);
          }
        })();

        return;
      }

      const workflow: WorkflowRoute = {
        id: selectedWorkflow?.id || `workflow-${Date.now()}`,
        name: documentTitle || 'Bypass Workflow',
        description: workflowDescription,
        type: workflowType,
        documentType: 'general',
        steps: selectedWorkflow?.steps || [],
        escalationPaths: selectedWorkflow?.escalationPaths || [],
        requiresCounterApproval: false,
        autoEscalation: {
          enabled: autoEscalation,
          timeoutHours: escalationTimeout
        },
        isActive: true,
        createdBy: user.id,
        createdAt: selectedWorkflow?.createdAt || new Date(),
        updatedAt: new Date()
      };

      workflowEngine.createWorkflowRoute(workflow);

      toast({
        title: 'Success',
        description: `Workflow ${isCreating ? 'created' : 'updated'} successfully`,
        variant: 'default'
      });

      refreshWorkflows();
      setSelectedWorkflow(workflow);
      setIsEditing(false);
      setIsCreating(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save workflow',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveStep = () => {
    if (!stepName.trim() || !stepRole) {
      toast({
        title: 'Validation Error',
        description: 'Step name and approver role are required',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedWorkflow) return;

    const step: WorkflowStep = {
      id: editingStep?.id || `step-${Date.now()}`,
      name: stepName,
      description: stepDescription,
      roleRequired: [stepRole],
      approverRole: stepRole,
      requiredApprovals: stepRequiredApprovals,
      timeoutHours: stepTimeoutHours,
      escalationRoles: stepEscalationRoles.length > 0 ? stepEscalationRoles : undefined,

      isOptional: false,
      order: editingStep?.order || selectedWorkflow.steps.length + 1
    };

    const updatedSteps = editingStep
      ? selectedWorkflow.steps.map(s => s.id === editingStep.id ? step : s)
      : [...selectedWorkflow.steps, step];

    const updatedWorkflow = {
      ...selectedWorkflow,
      steps: updatedSteps,
      updatedAt: new Date()
    };

    try {
      workflowEngine.createWorkflowRoute(updatedWorkflow);

      toast({
        title: 'Success',
        description: `Step ${editingStep ? 'updated' : 'added'} successfully`,
        variant: 'default'
      });

      refreshWorkflows();
      setSelectedWorkflow(updatedWorkflow);
      setEditingStep(null);
      resetStepForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save step',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteStep = (stepId: string) => {
    if (!selectedWorkflow) return;

    const updatedSteps = selectedWorkflow.steps
      .filter(s => s.id !== stepId)
      .map((step, index) => ({ ...step, order: index + 1 }));

    const updatedWorkflow = {
      ...selectedWorkflow,
      steps: updatedSteps,
      updatedAt: new Date()
    };

    try {
      workflowEngine.createWorkflowRoute(updatedWorkflow);

      toast({
        title: 'Success',
        description: 'Step deleted successfully',
        variant: 'default'
      });

      refreshWorkflows();
      setSelectedWorkflow(updatedWorkflow);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete step',
        variant: 'destructive'
      });
    }
  };

  const handleCloneWorkflow = (workflow: WorkflowRoute) => {
    const clonedWorkflow: WorkflowRoute = {
      ...workflow,
      id: `workflow-${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || ''
    };

    try {
      workflowEngine.createWorkflowRoute(clonedWorkflow);

      toast({
        title: 'Success',
        description: 'Workflow cloned successfully',
        variant: 'default'
      });

      refreshWorkflows();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clone workflow',
        variant: 'destructive'
      });
    }
  };

  const WorkflowCard: React.FC<{ workflow: WorkflowRoute }> = ({ workflow }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{workflow.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {workflow.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workflow.type}</Badge>
            <Badge variant="secondary">
              {workflow.steps.length} steps
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">

            {workflow.autoEscalation.enabled && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Auto-Escalation
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCloneWorkflow(workflow)}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                loadWorkflow(workflow);
                setIsEditing(true);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const StepCard: React.FC<{ step: WorkflowStep; index: number }> = ({ step, index }) => (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-medium">
              {index + 1}
            </div>
            <div>
              <CardTitle className="text-base">{step.name}</CardTitle>
              {step.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadStep(step)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteStep(step.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Badge variant="outline">{step.approverRole}</Badge>
            <div className="text-sm text-muted-foreground">
              {step.requiredApprovals} approval{step.requiredApprovals > 1 ? 's' : ''} required
            </div>
          </div>

          {step.timeoutHours && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {step.timeoutHours}h timeout
            </div>
          )}

          {step.escalationRoles && step.escalationRoles.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              Escalates to: {step.escalationRoles.join(', ')}
            </div>
          )}


        </div>
      </CardContent>

      {index < (selectedWorkflow?.steps.length || 0) - 1 && (
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
          <ArrowDown className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
    </Card>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
        </div>
        {!hideWorkflowsTab && (
          <Button
            onClick={() => {
              resetForms();
              setIsCreating(true);
              setIsEditing(true);
              setSelectedWorkflow(null);
              setActiveTab('designer');
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </Button>
        )}
      </div>

      <Tabs value={hideWorkflowsTab ? "designer" : activeTab} onValueChange={setActiveTab} className="space-y-4">
        {!hideWorkflowsTab && (
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            {(selectedWorkflow || isCreating) && (
              <TabsTrigger value="designer">Workflow Designer</TabsTrigger>
            )}
          </TabsList>
        )}

        {!hideWorkflowsTab && (
          <TabsContent value="workflows" className="space-y-4">
            {workflows.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Settings className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Workflows Configured</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first approval workflow to get started.
                  </p>
                  <Button
                    onClick={() => {
                      resetForms();
                      setIsCreating(true);
                      setIsEditing(true);
                      setSelectedWorkflow(null);
                      setActiveTab('designer');
                    }}
                  >
                    Create Workflow
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {workflows.map(workflow => (
                  <div key={workflow.id} onClick={() => setSelectedWorkflow(workflow)}>
                    <WorkflowCard workflow={workflow} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="designer" className="space-y-6">
          {(isEditing || hideWorkflowsTab || isApprovalTutorialActive) ? (
            /* Workflow Editor */
            <div className="space-y-4">
              {/* Document Submission Features */}
              <div className="space-y-4">
                <CardTitle className="flex items-center gap-2 mb-3">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Document Submission
                </CardTitle>

                {/* Document Title and Routing Type side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-base sm:text-sm font-medium">Document Title</label>
                    <Input
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      placeholder="Enter document title..."
                      className="mt-1 text-base sm:text-sm focus-visible:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-base sm:text-sm font-medium">Routing Type</label>
                    <Select value={workflowType} onValueChange={(value: string) => setWorkflowType(value as 'sequential' | 'parallel' | 'bidirectional')}>
                      <SelectTrigger className={`mt-1 text-base sm:text-sm focus:ring-blue-600 focus:border-blue-600 focus-visible:ring-blue-600 ${isApprovalTutorialActive ? 'ring-4 ring-primary ring-offset-2' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sequential" className={isSequentialStep ? 'font-bold text-primary bg-primary/10' : ''}>Sequential Routing</SelectItem>
                        <SelectItem value="parallel" className={isParallelStep ? 'font-bold text-primary bg-primary/10' : ''}>Parallel Routing</SelectItem>
                        <SelectItem value="bidirectional" className={isBidirectionalStep ? 'font-bold text-primary bg-primary/10' : ''}>Bi-Directional Routing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Document Type Selection */}
                <div>
                  <label className="text-base sm:text-sm font-medium">Document Type</label>
                  {/* Mobile: Radio circles */}
                  <div className="grid grid-cols-1 gap-3 mt-1 sm:hidden">
                    {documentTypeOptions.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                        onClick={() => handleDocumentTypeRadio(option.id)}
                      >
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-blue-600">
                          {documentTypes.includes(option.id) && (
                            <div className="w-3 h-3 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-base font-medium">
                          <option.icon className="w-4 h-4" />
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: Checkboxes */}
                  <div className="hidden sm:grid sm:grid-cols-3 gap-3 mt-1">
                    {documentTypeOptions.map((option) => (
                      <div key={option.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
                        <Checkbox
                          id={`doc-${option.id}`}
                          checked={documentTypes.includes(option.id)}
                          onCheckedChange={(checked) => handleDocumentTypeChange(option.id, !!checked)}
                          className="data-[state=checked]:bg-blue-600 border-blue-600"
                        />
                        <label htmlFor={`doc-${option.id}`} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <option.icon className="w-4 h-4" />
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="text-base sm:text-sm font-medium">Upload Documents</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-blue-600 transition-colors mt-1">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="workflow-file-upload"
                      title="Upload document files"
                    />
                    <label htmlFor="workflow-file-upload" className="cursor-pointer">
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                        <p className="text-base sm:text-sm text-muted-foreground font-medium">
                          Drag and drop files here, or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, (Max: 10MB Each File)
                        </p>
                      </div>
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-3 p-3 bg-accent rounded-md border border-border">
                      <label className="text-base sm:text-sm font-medium">Uploaded Files</label>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-2 bg-background rounded-md gap-2 sm:gap-0 border border-border">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full pr-8 sm:pr-0">
                            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                              <File className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-sm truncate max-w-[150px] sm:max-w-xs">{file.name}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {formatFileSize((file as any).file_size ?? file.size)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
                                onClick={() => handleViewFile(file)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Badge>

                              {/* Customize Assignment Badge with Rainbow Animation */}
                              <div className="relative rounded-full p-[1px] overflow-hidden">
                                <style>
                                  {`
                                    @keyframes border-spin {
                                      100% {
                                        transform: rotate(360deg);
                                      }
                                    }
                                  `}
                                </style>
                                {/* Animated rainbow border */}
                                <div 
                                  className="absolute inset-[-100%] opacity-90 pointer-events-none"
                                  style={{
                                    background: "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #5e5ce6, #ff2d55, #ff3b30)",
                                    animation: `border-spin 2s linear infinite`
                                  }}
                                />
                                <Badge
                                  variant="secondary"
                                  className="relative bg-background hover:bg-accent text-[10px] sm:text-xs cursor-pointer flex items-center gap-1 active:scale-95 transition-all py-0 px-2 h-5 border-none shrink-0"
                                  onClick={() => {
                                    setAssigningFile(file);
                                    setShowAssignmentModal(true);
                                  }}
                                >
                                  <Settings className="w-3 h-3" />
                                  Customize Assignment
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {!isApprovalAssignmentStep && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="absolute top-2 right-2 sm:static h-6 w-6 p-0 shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>




                {/* Recipients */}
                <div>
                  <label className="text-base sm:text-sm font-medium">Approval Chain with Bypass Recipients</label>
                  <div className="mt-1">
                    <RecipientSelector
                      userRole={user?.role || 'employee'}
                      selectedRecipients={displayRecipients}
                      onRecipientsChange={setSelectedRecipients}
                      isBypass={true}
                    />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-base sm:text-sm font-medium">Priority Level</label>
                  <Select value={documentPriority} onValueChange={setDocumentPriority}>
                    <SelectTrigger className="mt-1 text-base sm:text-sm focus:ring-blue-600 focus:border-blue-600 focus-visible:ring-blue-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-500" />
                          Low Priority
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          Medium Priority
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          High Priority
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          Urgent Priority
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Document Description */}
                <div>
                  <label className="text-base sm:text-sm font-medium">Document Description / Comments</label>
                  <Textarea
                    value={documentDescription}
                    onChange={(e) => setDocumentDescription(e.target.value)}
                    placeholder="Provide additional context or instructions..."
                    rows={3}
                    className="mt-1 text-base sm:text-sm focus-visible:ring-blue-600 focus:border-blue-600"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setIsCreating(false);
                      if (selectedWorkflow) {
                        loadWorkflow(selectedWorkflow);
                      } else {
                        resetForms();
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      await handleSaveWorkflow();
                    }}
                    variant="default"
                    disabled={isSubmitting}
                    className="font-bold animate-pulse bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                  >
                    {isSubmitting ? (
                      <ClockLoading size="sm" showText={true} message="SUBMITTING..." className="text-white" />
                    ) : (
                      <>
                        <ChevronsRight className="w-4 h-4 mr-2" />
                        SUBMIT BYPASS
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Workflow Display */
            selectedWorkflow && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedWorkflow.name}</CardTitle>
                      <p className="text-muted-foreground mt-1">
                        {selectedWorkflow.description}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6">
                    <Badge variant="outline">{selectedWorkflow.type}</Badge>

                    {selectedWorkflow.autoEscalation.enabled && (
                      <Badge variant="secondary">Auto-Escalation</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Steps Section */}
          {!hideWorkflowsTab && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Workflow Steps</h3>
                {!editingStep && (
                  <Button
                    variant="outline"
                    onClick={() => resetStepForm()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Step
                  </Button>
                )}
              </div>

              {/* Step Editor */}
              {(editingStep || (!editingStep && stepName)) && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingStep ? 'Edit Step' : 'Add New Step'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">Step Name</label>
                        <Input
                          value={stepName}
                          onChange={(e) => setStepName(e.target.value)}
                          placeholder="Enter step name"
                          className="mt-1 text-base sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Approver Role</label>
                        <Select value={stepRole} onValueChange={setStepRole}>
                          <SelectTrigger className="mt-1 text-base sm:text-sm">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map(role => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={stepDescription}
                        onChange={(e) => setStepDescription(e.target.value)}
                        placeholder="Enter step description"
                        className="mt-1 text-base sm:text-sm"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium">Required Approvals</label>
                        <Input
                          type="number"
                          value={stepRequiredApprovals}
                          onChange={(e) => setStepRequiredApprovals(Number(e.target.value))}
                          min={1}
                          max={10}
                          className="mt-1 text-base sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Timeout (hours)</label>
                        <Input
                          type="number"
                          value={stepTimeoutHours}
                          onChange={(e) => setStepTimeoutHours(Number(e.target.value))}
                          min={1}
                          max={168}
                          className="mt-1 text-base sm:text-sm"
                        />
                      </div>


                    </div>

                    <div>
                      <label className="text-sm font-medium">Escalation Roles (Optional)</label>
                      <Select
                        value=""
                        onValueChange={(role) => {
                          if (!stepEscalationRoles.includes(role)) {
                            setStepEscalationRoles([...stepEscalationRoles, role]);
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Add escalation role" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles
                            .filter(role => role !== stepRole && !stepEscalationRoles.includes(role))
                            .map(role => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {stepEscalationRoles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {stepEscalationRoles.map(role => (
                            <Badge key={role} variant="secondary" className="cursor-pointer">
                              {role}
                              <button
                                onClick={() => setStepEscalationRoles(stepEscalationRoles.filter(r => r !== role))}
                                className="ml-2 hover:text-destructive"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-4">
                      <Button onClick={handleSaveStep} className="w-full sm:w-auto">
                        <Save className="w-4 h-4 mr-2" />
                        {editingStep ? 'Update Step' : 'Add Step'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingStep(null);
                          resetStepForm();
                        }}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Steps List */}
              {selectedWorkflow?.steps && selectedWorkflow.steps.length > 0 && (
                <div className="space-y-6">
                  {selectedWorkflow.steps
                    .sort((a, b) => a.order - b.order)
                    .map((step, index) => (
                      <StepCard key={step.id} step={step} index={index} />
                    ))}
                </div>
              )}

              {(!selectedWorkflow?.steps || selectedWorkflow.steps.length === 0) && !editingStep && !stepName && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <ArrowRight className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Steps Configured</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Add workflow steps to define the approval process.
                    </p>
                    <Button onClick={() => resetStepForm()}>
                      Add First Step
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl p-0">
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
            <DialogHeader className="pb-6">
            <DialogTitle>Assign {assigningFile ? `"${assigningFile.name}"` : "Documents"} to Recipients</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mb-8">
              Select which recipients should receive this specific document. By default, it will be sent to all selected recipients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(assigningFile ? [assigningFile] : displayFiles).map((file, fileIndex) => (
              <Card key={fileIndex}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <File className="w-4 h-4" />
                    {file.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {displayRecipients.map((recipientId) => (
                      <div
                        key={recipientId}
                        className={cn(
                          "flex items-center space-x-2 p-2 border rounded cursor-pointer",
                          isMobile ? "py-3 bg-muted/20" : "hover:bg-muted/50"
                        )}
                        onClick={() => {
                          if (isMobile) {
                            const isChecked = documentAssignments[file.name]?.includes(recipientId) ?? true;
                            setDocumentAssignments(prev => {
                              const current = prev[file.name] || [];
                              if (!isChecked) {
                                return { ...prev, [file.name]: [...current, recipientId] };
                              } else {
                                return { ...prev, [file.name]: current.filter(id => id !== recipientId) };
                              }
                            });
                          }
                        }}
                      >
                        {!isMobile && (
                          <Checkbox
                            id={`workflow-${file.name}-${recipientId}`}
                            checked={documentAssignments[file.name]?.includes(recipientId) ?? true}
                            onCheckedChange={(checked) => {
                              setDocumentAssignments(prev => {
                                const current = prev[file.name] || [];
                                if (checked) {
                                  return { ...prev, [file.name]: [...current, recipientId] };
                                } else {
                                  return { ...prev, [file.name]: current.filter(id => id !== recipientId) };
                                }
                              });
                            }}
                          />
                        )}

                        {isMobile && (
                          <div className={cn(
                            "flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-all",
                            (documentAssignments[file.name]?.includes(recipientId) ?? true)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}>
                            {(documentAssignments[file.name]?.includes(recipientId) ?? true) && (
                              <div className="w-2.5 h-2.5 rounded-full bg-white" />
                            )}
                          </div>
                        )}

                        <label
                          htmlFor={!isMobile ? `workflow-${file.name}-${recipientId}` : undefined}
                          className={cn(
                            "text-sm cursor-pointer flex-1",
                            isMobile && "ml-2"
                          )}
                        >
                          {allDisplayRecipientNames[recipientId] || recipientId.replace('-', ' ').toUpperCase()}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="flex flex-row justify-end gap-3 pt-6 border-t mt-4">
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowAssignmentModal(false);
              toast({
                title: "Assignment Saved",
                description: "Document assignments have been saved successfully.",
                variant: "default"
              });
            }}>
              Save
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Viewer Modal */}
      <FileViewer
        file={viewingFile}
        open={showFileViewer}
        onOpenChange={setShowFileViewer}
      />
    </div>
  );
};
