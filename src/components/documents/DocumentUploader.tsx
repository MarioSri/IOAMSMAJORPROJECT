import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Upload,
  FileText,
  Image,
  File,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  ChevronsRight,
  Eye,
  Settings
} from "lucide-react";
import { RecipientSelector } from "@/components/approval/RecipientSelector";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { FileViewer } from "@/components/documents/FileViewer";
import { useTutorialContext } from "@/contexts/TutorialContext";
import { useRecipientNames } from "@/hooks/useRecipientNames";
import { formatFileSize } from "@/utils/fileSize";

interface DocumentSubmissionData {
  title: string;
  documentType: string[];
  files: File[];
  recipients: string[];
  description: string;
  priority: string;
  timestamp: string;
  assignments: Record<string, string[]>;
}

interface DocumentUploaderProps {
  userRole: string;
  onSubmit: (data: DocumentSubmissionData) => void;
  borderAnimationDuration?: string;
}

export function DocumentUploader({ userRole, onSubmit, borderAnimationDuration = "3s" }: DocumentUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");
  const [documentTitle, setDocumentTitle] = useState("");
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [documentAssignments, setDocumentAssignments] = useState<Record<string, string[]>>({});
  const [viewingFile, setViewingFile] = useState<File | null>(null);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [assigningFile, setAssigningFile] = useState<File | null>(null);
  
  // Resolve recipient names for display
  const recipientNames = useRecipientNames(selectedRecipients);

  let tutorialContext;
  try {
    tutorialContext = useTutorialContext();
  } catch (e) {
    tutorialContext = null;
  }

  const isAdvancedAssignmentStep = tutorialContext?.isActive && 
                                  tutorialContext?.isAdvanced && 
                                  tutorialContext?.steps[tutorialContext.currentStep]?.id === 'adv-doc-assignment';

  // For tutorial purposes, show mock files and recipients if needed
  const displayFiles = isAdvancedAssignmentStep && uploadedFiles.length === 0
    ? [new window.File([""], "Sample_Contract.pdf", { type: "application/pdf" }), new window.File([""], "Employee_Handbook.pdf", { type: "application/pdf" })]
    : uploadedFiles;

  const displayRecipients = isAdvancedAssignmentStep && selectedRecipients.length === 0
    ? ["legal-department", "hr-director"]
    : selectedRecipients;

  // Pre-resolve names for display recipients (including mock ones)
  const allRecipientNames = useRecipientNames(displayRecipients);


  const documentTypeOptions = [
    { id: "letter", label: "Letter", icon: FileText },
    { id: "circular", label: "Circular", icon: File },
    { id: "report", label: "Report", icon: FileText },
  ];

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

  const handleSubmit = () => {
    if (!documentTitle.trim() || documentTypes.length === 0 || uploadedFiles.length === 0 || selectedRecipients.length === 0) {
      // Provide specific feedback on what's missing
      const missing = [];
      if (!documentTitle.trim()) missing.push("Document Title");
      if (documentTypes.length === 0) missing.push("Document Type");
      if (uploadedFiles.length === 0) missing.push("Files to upload");
      if (selectedRecipients.length === 0) missing.push("Recipients");

      toast({
        title: "Missing Required Fields",
        description: `Please provide: ${missing.join(", ")}`,
        variant: "destructive"
      });
      return;
    }

    submitDocuments();
  };

  const submitDocuments = async () => {
    const data = {
      title: documentTitle,
      documentType: documentTypes, // Use array directly
      files: uploadedFiles,
      recipients: selectedRecipients,
      description,
      priority,
      timestamp: new Date().toISOString(),
      assignments: documentAssignments
    };


    setIsUploading(true);

    try {
      await onSubmit(data);

      toast({
        title: "Document Submitted Successfully",
        description: `Submitted ${uploadedFiles.length} file(s) to ${selectedRecipients.length} recipient(s)`,
        variant: "default"
      });

      // Reset form after successful submission
      resetForm();
    } catch (error) {
      console.error('Document submission failed:', error);
      toast({
        title: "Submission Failed",
        description: `Failed to submit document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setDocumentTitle("");
    setDocumentTypes([]);
    setUploadedFiles([]);
    setSelectedRecipients([]);
    setDescription("");
    setPriority("low");
    setDocumentAssignments({});
  };


  const handleAssignmentChange = (fileName: string, recipientId: string, assigned: boolean) => {
    setDocumentAssignments(prev => {
      const current = prev[fileName] || [];
      if (assigned) {
        return { ...prev, [fileName]: [...current, recipientId] };
      } else {
        return { ...prev, [fileName]: current.filter(id => id !== recipientId) };
      }
    });
  };

  const handleAssignmentSave = () => {
    setShowAssignmentModal(false);
    toast({
      title: "Assignment Saved",
      description: "Document assignments have been saved successfully.",
      variant: "default"
    });
  };

  const isSubmitDisabled = !documentTitle.trim() || documentTypes.length === 0 || uploadedFiles.length === 0 || selectedRecipients.length === 0;

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Document Submission
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Document Title & Priority Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="documentTitle" className="text-base font-medium">Document Title</Label>
              <Input
                id="documentTitle"
                type="text"
                placeholder="Enter document title..."
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="w-full text-base sm:text-sm"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Priority Level</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-base sm:text-sm">
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
                      <AlertCircle className="w-4 h-4 text-warning" />
                      High Priority
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      Urgent Priority
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
              {documentTypeOptions.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center space-x-2 p-3 border border-green-400 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => handleDocumentTypeRadio(option.id)}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-primary">
                    {documentTypes.includes(option.id) && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
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
            <div className="hidden sm:grid sm:grid-cols-3 gap-3">
              {documentTypeOptions.map((option) => (
                <div key={option.id} className="flex items-center space-x-2 p-3 border border-green-400 rounded-lg hover:bg-accent transition-colors">
                  <Checkbox
                    id={`doc-upload-${option.id}`}
                    checked={documentTypes.includes(option.id)}
                    onCheckedChange={(checked) => handleDocumentTypeChange(option.id, !!checked)}
                  />
                  <label htmlFor={`doc-upload-${option.id}`} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Upload Documents</Label>
            <div className="border-2 border-dashed border-green-500 rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                title="Upload document files"
              />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, (Max: 10MB Each File)
                  </p>
                </div>
              </Label>
            </div>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <style>
                  {`
                    @keyframes border-spin {
                      100% {
                        transform: rotate(360deg);
                      }
                    }
                  `}
                </style>
                <Label className="text-sm font-medium">Uploaded Files</Label>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-accent/50 rounded-md gap-3 border border-green-300">
                    <div className="flex flex-col xs:flex-row xs:items-center gap-2 min-w-0">
                      <div className="flex items-center gap-2 mr-2 min-w-0">
                        <File className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm truncate font-medium">{file.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {formatFileSize((file as any).file_size ?? file.size)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-primary/10 flex items-center gap-1 active:scale-95 transition-transform"
                          onClick={() => handleViewFile(file)}
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Badge>

                        {/* Integrated Customize Assignment Badge with Rainbow Animation */}
                        {selectedRecipients.length > 0 && (
                          <div className="relative rounded-full p-[1px] overflow-hidden group">
                            <div 
                              className="absolute inset-[-100%] opacity-90 pointer-events-none"
                              style={{
                                background: "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #5e5ce6, #ff2d55, #ff3b30)",
                                animation: `border-spin ${borderAnimationDuration} linear infinite`
                              }}
                            />
                            <Badge
                              variant="secondary"
                              className="relative bg-background hover:bg-accent text-[10px] sm:text-xs cursor-pointer flex items-center gap-1 active:scale-95 transition-all py-0 px-2 h-5 border-none"
                              onClick={() => {
                                setAssigningFile(file);
                                setShowAssignmentModal(true);
                              }}
                            >
                              <Settings className="w-3 h-3" />
                              Customize Assignment
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 self-end sm:self-auto hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Document Management Recipients */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Document Management Recipients</Label>
            <RecipientSelector
              userRole={userRole}
              selectedRecipients={selectedRecipients}
              onRecipientsChange={setSelectedRecipients}
            />
          </div>

          {/* Description */}
          <div className="space-y-3">
            <Label htmlFor="description" className="text-base font-medium">
              Document Description / Comments
            </Label>
            <Textarea
              id="description"
              placeholder="Provide additional context or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="text-base sm:text-sm"
            />
          </div>

          {/* Submit Button */}
          <div className="flex flex-col gap-2 pt-4">
            {/* Validation feedback */}
            {isSubmitDisabled && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p className="font-medium mb-1">Required To Submit:</p>
                <ul className="space-y-1">
                  {!documentTitle.trim() && <li>• Enter a Document Title</li>}
                  {documentTypes.length === 0 && <li>• Select at Least One Document Type</li>}
                  {uploadedFiles.length === 0 && <li>• Upload at Least One File</li>}
                  {selectedRecipients.length === 0 && <li>• Select at Least One Recipient</li>}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isUploading}
                onClick={() => {
                  setDocumentTitle("");
                  setDocumentTypes([]);
                  setUploadedFiles([]);
                  setSelectedRecipients([]);
                  setDescription("");
                  setPriority("low");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitDisabled || isUploading}
                variant={isSubmitDisabled ? "secondary" : "gradient"}
                size="lg"
                className="w-full sm:min-w-32 sm:w-auto"
              >
                {isUploading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    SUBMITTING...
                  </>
                ) : (
                  <>
                    <ChevronsRight className="w-4 h-4 mr-2" />
                    {isSubmitDisabled ? "Complete Form" : "Document Submission"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  {/* Mobile: Radio circles */}
                  <div className="grid grid-cols-1 gap-3 sm:hidden">
                    {displayRecipients.map((recipientId) => (
                      <div
                        key={recipientId}
                        className="flex items-center space-x-3 p-3 border rounded hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => {
                          const isChecked = documentAssignments[file.name]?.includes(recipientId) ?? true;
                          handleAssignmentChange(file.name, recipientId, !isChecked);
                        }}
                      >
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-primary shrink-0">
                          {(documentAssignments[file.name]?.includes(recipientId) ?? true) && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                        <Label className="text-sm cursor-pointer truncate">
                          {allRecipientNames[recipientId] || recipientId.replace('-', ' ').toUpperCase()}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: Checkboxes */}
                  <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {displayRecipients.map((recipientId) => (
                      <div key={recipientId} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent/50 transition-colors">
                        <Checkbox
                          id={`${file.name}-${recipientId}`}
                          checked={documentAssignments[file.name]?.includes(recipientId) ?? true}
                          onCheckedChange={(checked) => handleAssignmentChange(file.name, recipientId, !!checked)}
                        />
                        <Label htmlFor={`${file.name}-${recipientId}`} className="text-xs sm:text-sm cursor-pointer truncate">
                          {allRecipientNames[recipientId] || recipientId.replace('-', ' ').toUpperCase()}
                        </Label>
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
            <Button onClick={handleAssignmentSave}>
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
}