import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RecipientSelector } from '@/components/approval/RecipientSelector';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Share,
  Users,
  FileText,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building,
  Zap,
  Settings,
  Eye,
  Download
} from 'lucide-react';

interface MassDistributionProps {
  userRole: string;
  className?: string;
}

interface DistributionJob {
  id: string;
  title: string;
  documentIds: string[];
  recipients: string[];
  status: 'preparing' | 'sending' | 'completed' | 'failed';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  successCount: number;
  failureCount: number;
  errors: string[];
}

export const MassDistribution: React.FC<MassDistributionProps> = ({ userRole, className }) => {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [distributionTitle, setDistributionTitle] = useState('');
  const [distributionMessage, setDistributionMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'emergency'>('normal');
  const [scheduleDelivery, setScheduleDelivery] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [distributionJobs, setDistributionJobs] = useState<DistributionJob[]>([]);
  const [isDistributing, setIsDistributing] = useState(false);

  const { toast } = useToast();

  const availableDocuments = [
    { id: 'DOC-2024-001', title: 'Faculty Recruitment Authorization', type: 'Letter', size: '2.3 MB' },
    { id: 'DOC-2024-002', title: 'Semester Fee Structure', type: 'Circular', size: '1.8 MB' },
    { id: 'DOC-2024-003', title: 'Academic Performance Report', type: 'Report', size: '4.1 MB' },
    { id: 'DOC-2024-004', title: 'Infrastructure Upgrade Plan', type: 'Report', size: '3.2 MB' },
    { id: 'DOC-2024-005', title: 'Emergency Protocol Update', type: 'Circular', size: '1.5 MB' }
  ];

  const distributionTemplates = [
    {
      name: 'All Department Heads',
      description: 'Send to all HODs across all branches',
      recipients: ['hod-cse', 'hod-eee', 'hod-ece', 'hod-mech', 'hod-csm', 'hod-cso', 'hod-csd', 'hod-csc']
    },
    {
      name: 'All Program Heads',
      description: 'Send to all Program Heads across all branches and years',
      recipients: ['program-head-cse-1', 'program-head-cse-2', 'program-head-eee-1', 'program-head-eee-2']
    },
    {
      name: 'Senior Administration',
      description: 'Principal, Registrar, and key administrative roles',
      recipients: ['principal', 'registrar', 'dean', 'controller']
    },
    {
      name: 'Emergency Response Team',
      description: 'Critical personnel for emergency situations',
      recipients: ['principal', 'registrar', 'security-head', 'medical-officer', 'maintenance-head']
    }
  ];

  const handleMassDistribution = async () => {
    if (selectedDocuments.length === 0 || selectedRecipients.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select documents and recipients",
        variant: "destructive"
      });
      return;
    }

    setIsDistributing(true);

    const newJob: DistributionJob = {
      id: Date.now().toString(),
      title: distributionTitle || `Mass Distribution - ${new Date().toLocaleDateString()}`,
      documentIds: selectedDocuments,
      recipients: selectedRecipients,
      status: 'preparing',
      progress: 0,
      startedAt: new Date(),
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    setDistributionJobs(prev => [newJob, ...prev]);

    // Simulate distribution process
    const totalSteps = selectedRecipients.length;
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      const progress = (currentStep / totalSteps) * 100;
      
      setDistributionJobs(prev => prev.map(job => 
        job.id === newJob.id 
          ? { 
              ...job, 
              progress,
              status: progress === 100 ? 'completed' : 'sending',
              successCount: currentStep,
              completedAt: progress === 100 ? new Date() : undefined
            }
          : job
      ));

      if (currentStep < totalSteps) {
        setTimeout(updateProgress, 500);
      } else {
        setIsDistributing(false);
        toast({
          title: "Distribution Complete",
          description: `Successfully distributed to ${selectedRecipients.length} recipients`,
        });
        
        // Reset form
        setSelectedDocuments([]);
        setSelectedRecipients([]);
        setDistributionTitle('');
        setDistributionMessage('');
      }
    };

    setTimeout(updateProgress, 1000);
  };

  const applyTemplate = (template: any) => {
    setSelectedRecipients(template.recipients);
    toast({
      title: "Template Applied",
      description: `Selected ${template.recipients.length} recipients from ${template.name}`,
    });
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'sending': return 'text-warning';
      case 'preparing': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Mass Distribution Form */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share className="w-5 h-5 text-primary" />
            Mass Document Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Distribution Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Distribution Title</label>
            <Input
              placeholder="e.g., Monthly Circular Distribution"
              value={distributionTitle}
              onChange={(e) => setDistributionTitle(e.target.value)}
            />
          </div>

          {/* Document Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Documents</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent">
                  <Checkbox
                    checked={selectedDocuments.includes(doc.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedDocuments([...selectedDocuments, doc.id]);
                      } else {
                        setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{doc.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{doc.type}</Badge>
                      <span>{doc.size}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {selectedDocuments.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedDocuments.length} document(s) selected
              </p>
            )}
          </div>

          {/* Quick Templates */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Quick Recipient Templates</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {distributionTemplates.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  onClick={() => applyTemplate(template)}
                  className="h-auto p-3 text-left justify-start"
                >
                  <div>
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {template.recipients.length} recipients
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Recipient Selection */}
          <RecipientSelector
            userRole={userRole}
            selectedRecipients={selectedRecipients}
            onRecipientsChange={setSelectedRecipients}
          />

          {/* Distribution Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Distribution Message (Optional)</label>
            <Textarea
              placeholder="Add a message to accompany the documents..."
              value={distributionMessage}
              onChange={(e) => setDistributionMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Priority and Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule Delivery</label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={scheduleDelivery}
                  onCheckedChange={(checked) => setScheduleDelivery(checked === true)}
                />
                <span className="text-sm">Schedule for later</span>
              </div>
            </div>

            {scheduleDelivery && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Distribution Summary */}
          {(selectedDocuments.length > 0 || selectedRecipients.length > 0) && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-2">Distribution Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Documents</p>
                  <p className="font-medium">{selectedDocuments.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recipients</p>
                  <p className="font-medium">{selectedRecipients.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Priority</p>
                  <p className="font-medium capitalize">{priority}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Delivery</p>
                  <p className="font-medium">{scheduleDelivery ? 'Scheduled' : 'Immediate'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleMassDistribution}
              disabled={isDistributing || selectedDocuments.length === 0 || selectedRecipients.length === 0}
              variant="gradient"
              size="lg"
            >
              {isDistributing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Distributing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Start Distribution
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Distribution History */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Distribution History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {distributionJobs.map((job) => (
              <div key={job.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{job.title}</h4>
                  <Badge 
                    variant={
                      job.status === 'completed' ? 'success' :
                      job.status === 'failed' ? 'destructive' :
                      job.status === 'sending' ? 'warning' : 'default'
                    }
                  >
                    {job.status.toUpperCase()}
                  </Badge>
                </div>

                {job.status === 'sending' && (
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{job.progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Documents</p>
                    <p className="font-medium">{job.documentIds.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recipients</p>
                    <p className="font-medium">{job.recipients.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-medium text-success">
                      {job.recipients.length > 0 ? ((job.successCount / job.recipients.length) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-medium">{job.startedAt.toLocaleString()}</p>
                  </div>
                </div>

                {job.status === 'completed' && (
                  <div className="flex items-center gap-4 mt-3 p-2 bg-success/10 rounded">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-sm text-success font-medium">
                      Distribution completed successfully to {job.successCount} recipients
                    </span>
                  </div>
                )}

                {job.failureCount > 0 && (
                  <div className="flex items-center gap-4 mt-3 p-2 bg-destructive/10 rounded">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive font-medium">
                      {job.failureCount} delivery failures
                    </span>
                  </div>
                )}
              </div>
            ))}

            {distributionJobs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Share className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No distribution history</p>
                <p className="text-sm">Mass distributions will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};