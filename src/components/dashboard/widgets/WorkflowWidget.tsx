import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  ArrowRight,
  Zap,
  Settings,
  Play,
  Pause
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  name: string;
  assignee: string;
  status: 'pending' | 'in-progress' | 'completed' | 'rejected';
  estimatedTime: number;
  actualTime?: number;
}

interface ActiveWorkflow {
  id: string;
  documentId: string;
  documentTitle: string;
  type: 'standard' | 'emergency' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  currentStep: number;
  totalSteps: number;
  progress: number;
  steps: WorkflowStep[];
  startedAt: Date;
  estimatedCompletion: Date;
  escalationLevel: number;
  autoEscalation: boolean;
}

interface WorkflowWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const WorkflowWidget: React.FC<WorkflowWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [workflows, setWorkflows] = useState<ActiveWorkflow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'escalated'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call to fetch active workflows
    const fetchWorkflows = async () => {
      setLoading(true);

      const workflows: ActiveWorkflow[] = [];

      const filteredWorkflows = workflows.filter(workflow => {
        if (userRole === 'employee') {
          return workflow.steps.some(step => step.assignee === user?.name);
        }
        if (userRole === 'hod') {
          return workflow.steps.some(step =>
            step.assignee.includes(`HOD-${user?.branch}`) ||
            step.assignee === user?.name
          );
        }
        if (userRole === 'program-head') {
          return workflow.steps.some(step =>
            step.assignee.includes('Program Head') ||
            step.assignee === user?.name
          );
        }
        return true; // Principal and Registrar see all
      });

      setTimeout(() => {
        setWorkflows(filteredWorkflows);
        setLoading(false);
      }, 800);
    };

    fetchWorkflows();
  }, [userRole, user]);

  const getFilteredWorkflows = () => {
    switch (filter) {
      case 'pending':
        return workflows.filter(wf => wf.steps.some(step => step.status === 'pending' || step.status === 'in-progress'));
      case 'escalated':
        return workflows.filter(wf => wf.escalationLevel > 0 || wf.type === 'escalated');
      default:
        return workflows;
    }
  };

  const getWorkflowTypeColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'text-destructive';
      case 'escalated': return 'text-warning';
      case 'standard': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-warning animate-pulse" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending': return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />;
    }
  };

  const filteredWorkflows = getFilteredWorkflows();
  const pendingCount = workflows.filter(wf => wf.steps.some(step => step.status === 'pending' || step.status === 'in-progress')).length;
  const escalatedCount = workflows.filter(wf => wf.escalationLevel > 0).length;

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Workflow Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "shadow-elegant hover:shadow-glow transition-all duration-300",
      isSelected && "border-primary",
      isCustomizing && "cursor-pointer"
    )} onClick={onSelect}>
      <CardHeader className={cn(isMobile && "pb-3")}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <GitBranch className="w-5 h-5 text-primary" />
            Active Workflows
            <div className="flex gap-1">
              {pendingCount > 0 && (
                <Badge variant="warning" className="animate-pulse">
                  {pendingCount} active
                </Badge>
              )}
              {escalatedCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {escalatedCount} escalated
                </Badge>
              )}
            </div>
          </CardTitle>

          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['all', 'pending', 'escalated'] as const).map(filterType => (
                <Button
                  key={filterType}
                  variant={filter === filterType ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(filterType)}
                  className={cn(isMobile && "text-xs px-2")}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/approvals")}
              className={cn(isMobile && "text-xs")}
            >
              <Settings className="w-4 h-4 mr-1" />
              Manage
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className={cn(isMobile ? "h-48" : "h-64")}>
          <div className="space-y-3">
            {filteredWorkflows.slice(0, isMobile ? 3 : 5).map((workflow, index) => (
              <div
                key={workflow.id}
                className={cn(
                  "p-4 border rounded-lg hover:bg-accent transition-all cursor-pointer animate-fade-in",
                  workflow.type === 'emergency' && "border-destructive bg-red-50",
                  workflow.escalationLevel > 0 && "border-l-4 border-l-warning"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate(`/approvals`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h5 className={cn(
                      "font-medium line-clamp-2",
                      isMobile ? "text-sm" : "text-base"
                    )}>
                      {workflow.documentTitle}
                    </h5>
                    <p className={cn(
                      "text-muted-foreground",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      {workflow.documentId} • {workflow.type.charAt(0).toUpperCase() + workflow.type.slice(1)} Workflow
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={workflow.type === 'emergency' ? 'destructive' :
                        workflow.type === 'escalated' ? 'warning' : 'default'}
                      className={cn(
                        "text-xs",
                        workflow.type === 'emergency' && "animate-pulse"
                      )}
                    >
                      {workflow.type.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{workflow.progress}%</span>
                  </div>
                  <Progress value={workflow.progress} className="h-2" />
                  <p className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    Step {workflow.currentStep} of {workflow.totalSteps}: {workflow.steps[workflow.currentStep - 1]?.name}
                  </p>
                </div>

                {/* Current Step Details */}
                <div className="flex items-center gap-2 mb-3">
                  {getStepStatusIcon(workflow.steps[workflow.currentStep - 1]?.status)}
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    {workflow.steps[workflow.currentStep - 1]?.assignee}
                  </span>
                  {workflow.steps[workflow.currentStep - 1]?.status === 'in-progress' && (
                    <Badge variant="warning" className="text-xs animate-pulse">
                      In Progress
                    </Badge>
                  )}
                </div>

                {/* Escalation Warning */}
                {workflow.escalationLevel > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-warning/10 rounded border border-warning/20 mb-3">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <span className="text-sm font-medium text-warning">
                      Escalated {workflow.escalationLevel} time(s)
                    </span>
                  </div>
                )}

                {/* Emergency Indicator */}
                {workflow.type === 'emergency' && (
                  <div className="flex items-center gap-2 p-2 bg-red-100 rounded border border-red-200 mb-3">
                    <Zap className="w-4 h-4 text-destructive animate-pulse" />
                    <span className="text-sm font-medium text-destructive">
                      Emergency Workflow - Expedited Processing
                    </span>
                  </div>
                )}

                {/* Timeline */}
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <span>Started:</span>
                    <p className="font-medium">{workflow.startedAt.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span>Est. Completion:</span>
                    <p className="font-medium">{workflow.estimatedCompletion.toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Action Buttons for Current Assignee */}
                {workflow.steps[workflow.currentStep - 1]?.assignee === user?.name && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" className="flex-1">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1">
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                    <Button size="sm" variant="outline">
                      <ArrowRight className="w-3 h-3 mr-1" />
                      Escalate
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {filteredWorkflows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className={cn(isMobile ? "text-sm" : "text-base")}>
                  {filter === 'all' ? 'No active workflows' : `No ${filter} workflows`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Workflow Stats */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t">
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className={cn(
              "font-bold text-primary",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {workflows.length}
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Active
            </p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className={cn(
              "font-bold text-warning",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {pendingCount}
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Pending
            </p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded">
            <p className={cn(
              "font-bold text-destructive",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {escalatedCount}
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Escalated
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};