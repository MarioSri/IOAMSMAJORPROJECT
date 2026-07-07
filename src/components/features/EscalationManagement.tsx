import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  FileText,
  Zap,
  Settings,
  Timer,
  Bell,
  Plus
} from 'lucide-react';

interface EscalationRule {
  id: string;
  name: string;
  description: string;
  triggerCondition: 'time' | 'rejection' | 'manual' | 'priority';
  triggerValue: number; // hours for time, count for rejections
  fromRole: string;
  toRole: string;
  autoEscalate: boolean;
  notificationMethod: 'email' | 'sms' | 'both';
  active: boolean;
}

interface EscalationEvent {
  id: string;
  documentId: string;
  documentTitle: string;
  fromRole: string;
  toRole: string;
  reason: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'pending' | 'resolved' | 'failed';
  escalationLevel: number;
  autoTriggered: boolean;
}

interface EscalationManagementProps {
  userRole: string;
  className?: string;
}

export const EscalationManagement: React.FC<EscalationManagementProps> = ({ userRole, className }) => {
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [escalationEvents, setEscalationEvents] = useState<EscalationEvent[]>([]);
  const [newRule, setNewRule] = useState<Partial<EscalationRule>>({
    name: '',
    description: '',
    triggerCondition: 'time',
    triggerValue: 48,
    fromRole: '',
    toRole: '',
    autoEscalate: true,
    notificationMethod: 'both',
    active: true
  });
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  const { toast } = useToast();

  const roles = ['Employee', 'Program Head', 'HOD', 'Registrar', 'Principal'];

  useEffect(() => {
    // Load default escalation rules
    const defaultRules: EscalationRule[] = [
      {
        id: '1',
        name: 'Standard Document Timeout',
        description: 'Escalate documents pending for more than 48 hours',
        triggerCondition: 'time',
        triggerValue: 48,
        fromRole: 'HOD',
        toRole: 'Registrar',
        autoEscalate: true,
        notificationMethod: 'both',
        active: true
      },
      {
        id: '2',
        name: 'Emergency Document Fast-Track',
        description: 'Immediately escalate emergency documents to Principal',
        triggerCondition: 'priority',
        triggerValue: 1,
        fromRole: 'Any',
        toRole: 'Principal',
        autoEscalate: true,
        notificationMethod: 'sms',
        active: true
      },
      {
        id: '3',
        name: 'Multiple Rejection Escalation',
        description: 'Escalate documents rejected twice to higher authority',
        triggerCondition: 'rejection',
        triggerValue: 2,
        fromRole: 'HOD',
        toRole: 'Principal',
        autoEscalate: true,
        notificationMethod: 'email',
        active: true
      },
      {
        id: '4',
        name: 'Registrar Timeout Escalation',
        description: 'Escalate to Principal if Registrar doesn\'t respond within 24 hours',
        triggerCondition: 'time',
        triggerValue: 24,
        fromRole: 'Registrar',
        toRole: 'Principal',
        autoEscalate: true,
        notificationMethod: 'both',
        active: true
      }
    ];

    const escalationEvents: EscalationEvent[] = [];

    setEscalationRules(defaultRules);
    setEscalationEvents(escalationEvents);
  }, []);

  const createEscalationRule = () => {
    if (!newRule.name || !newRule.fromRole || !newRule.toRole) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const rule: EscalationRule = {
      id: Date.now().toString(),
      name: newRule.name!,
      description: newRule.description || '',
      triggerCondition: newRule.triggerCondition!,
      triggerValue: newRule.triggerValue!,
      fromRole: newRule.fromRole!,
      toRole: newRule.toRole!,
      autoEscalate: newRule.autoEscalate!,
      notificationMethod: newRule.notificationMethod!,
      active: newRule.active!
    };

    setEscalationRules([...escalationRules, rule]);
    setNewRule({
      name: '',
      description: '',
      triggerCondition: 'time',
      triggerValue: 48,
      fromRole: '',
      toRole: '',
      autoEscalate: true,
      notificationMethod: 'both',
      active: true
    });
    setIsCreatingRule(false);

    toast({
      title: "Escalation Rule Created",
      description: "New escalation rule has been added",
    });
  };

  const toggleRule = (ruleId: string) => {
    setEscalationRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, active: !rule.active } : rule
    ));
  };

  const deleteRule = (ruleId: string) => {
    setEscalationRules(prev => prev.filter(rule => rule.id !== ruleId));
    toast({
      title: "Rule Deleted",
      description: "Escalation rule has been removed",
    });
  };

  const manualEscalate = (documentId: string, toRole: string, reason: string) => {
    const newEvent: EscalationEvent = {
      id: Date.now().toString(),
      documentId,
      documentTitle: `Document ${documentId}`,
      fromRole: userRole,
      toRole,
      reason,
      triggeredAt: new Date(),
      status: 'pending',
      escalationLevel: 1,
      autoTriggered: false
    };

    setEscalationEvents([newEvent, ...escalationEvents]);
    
    toast({
      title: "Document Escalated",
      description: `Document escalated to ${toRole}`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending': return <Clock className="w-4 h-4 text-warning animate-pulse" />;
      default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTriggerDescription = (rule: EscalationRule) => {
    switch (rule.triggerCondition) {
      case 'time':
        return `After ${rule.triggerValue} hours`;
      case 'rejection':
        return `After ${rule.triggerValue} rejections`;
      case 'priority':
        return 'For emergency documents';
      case 'manual':
        return 'Manual trigger only';
      default:
        return 'Unknown trigger';
    }
  };

  const activeRules = escalationRules.filter(rule => rule.active).length;
  const pendingEscalations = escalationEvents.filter(event => event.status === 'pending').length;
  const autoEscalations = escalationEvents.filter(event => event.autoTriggered).length;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Escalation Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeRules}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-lg">
                <ArrowUp className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingEscalations}</p>
                <p className="text-sm text-muted-foreground">Pending Escalations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <Zap className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{autoEscalations}</p>
                <p className="text-sm text-muted-foreground">Auto Escalations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Escalation Rules */}
      
      <Card className="shadow-elegant">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Escalation Rules
            </CardTitle>
            <Button
              onClick={() => setIsCreatingRule(true)}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isCreatingRule && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-4">Create New Escalation Rule</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rule Name</label>
                  <Input
                    placeholder="e.g., HOD Timeout Escalation"
                    value={newRule.name}
                    onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Trigger Condition</label>
                  <select
                    value={newRule.triggerCondition}
                    onChange={(e) => setNewRule({...newRule, triggerCondition: e.target.value as any})}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="time">Time-based</option>
                    <option value="rejection">Rejection count</option>
                    <option value="priority">Priority-based</option>
                    <option value="manual">Manual only</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Role</label>
                  <select
                    value={newRule.fromRole}
                    onChange={(e) => setNewRule({...newRule, fromRole: e.target.value})}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">Select role...</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Role</label>
                  <select
                    value={newRule.toRole}
                    onChange={(e) => setNewRule({...newRule, toRole: e.target.value})}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">Select role...</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                
                {(newRule.triggerCondition === 'time' || newRule.triggerCondition === 'rejection') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {newRule.triggerCondition === 'time' ? 'Hours' : 'Rejection Count'}
                    </label>
                    <Input
                      type="number"
                      value={newRule.triggerValue}
                      onChange={(e) => setNewRule({...newRule, triggerValue: parseInt(e.target.value)})}
                      min="1"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notification Method</label>
                  <select
                    value={newRule.notificationMethod}
                    onChange={(e) => setNewRule({...newRule, notificationMethod: e.target.value as any})}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="email">Email Only</option>
                    <option value="sms">SMS Only</option>
                    <option value="both">Email + SMS</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe when and how this rule should be applied..."
                  value={newRule.description}
                  onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                  rows={2}
                />
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsCreatingRule(false)}>
                  Cancel
                </Button>
                <Button onClick={createEscalationRule}>
                  <Settings className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {escalationRules.map((rule) => (
              <div key={rule.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{rule.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.active ? "success" : "secondary"}>
                      {rule.active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRule(rule.id)}
                    >
                      {rule.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <XCircle className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Trigger</p>
                    <p className="font-medium">{getTriggerDescription(rule)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">From → To</p>
                    <p className="font-medium">{rule.fromRole} → {rule.toRole}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Auto Escalate</p>
                    <p className="font-medium">{rule.autoEscalate ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Notification</p>
                    <p className="font-medium capitalize">{rule.notificationMethod}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Escalation Events */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5 text-primary" />
            Recent Escalations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {escalationEvents.map((event) => (
              <div key={event.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{event.documentTitle}</h4>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(event.status)}
                    <Badge 
                      variant={
                        event.status === 'resolved' ? 'success' :
                        event.status === 'failed' ? 'destructive' : 'warning'
                      }
                    >
                      {event.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-muted-foreground">Document</p>
                    <p className="font-medium">{event.documentId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Escalation</p>
                    <p className="font-medium">{event.fromRole} → {event.toRole}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Level</p>
                    <p className="font-medium">Level {event.escalationLevel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Triggered</p>
                    <p className="font-medium">{event.triggeredAt.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Reason:</span>
                  <span>{event.reason}</span>
                  {event.autoTriggered && (
                    <Badge variant="outline" className="text-xs">
                      Auto-triggered
                    </Badge>
                  )}
                </div>
                
                {event.status === 'resolved' && event.resolvedAt && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-success/10 rounded">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-sm text-success">
                      Resolved at {event.resolvedAt.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            ))}
            
            {escalationEvents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No escalation events</p>
                <p className="text-sm">Escalation history will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};