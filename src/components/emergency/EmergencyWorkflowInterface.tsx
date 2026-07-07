import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecipientSelector } from "@/components/approval/RecipientSelector";
import {
  AlertTriangle,
  Siren,
  Zap,
  Clock,
  Users,
  FileText,
  ChevronsRight,
  Shield,
  Bell,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  X,
  File,
  AlertCircle,
  Settings,
  Mail,
  Phone,
  Smartphone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  AlarmClock
} from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";
import { ClockLoading } from "@/components/ui/loading-animation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Siren as SirenIcon } from "lucide-react";
import { FileViewer } from "@/components/documents/FileViewer";
import { NotificationBehaviorPreview } from "@/components/notifications/NotificationBehaviorPreview";
import type { EmergencyNotificationSettings } from "@/services/EmergencyNotificationService";
import { documentService } from "@/services/DocumentService";
import { workflowService } from "@/services/WorkflowService";
import { recipientService } from "@/services/RecipientService";
import { escalationService, EscalationService } from "@/services/EscalationService";
import { useEmergencyContacts } from "@/hooks/useEmergencyContacts";
import { useTutorialContext } from "@/contexts/TutorialContext";
import { useRecipientNames } from "@/hooks/useRecipientNames";
import { supabaseStorageService } from "@/services/SupabaseStorageService";
import { formatFileSize } from "@/utils/fileSize";

interface EmergencySubmission {
  id: string;
  title: string;
  description: string;
  reason: string;
  urgencyLevel: 'medium' | 'urgent' | 'high' | 'critical';
  recipients: string[];
  submittedBy: string;
  submittedAt: Date;
  status: 'submitted' | 'acknowledged' | 'resolved' | 'rejected' | 'escalated';
  responseTime?: number;
  escalationLevel: number;
  currentRecipientIndex?: number;
  originalRecipients?: string[];
  rejectedBy?: string;
  escalationStopped?: boolean;
}

interface EmergencyWorkflowInterfaceProps {
  userRole: string;
  emergencyService: any;
  borderAnimationDuration?: string;
}

// Helper function to convert recipient IDs to names (fetches from Supabase role_recipients)
const getRecipientName = async (recipientId: string): Promise<string> => {
  return recipientService.getRecipientName(recipientId);
};

export const EmergencyWorkflowInterface: React.FC<EmergencyWorkflowInterfaceProps> = ({ userRole, emergencyService, borderAnimationDuration = "3s" }) => {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const { contacts: emergencyContacts } = useEmergencyContacts();
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [viewingFile, setViewingFile] = useState<File | null>(null);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [emergencyData, setEmergencyData] = useState({
    title: '',
    description: '',
    reason: '',
    urgencyLevel: 'medium' as const,
    documentTypes: [] as string[],
    uploadedFiles: [] as File[],
    attachments: [] as File[],
    autoEscalation: false,
    escalationTimeout: 24,
    escalationTimeUnit: 'hours' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
    cyclicEscalation: true,
    bypassMode: false
  });
  const [useProfileDefaults, setUseProfileDefaults] = useState(true);
  const [overrideNotifications, setOverrideNotifications] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: false,
    emailInterval: '15',
    emailUnit: 'minutes' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
    smsAlerts: false,
    smsInterval: '30',
    smsUnit: 'minutes' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
    pushNotifications: false,
    pushInterval: '5',
    pushUnit: 'minutes' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
    whatsappNotifications: false,
    whatsappInterval: '1',
    whatsappUnit: 'hours' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
    notificationLogic: 'document-based' as 'document-based' | 'recipient-based'
  });
  const [recipientNotifications, setRecipientNotifications] = useState<{ [key: string]: typeof notificationSettings }>({});
  const [openRecipients, setOpenRecipients] = useState<{ [key: string]: boolean }>({});
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assigningFile, setAssigningFile] = useState<File | null>(null);
  const [documentAssignments, setDocumentAssignments] = useState<{ [key: string]: string[] }>({});
  const [showRecipientSelection, setShowRecipientSelection] = useState(false);
  const [finalSelectedRecipients, setFinalSelectedRecipients] = useState<string[]>([]);
  const [routingType, setRoutingType] = useState<'sequential' | 'parallel'>('sequential');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const useSupabase = !!emergencyService;
  
  // Resolve recipient names for display
  const allRecipientNames = useRecipientNames(selectedRecipients);

  // Use Supabase data if available, otherwise empty array
  const emergencyHistory = emergencyService?.documents || [];
  const statistics = useMemo(() => emergencyService?.getStatistics() || { 
    active: 0, 
    resolved: 0, 
    resolvedMonth: 0, 
    avgResponseTime: 0, 
    responseRate: 0 
  }, [emergencyService?.documents]);
  const { toast } = useToast();

  let tutorialContext;
  try {
    tutorialContext = useTutorialContext();
  } catch (e) {
    tutorialContext = null;
  }

  const isAdvancedEmergencyActive = tutorialContext?.isActive && tutorialContext?.isAdvanced;
  const currentAdvStepId = isAdvancedEmergencyActive ? tutorialContext.steps[tutorialContext.currentStep]?.id : null;

  const isAutoForwardStep = currentAdvStepId === 'adv-emerg-auto-forward';
  const isDocAssignmentStep = currentAdvStepId === 'adv-emerg-doc-assignment';
  const isSequentialRoutingStep = currentAdvStepId === 'adv-emerg-sequential-routing';
  const isParallelRoutingStep = currentAdvStepId === 'adv-emerg-parallel-routing';

  const displayEmergencyMode = isEmergencyMode || isAutoForwardStep || isDocAssignmentStep || isSequentialRoutingStep || isParallelRoutingStep;

  // Mock data for tutorial previews
  const displayFiles = emergencyData.uploadedFiles;


  const displayRecipients = (isDocAssignmentStep || isSequentialRoutingStep || isParallelRoutingStep) && selectedRecipients.length === 0
    ? ["legal-team", "management-board"]
    : selectedRecipients;

  // Resolve names for all display recipients (including mock ones)
  const allDisplayRecipientNames = useRecipientNames(displayRecipients);


  const urgencyLevels = {
    medium: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Clock,
      description: ''
    },
    urgent: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: AlertTriangle,
      description: ''
    },
    high: {
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      icon: AlertTriangle,
      description: ''
    },
    critical: {
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: Siren,
      description: ''
    }
  };

  const documentTypeOptions = [
    { id: "letter", label: "Letter", icon: FileText },
    { id: "circular", label: "Circular", icon: File },
    { id: "report", label: "Report", icon: FileText },
  ];

  const handleDocumentTypeChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setEmergencyData({ ...emergencyData, documentTypes: [typeId] });
    } else {
      setEmergencyData({ ...emergencyData, documentTypes: [] });
    }
  };

  const handleDocumentTypeRadio = (typeId: string) => {
    setEmergencyData({ ...emergencyData, documentTypes: [typeId] });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setEmergencyData({ ...emergencyData, uploadedFiles: [...emergencyData.uploadedFiles, ...files] });
  };

  const removeFile = (index: number) => {
    setEmergencyData({
      ...emergencyData,
      uploadedFiles: emergencyData.uploadedFiles.filter((_, i) => i !== index)
    });
  };

  const handleViewFile = (file: File) => {
    // Open the file in the FileViewer modal instead of a new tab
    setViewingFile(file);
    setShowFileViewer(true);
  };

  const formatRecipientName = async (recipientId: string) => {
    return getRecipientName(recipientId);
  };

  const handleEmergencySubmit = async () => {
    if (!emergencyData.title || !emergencyData.description || selectedRecipients.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select recipients",
        variant: "destructive"
      });
      return;
    }

    // Guard: user must be authenticated with a real UUID
    if (!user?.id || user.id === 'unknown') {
      toast({
        title: "Authentication Required",
        description: "You must be signed in to submit an emergency document. Please refresh and log in again.",
        variant: "destructive"
      });
      return;
    }

    // Set submitting state briefly for visual feedback
    setIsSubmitting(true);

    // Capture current values needed for background processing to avoid race conditions with form reset
    const submissionData = {
      title: emergencyData.title,
      description: emergencyData.description,
      reason: emergencyData.reason,
      urgencyLevel: emergencyData.urgencyLevel,
      documentTypes: [...emergencyData.documentTypes],
      uploadedFiles: [...emergencyData.uploadedFiles],
      autoEscalation: emergencyData.autoEscalation,
      escalationTimeout: emergencyData.escalationTimeout,
      escalationTimeUnit: emergencyData.escalationTimeUnit,
      cyclicEscalation: emergencyData.cyclicEscalation,
      bypassMode: routingType === 'parallel',
      selectedRecipients: [...selectedRecipients],
      documentAssignments: { ...documentAssignments },
      useSmartDelivery: routingType === 'parallel',
      currentUserId: user?.id,
      currentUserName: user?.name,
      currentUserDepartment: user?.department,
      currentUserDesignation: userRole
    };

    console.log('🚨 [Emergency Management] Initiating fast-track submission...');

    // Optimistically transition the UI immediately for "instant" feel
    // This allows the Track Card (if it exists in historical list) to appear as soon as DB confirms
    setTimeout(() => {
      resetEmergencyForm();
      setIsSubmitting(false);
      toast({
        title: "🚨 EMERGENCY SUBMITTED",
        description: `Your emergency document is being sent to ${submissionData.selectedRecipients.length} recipients.`,
        duration: 4000,
      });
    }, 100);

    // Primary background submission logic
    try {
      // 1. Parallel prep: Resolve recipient names; pre-upload files to Supabase Storage
      const [recipientNames, uploadedFilesMetadata] = await Promise.all([
        Promise.all(submissionData.selectedRecipients.map(id => getRecipientName(id))),
        (async () => {
          if (submissionData.uploadedFiles.length === 0) return [];
          try {
            // Generate a temporary ID for the storage path prefix
            const tempDocId = `emergency-${Date.now()}`;
            const results = await supabaseStorageService.uploadFiles(
              submissionData.uploadedFiles,
              tempDocId
            );
            console.log(`[Emergency] ✅ Pre-uploaded ${results.length} file(s) to Supabase Storage.`);
            return results;
          } catch (uploadErr) {
            console.warn('[Emergency] ⚠️ File pre-upload failed, submitting without files:', uploadErr);
            return [];
          }
        })()
      ]);

      // Build lean file descriptor for the emergency_documents table
      const filesForEmergencyTable = uploadedFilesMetadata.map(f => ({
        name: f.file_name,
        file_name: f.file_name,
        type: f.file_type,
        file_type: f.file_type,
        size: f.file_size,
        file_size: f.file_size,
        storage_path: f.storage_path,
        storage_url: f.storage_url,
      }));

      const emergencyDoc = {
        title: submissionData.title,
        description: submissionData.description,
        reason: submissionData.reason,
        urgency_level: submissionData.urgencyLevel,
        submitter_id: submissionData.currentUserId || 'unknown',
        submitter_name: submissionData.currentUserName || submissionData.currentUserDesignation,
        submitter_role: submissionData.currentUserDesignation,
        status: 'submitted' as const,
        document_types: submissionData.documentTypes,
        files: filesForEmergencyTable,
        recipients: submissionData.selectedRecipients,
        recipient_names: recipientNames as string[],
        auto_escalation: submissionData.autoEscalation,
        escalation_timeout: submissionData.escalationTimeout,
        escalation_time_unit: submissionData.escalationTimeUnit,
        cyclic_escalation: submissionData.cyclicEscalation,
        bypass_mode: submissionData.bypassMode,
        use_smart_delivery: submissionData.useSmartDelivery,
        escalation_level: 0,
        current_recipient_index: 0,
        escalation_stopped: false,
        assignments: submissionData.documentAssignments
      };

      // 2. Submit to Emergency Service (Supabase)
      if (emergencyService) {
        const result = await emergencyService.createDocument(emergencyDoc);
        if (result.success) {
          const createdDoc = result.data;
          console.log('✅ Emergency document created in Supabase:', String(createdDoc.id).replace(/[\r\n]/g, ''));
          
          // Dispatch event for UI updates
          window.dispatchEvent(new CustomEvent('emergency-document-created', {
            detail: { document: createdDoc }
          }));

          // 3. Independent Background Tasks (Unified Workflow, Notifications)
          // These run without blocking or being awaited by the main submission result
          (async () => {
            try {
              const unifiedDoc = await documentService.createDocument({
                title: createdDoc.title,
                description: createdDoc.description || createdDoc.reason || '',
                type: 'Emergency',
                priority: createdDoc.urgency_level || 'urgent',
                submitter_id: submissionData.currentUserId || 'unknown',
                submitter_name: submissionData.currentUserName || submissionData.currentUserDesignation,
                submitter_department: submissionData.currentUserDepartment || '',
                submitter_designation: submissionData.currentUserDesignation,
                is_emergency: true,
                files: [],
                filesMetadata: uploadedFilesMetadata,
                recipients: recipientNames as string[],
                recipient_ids: submissionData.selectedRecipients,
                source: 'emergency-management',
              });

              if (unifiedDoc) {
                const recipientsForWorkflow = submissionData.selectedRecipients.map((id, i) => ({
                  id,
                  name: (recipientNames as string[])[i] || 'Unknown',
                }));

                await workflowService.createWorkflow({
                  documentId: unifiedDoc.id,
                  recipients: recipientsForWorkflow,
                  isParallel: submissionData.useSmartDelivery,
                  routingType: submissionData.useSmartDelivery ? 'parallel' : 'sequential',
                  source: 'emergency-management',
                  hasBypass: submissionData.bypassMode,
                });
                
                if (submissionData.autoEscalation && !submissionData.useSmartDelivery) {
                  const timeoutMs = EscalationService.timeUnitToMs(
                    submissionData.escalationTimeout,
                    submissionData.escalationTimeUnit
                  );
                  escalationService.initializeEscalation({
                    documentId: unifiedDoc.id,
                    documentTitle: submissionData.title,
                    mode: 'sequential',
                    timeout: timeoutMs,
                    recipients: submissionData.selectedRecipients,
                    submittedBy: submissionData.currentUserId || 'unknown',
                    cyclicEscalation: submissionData.cyclicEscalation,
                  });
                }
              }
            } catch (unifiedError) {
              console.error('❌ Background secondary tasks failed:', unifiedError);
            }
          })();

        } else {
          console.error('❌ Supabase failed:', result.error);
        }
      }
      
      console.log('✅ Background submission tasks complete');
    } catch (error: any) {
      console.error('❌ Background emergency submission error:', error);
      toast({
        title: "Async Submission Issue",
        description: "An error occurred in the background processing. The document may still have been submitted.",
        variant: "destructive"
      });
    }
  };

  const resetEmergencyForm = () => {
    setEmergencyData({
      title: '',
      description: '',
      reason: '',
      urgencyLevel: 'medium',
      documentTypes: [],
      uploadedFiles: [],
      attachments: [],
      autoEscalation: false,
      escalationTimeout: 24,
      escalationTimeUnit: 'hours' as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
      cyclicEscalation: true,
      bypassMode: false
    });
    setSelectedRecipients([]);
    setRoutingType('sequential');
    setIsEmergencyMode(false);
    setUseProfileDefaults(true);
    setOverrideNotifications(false);
  };



  // Handle document rejection - stops escalation
  const handleDocumentRejection = async (documentId: string, rejectedBy: string) => {
    try {
      // Update in Supabase if available
      if (emergencyService) {
        await emergencyService.updateDocument(documentId, {
          status: 'rejected',
          rejected_by: rejectedBy,
          escalation_stopped: true
        });
      }

      toast({
        title: "Document Rejected",
        description: "Escalation has been stopped due to rejection.",
        variant: "destructive"
      });
    } catch (error) {
      console.error('Error handling document rejection:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {!displayEmergencyMode && (
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Emergency Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Priority Document Submission and Emergency Response</p>
        </div>
      )}
      {/* Emergency Header */}
      <Card className={`shadow-elegant ${displayEmergencyMode ? 'border-destructive bg-red-50' : ''}`}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Siren className={`w-6 h-6 ${displayEmergencyMode ? 'text-destructive animate-pulse' : 'text-primary'}`} />
              Emergency Management
            </CardTitle>

            <Button
              onClick={() => setIsEmergencyMode(!isEmergencyMode)}
              variant={displayEmergencyMode ? "destructive" : "outline"}
              size="lg"
              className={`w-full sm:w-auto font-bold ${displayEmergencyMode ? 'animate-pulse shadow-glow' : ''}`}
            >
              {displayEmergencyMode ? (
                <>
                  <XCircle className="w-5 h-5 mr-2" />
                  Cancel Emergency
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  ACTIVATE EMERGENCY
                </>
              )}
            </Button>
          </div>

          {displayEmergencyMode && (
            <div className="bg-red-100 border border-red-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <Siren className="w-5 h-5" />
                EMERGENCY MODE ACTIVE
              </div>

            </div>
          )}
        </CardHeader>
      </Card>

      {/* Emergency Statistics */}
      {!displayEmergencyMode && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-elegant border-l-4 border-l-destructive">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Active Emergencies</p>
                  <p className="text-lg sm:text-2xl font-bold text-destructive">
                    {statistics.active}
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                  <Siren className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-l-4 border-l-warning">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Avg Response Time</p>
                  <p className="text-lg sm:text-2xl font-bold text-warning">
                    {statistics.avgResponseTime}m
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-l-4 border-l-success">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Resolved This Month</p>
                  <p className="text-lg sm:text-2xl font-bold text-success">
                    {statistics.resolvedMonth || 0}
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant border-l-4 border-l-primary">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Response Rate</p>
                  <p className="text-lg sm:text-2xl font-bold text-primary">
                    {statistics.responseRate}%
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}



      {/* Emergency Submission Form */}
      {displayEmergencyMode && (
        <Card className="shadow-elegant border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-red-600" />
              Document Submission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Document Management Integration */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency-title" className="text-base font-medium">Emergency Title</Label>
                  <Input
                    id="emergency-title"
                    value={emergencyData.title}
                    onChange={(e) => setEmergencyData({ ...emergencyData, title: e.target.value })}
                    placeholder="Brief emergency title"
                    className="border-red-500 focus-visible:ring-red-500 focus:border-red-500 text-base sm:text-sm"
                  />
                </div>

                <div className={cn("space-y-2", (isSequentialRoutingStep || isParallelRoutingStep) && "ring-4 ring-primary ring-offset-4 rounded-lg z-50 p-2")}>
                  <Label htmlFor="routing-type" className="text-base font-medium">Routing Type</Label>
                  <Select
                    value={isSequentialRoutingStep ? 'sequential' : isParallelRoutingStep ? 'parallel' : routingType}
                    onValueChange={(value: any) => setRoutingType(value)}
                  >
                    <SelectTrigger className="border-red-500 focus:border-red-500 focus:ring-red-500 text-base sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Sequential Routing
                        </div>
                      </SelectItem>
                      <SelectItem value="parallel">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-destructive" />
                          Parallel Routing
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>


              {/* Document Type Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Document Type</Label>
                {/* Mobile: Radio circles */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {documentTypeOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <div
                        key={option.id}
                        className="flex items-center space-x-2 p-3 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        onClick={() => handleDocumentTypeRadio(option.id)}
                      >
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-red-600">
                          {emergencyData.documentTypes.includes(option.id) && (
                            <div className="w-3 h-3 rounded-full bg-red-600" />
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-base text-red-800 font-medium">
                          <IconComponent className="w-4 h-4 text-red-600" />
                          {option.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: Checkboxes */}
                <div className="hidden sm:grid sm:grid-cols-3 gap-3">
                  {documentTypeOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <div key={option.id} className="flex items-center space-x-2 p-3 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                        <Checkbox
                          id={option.id}
                          checked={emergencyData.documentTypes.includes(option.id)}
                          onCheckedChange={(checked) => handleDocumentTypeChange(option.id, !!checked)}
                          className="data-[state=checked]:bg-red-600 border-red-600 rounded-full"
                        />
                        <Label htmlFor={option.id} className="flex items-center gap-2 cursor-pointer text-sm text-red-800 font-medium">
                          <IconComponent className="w-4 h-4 text-red-600" />
                          {option.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Upload Documents</Label>
                <div className="border-2 border-dashed border-red-300 bg-white rounded-lg p-6">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="emergency-file-upload"
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="emergency-file-upload" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-base sm:text-sm text-red-700 mb-1 font-medium">
                        Drag and drop emergency files or click to upload
                      </p>
                      <p className="text-xs text-red-600">
                        Supports: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, (Max: 10MB Each File)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Uploaded Files Display */}
                {emergencyData.uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Uploaded Files ({displayFiles.length})</Label>
                    <div className="space-y-2">
                      {displayFiles.map((file, index) => (
                        <div key={index} className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-2 bg-accent rounded-md gap-2 sm:gap-0">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full pr-8 sm:pr-0">
                            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate max-w-[150px] sm:max-w-xs">{file.name}</span>
                              <Badge variant="outline" className="text-xs shrink-0">
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

                              {/* Customize Assignment Badge */}
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
                                    animation: `border-spin ${borderAnimationDuration} linear infinite`
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            className="absolute top-2 right-2 sm:static h-6 w-6 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-Escalation Feature */}
            {routingType === 'sequential' && (
              <>
                <div className={`grid gap-4 md:grid-cols-2 ${isAutoForwardStep ? 'ring-4 ring-primary ring-offset-4 rounded-lg z-50 p-2' : ''}`}>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={emergencyData.autoEscalation || isAutoForwardStep}
                      onCheckedChange={(checked) => setEmergencyData({ ...emergencyData, autoEscalation: checked })}
                    />
                    <label className="text-sm font-medium">Auto-Forward</label>
                  </div>
                </div>

                {(emergencyData.autoEscalation || isAutoForwardStep) && (
                  <div className="relative rounded-xl p-[2px] overflow-hidden group">
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
                        animation: `border-spin ${borderAnimationDuration} linear infinite`
                      }}
                    />
                    <div className="relative bg-card rounded-[10px] p-4 h-full w-full">
                      <div className="grid grid-cols-[3fr_2fr] gap-3 sm:grid-cols-2 sm:gap-4">
                        <div>
                          <label className="text-sm font-medium">Auto-Forward Timeout</label>
                          <Input
                            type="number"
                            value={emergencyData.escalationTimeout || 24}
                            onChange={(e) => setEmergencyData({ ...emergencyData, escalationTimeout: Number(e.target.value) })}
                            min={1}
                            className="mt-1 text-base sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Time Unit</label>
                          <Select
                            value={emergencyData.escalationTimeUnit}
                            onValueChange={(value: any) => setEmergencyData({ ...emergencyData, escalationTimeUnit: value })}
                          >
                            <SelectTrigger className="mt-1 text-base sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="seconds">Seconds</SelectItem>
                              <SelectItem value="minutes">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="weeks">Weeks</SelectItem>
                              <SelectItem value="months">Months</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Notification Alert Options */}
            <div className="space-y-4 p-4 border-2 border-red-200 rounded-lg bg-red-50">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-destructive" />
                Emergency Notification Behavior Settings.
              </h3>

              {/* Notification Behavior Options */}
              <div className="space-y-3">

                {/* Use Profile Defaults */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Settings className="w-7 h-7 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-medium">Receive Notifications Based on Selected Recipients' Profile Settings</p>
                      <p className="text-sm text-muted-foreground">Each selected recipient receives one-time notifications through all available channels (Email, Push) - no recurring notifications</p>
                    </div>
                  </div>
                  <Switch
                    checked={useProfileDefaults}
                    onCheckedChange={(checked) => {
                      setUseProfileDefaults(checked);
                      setOverrideNotifications(!checked);
                    }}
                  />
                </div>

                {/* Override for Emergency */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-7 h-7 sm:w-5 sm:h-5 text-destructive shrink-0" />
                    <div>
                      <p className="font-medium">Override for Emergency (Takes Priority)</p>
                      <p className="text-sm text-muted-foreground">Manually define emergency-specific notification channels and custom scheduling for alerts</p>
                    </div>
                  </div>
                  <Switch
                    checked={overrideNotifications}
                    onCheckedChange={(checked) => {
                      setOverrideNotifications(checked);
                      setUseProfileDefaults(!checked);
                    }}
                  />
                </div>
              </div>

              {/* Custom Notification Settings */}
              {overrideNotifications && !useProfileDefaults && (
                <div className="space-y-4 p-4 bg-white rounded-lg border">
                  {/* ⏱️ Scheduling Options */}
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-base font-semibold flex items-center gap-2"><AlarmClock className="w-5 h-5" /> Scheduling Options</h4>
                    <p className="text-sm text-muted-foreground">Support customizable scheduling intervals for emergency notifications</p>
                  </div>

                  {/* Notification Strategy */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-base font-medium">Override Configuration</Label>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors gap-3 sm:gap-0">
                        <div className="flex items-center space-x-3 w-full">
                          <input
                            type="radio"
                            id="logic-recipient"
                            name="notification-logic"
                            checked={notificationSettings.notificationLogic === 'recipient-based'}
                            onChange={() => setNotificationSettings({ ...notificationSettings, notificationLogic: 'recipient-based' })}
                            className="w-4 h-4"
                          />
                          <Label htmlFor="logic-recipient" className="cursor-pointer flex-1">
                            <span className="font-medium">Recipient-Based (Recommended)</span>
                            <p className="text-xs text-muted-foreground mt-1">Send notifications based on individual recipient roles and responsibilities</p>
                          </Label>
                        </div>
                        {notificationSettings.notificationLogic === 'recipient-based' && selectedRecipients.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustomizeModal(true)}
                            className="w-full sm:w-auto"
                          >
                            <Users className="w-4 h-4 mr-2" />
                            Customize Recipients
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id="logic-document"
                            name="notification-logic"
                            checked={notificationSettings.notificationLogic === 'document-based'}
                            onChange={() => setNotificationSettings({ ...notificationSettings, notificationLogic: 'document-based' })}
                            className="w-4 h-4"
                          />
                          <Label htmlFor="logic-document" className="cursor-pointer flex-1">
                            <span className="font-medium">Document-Based</span>
                            <p className="text-xs text-muted-foreground mt-1">Send the same type of notification uniformly to all recipients</p>
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alert Channels - Show when Document-Based is selected */}
                  {notificationSettings.notificationLogic === 'document-based' && (
                    <>
                      {/* Alert Channels Title */}
                      <div className="pt-4 border-t">
                        <h4 className="text-base font-semibold mb-4">Alert Channels</h4>
                      </div>
                      {/* Email Notifications */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Email Notifications</p>
                              <p className="text-sm text-muted-foreground">Receive updates via email</p>
                            </div>
                          </div>
                          <Switch
                            checked={notificationSettings.emailNotifications}
                            onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                          />
                        </div>
                        {notificationSettings.emailNotifications && (
                          <div className="grid grid-cols-2 gap-3 ml-8">
                            <select
                              value={`${notificationSettings.emailInterval}-${notificationSettings.emailUnit}`}
                              onChange={(e) => {
                                const [interval, unit] = e.target.value.split('-');
                                setNotificationSettings({ ...notificationSettings, emailInterval: interval, emailUnit: unit as any });
                              }}
                              className="h-10 px-3 py-2 border rounded-md"
                            >
                              <option value="1-minutes">Every 1 minute</option>
                              <option value="15-minutes">Every 15 minutes</option>
                              <option value="1-hours">Hourly</option>
                              <option value="1-days">Daily</option>
                              <option value="1-weeks">Weekly</option>
                            </select>
                            <Input
                              type="number"
                              value={notificationSettings.emailInterval}
                              onChange={(e) => setNotificationSettings({ ...notificationSettings, emailInterval: e.target.value })}
                              min={1}
                              placeholder="Custom (X)"
                              className="mt-1 text-base sm:text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {/* Push Notifications */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-t pt-4">
                          <div className="flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Push Notifications</p>
                              <p className="text-sm text-muted-foreground">Browser and mobile notifications</p>
                            </div>
                          </div>
                          <Switch
                            checked={notificationSettings.pushNotifications}
                            onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, pushNotifications: checked })}
                          />
                        </div>
                        {notificationSettings.pushNotifications && (
                          <div className="grid grid-cols-2 gap-3 ml-8">
                            <select
                              value={`${notificationSettings.pushInterval}-${notificationSettings.pushUnit}`}
                              onChange={(e) => {
                                const [interval, unit] = e.target.value.split('-');
                                setNotificationSettings({ ...notificationSettings, pushInterval: interval, pushUnit: unit as any });
                              }}
                              className="h-10 px-3 py-2 border rounded-md"
                            >
                              <option value="1-minutes">Every 1 minute</option>
                              <option value="5-minutes">Every 5 minutes</option>
                              <option value="15-minutes">Every 15 minutes</option>
                              <option value="1-hours">Hourly</option>
                            </select>
                            <Input
                              type="number"
                              value={notificationSettings.pushInterval}
                              onChange={(e) => setNotificationSettings({ ...notificationSettings, pushInterval: e.target.value })}
                              min={1}
                              placeholder="Custom (X)"
                              className="mt-1 text-base sm:text-sm"
                            />
                          </div>
                        )}
                      </div>


                    </>
                  )}

                </div>
              )}

              {/* Behavior Summary */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-base font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Behavior Summary
                </h4>
                {useProfileDefaults && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded flex items-center gap-3">
                    <CheckCircle2 className="w-7 h-7 sm:w-4 sm:h-4 shrink-0" />
                    <div>
                      <p className="font-medium">One-Time Notification Mode Active</p>
                      <p className="text-xs">Recipients will receive notifications only once through all available channels (Email, Push)</p>
                    </div>
                  </div>
                )}
                {overrideNotifications && (
                  <div className="text-sm text-destructive bg-red-50 p-3 rounded flex items-center gap-3 border border-red-100">
                    <AlertTriangle className="w-7 h-7 sm:w-4 sm:h-4 shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Emergency Override Active</p>
                      <p className="text-xs">Default preferences are bypassed. Emergency alerts will follow manually configured settings, ensuring critical updates reach recipients immediately through selected channels.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>





            {/* Expanded Recipient Selection */}
            <div className="space-y-4">
              <Label>Emergency Management Recipients</Label>
              <RecipientSelector
                userRole={userRole}
                selectedRecipients={selectedRecipients}
                onRecipientsChange={setSelectedRecipients}
                isEmergency={true}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority-level" className="text-base font-medium">Priority Level</Label>
              <Select
                value={emergencyData.urgencyLevel}
                onValueChange={(value: any) => setEmergencyData({ ...emergencyData, urgencyLevel: value })}
              >
                <SelectTrigger className="border-red-500 focus:border-red-500 focus:ring-red-500 text-base sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <Siren className="w-4 h-4 text-red-600" />
                      Critical Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      High Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      Urgent Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      Medium Priority
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency-description">Emergency Description / Comments</Label>
              <Textarea
                id="emergency-description"
                value={emergencyData.description}
                onChange={(e) => setEmergencyData({ ...emergencyData, description: e.target.value })}
                placeholder="Detailed description of the emergency situation"
                rows={4}
                className="border-red-500 focus-visible:ring-red-500 focus:border-red-500 text-base sm:text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEmergencyMode(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEmergencySubmit}
                variant="destructive"
                disabled={isSubmitting}
                className={cn(
                  "font-bold w-full sm:w-auto",
                  !isSubmitting && "animate-pulse"
                )}
              >
                {isSubmitting ? (
                  <ClockLoading size="sm" showText={true} message="SUBMITTING..." className="text-white" />
                ) : (
                  <>
                    <ChevronsRight className="w-4 h-4 mr-2" />
                    SUBMIT EMERGENCY
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customize Recipients Modal */}
      <Dialog open={showCustomizeModal} onOpenChange={setShowCustomizeModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-lg p-0">
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Customize Notifications per Recipient
              </DialogTitle>
              <DialogDescription>
                Configure individual notification preferences for each recipient
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <div className="space-y-3">
                {selectedRecipients.map((recipientId) => {
                  const recipientSettings = recipientNotifications[recipientId] || notificationSettings;
                  const isOpen = openRecipients[recipientId] || false;
                  return (
                    <Card key={recipientId} className="overflow-hidden">
                      <div className="p-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors flex items-center justify-between" onClick={() => setOpenRecipients({ ...openRecipients, [recipientId]: !isOpen })}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <h4 className="font-semibold text-sm uppercase">{allRecipientNames[recipientId] || recipientId.replace('-', ' ')}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {[recipientSettings.emailNotifications && 'Email', recipientSettings.smsAlerts && 'SMS', recipientSettings.pushNotifications && 'Push'].filter(Boolean).join(', ') || 'None'}
                          </Badge>
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      {isOpen && (
                        <div className="p-4 border-t space-y-3">
                          <div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Email</span></div><Switch checked={recipientSettings.emailNotifications} onCheckedChange={(checked) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, emailNotifications: checked } })} /></div>{recipientSettings.emailNotifications && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-0 sm:ml-6"><Input type="number" value={recipientSettings.emailInterval} onChange={(e) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, emailInterval: e.target.value } })} min={1} className="h-8 text-base sm:text-sm" /><Select value={recipientSettings.emailUnit} onValueChange={(value: any) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, emailUnit: value } })}><SelectTrigger className="h-8 text-base sm:text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="seconds">Seconds</SelectItem><SelectItem value="minutes">Minutes</SelectItem><SelectItem value="hours">Hours</SelectItem><SelectItem value="days">Days</SelectItem><SelectItem value="weeks">Weeks</SelectItem><SelectItem value="months">Months</SelectItem></SelectContent></Select></div>)}</div>
                          <div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">SMS</span></div><Switch checked={recipientSettings.smsAlerts} onCheckedChange={(checked) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, smsAlerts: checked } })} /></div>{recipientSettings.smsAlerts && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-0 sm:ml-6"><Input type="number" value={recipientSettings.smsInterval} onChange={(e) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, smsInterval: e.target.value } })} min={1} className="h-8 text-base sm:text-sm" /><Select value={recipientSettings.smsUnit} onValueChange={(value: any) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, smsUnit: value } })}><SelectTrigger className="h-8 text-base sm:text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="seconds">Seconds</SelectItem><SelectItem value="minutes">Minutes</SelectItem><SelectItem value="hours">Hours</SelectItem><SelectItem value="days">Days</SelectItem><SelectItem value="weeks">Weeks</SelectItem><SelectItem value="months">Months</SelectItem></SelectContent></Select></div>)}</div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Push</span>
                              </div>
                              <Switch 
                                checked={recipientSettings.pushNotifications} 
                                onCheckedChange={(checked) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, pushNotifications: checked } })} 
                              />
                            </div>
                            {recipientSettings.pushNotifications && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-0 sm:ml-6">
                                <Input 
                                  type="number" 
                                  value={recipientSettings.pushInterval} 
                                  onChange={(e) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, pushInterval: e.target.value } })} 
                                  min={1} 
                                  className="h-8 text-base sm:text-sm" 
                                />
                                <Select 
                                  value={recipientSettings.pushUnit} 
                                  onValueChange={(value: any) => setRecipientNotifications({ ...recipientNotifications, [recipientId]: { ...recipientSettings, pushUnit: value } })}
                                >
                                  <SelectTrigger className="h-8 text-base sm:text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="seconds">Seconds</SelectItem>
                                    <SelectItem value="minutes">Minutes</SelectItem>
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="days">Days</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 border-t bg-muted/20 flex flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCustomizeModal(false)}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowCustomizeModal(false);
                toast({
                  title: "Settings Saved",
                  description: "Recipient notification preferences saved successfully."
                });
              }}
              className="flex-1 sm:flex-none"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {(assigningFile ? [assigningFile] : emergencyData.uploadedFiles).map((file, fileIndex) => (
              <Card key={fileIndex}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <File className="w-4 h-4" />
                    {file.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedRecipients.map((recipientId) => (
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
                            id={`${file.name}-${recipientId}`}
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

                        <Label
                          htmlFor={!isMobile ? `${file.name}-${recipientId}` : undefined}
                          className={cn(
                            "text-sm cursor-pointer flex-1",
                            isMobile && "ml-2"
                          )}
                        >
                          {allDisplayRecipientNames[recipientId] || recipientId.replace(/[-]/g, ' ').replace(/[<>&"']/g, '').toUpperCase()}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="flex flex-row justify-end gap-3 pt-6 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setShowAssignmentModal(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowAssignmentModal(false);
                toast({
                  title: "Assignment Saved",
                  description: "Document assignments have been saved successfully.",
                  variant: "default"
                });
              }}
              className="w-full sm:w-auto"
            >
              Save
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emergency Contacts - Only show when not in emergency mode */}
      {!displayEmergencyMode && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Emergency Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emergencyContacts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Users className="w-5 h-5 mr-2" />
                <span>No emergency contacts available</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${contact.available ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                      <div>
                        <h4 className="font-medium text-sm">{contact.name}</h4>
                        <p className="text-xs text-muted-foreground">{contact.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{contact.phone}</p>
                      <Badge
                        variant={contact.available ? "success" : "secondary"}
                        className="text-xs"
                      >
                        {contact.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Viewer Modal */}
      <FileViewer
        file={viewingFile}
        open={showFileViewer}
        onOpenChange={setShowFileViewer}
      />
    </div>
  );
};