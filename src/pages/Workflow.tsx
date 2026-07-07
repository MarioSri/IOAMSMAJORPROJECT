import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Workflow, GitBranch, Clock, CheckCircle2, XCircle, Users, Settings, Plus, ChevronDown, FileText, AlertTriangle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WorkflowBuilder } from "@/components/workflow/WorkflowBuilder";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

export default function WorkflowManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [expandedHierarchy, setExpandedHierarchy] = useState<number | null>(null);

  function handleLogout() {
    navigate("/");
  }

  const handleHierarchyAction = (action: string) => {
    toast({
      title: "Feature Access",
      description: `${action} functionality accessed`,
    });
  };

  const toggleHierarchy = (workflowId: number) => {
    setExpandedHierarchy(expandedHierarchy === workflowId ? null : workflowId);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (expandedHierarchy && !target.closest('.hierarchy-expandable')) {
        setExpandedHierarchy(null);
      }
    };

    if (expandedHierarchy) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [expandedHierarchy]);

  if (!user) return null;

  const workflows = [
    {
      id: 1,
      name: "Document Approval Workflow",
      description: "Standard approval process for reports and circulars",
      status: "active",
      steps: ["Submit", "HOD Review", "Registrar Approval", "Principal Sign-off"],
      documents: 24
    },
    {
      id: 2,
      name: "Emergency Document Workflow",
      description: "Fast-track approval for urgent documents",
      status: "active",
      steps: ["Submit", "Principal Direct Approval"],
      documents: 3
    },
    {
      id: 3,
      name: "Meeting Request Workflow",
      description: "Approval process for meeting scheduling",
      status: "draft",
      steps: ["Request", "Calendar Check", "Approval", "Notification"],
      documents: 0
    }
  ];

  return (
    <DashboardLayout userRole={user.role} onLogout={handleLogout}>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Workflow Management</h1>
          <p className="text-muted-foreground">Design and manage document approval workflows</p>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Workflow Templates</TabsTrigger>
            <TabsTrigger value="builder">Visual Hierarchy Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Workflow className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">3</p>
                      <p className="text-sm text-muted-foreground">Active Workflows</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-warning/10 rounded-lg">
                      <Clock className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">12</p>
                      <p className="text-sm text-muted-foreground">Pending Approvals</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-success/10 rounded-lg">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">89</p>
                      <p className="text-sm text-muted-foreground">Completed This Month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Workflow Templates
                </CardTitle>
                <CardDescription>
                  Manage and configure approval workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflows.map((workflow) => (
                    <div key={workflow.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{workflow.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={workflow.status === "active" ? "default" : "secondary"}>
                            {workflow.status}
                          </Badge>
                          <Badge variant="outline">
                            {workflow.documents} documents
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-1">
                          {workflow.steps.map((step, index) => (
                            <span key={step} className="flex items-center">
                              <span className="text-xs bg-muted px-2 py-1 rounded">{step}</span>
                              {index < workflow.steps.length - 1 && (
                                <span className="mx-1 text-muted-foreground">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit Workflow</Button>

                        <div className="relative hierarchy-expandable">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleHierarchy(workflow.id)}
                            className={`transition-all duration-300 ease-in-out hierarchy-button-text ${expandedHierarchy === workflow.id
                                ? 'bg-primary/10 border-primary/30'
                                : 'hover:bg-primary/5'
                              }`}
                          >
                            <Plus className={`h-4 w-4 hierarchy-plus-icon ${expandedHierarchy === workflow.id ? 'rotate-45' : ''
                              }`} />
                            <span className="ml-1">Add Hierarchy</span>
                          </Button>

                          <div className={`absolute top-full left-0 mt-2 hierarchy-options z-20 ${expandedHierarchy === workflow.id
                              ? 'opacity-100 translate-y-0 pointer-events-auto'
                              : 'opacity-0 -translate-y-2 pointer-events-none'
                            } transition-all duration-500 ease-in-out`}>
                            <div className="flex gap-2 bg-white border rounded-lg shadow-lg p-2 min-w-max">
                              <button
                                onClick={() => {
                                  handleHierarchyAction("Document Management Recipients");
                                  setExpandedHierarchy(null);
                                }}
                                className="hierarchy-option group flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 hover:bg-blue-50 hover:border-blue-200 border border-transparent"
                              >
                                <div className="p-1 bg-blue-500 rounded group-hover:scale-110 transition-transform duration-200">
                                  <FileText className="h-3 w-3 text-white" />
                                </div>
                                <span className="text-sm font-medium text-blue-800 whitespace-nowrap">
                                  Document Management Recipients
                                </span>
                              </button>

                              <button
                                onClick={() => {
                                  handleHierarchyAction("Emergency Management Recipients");
                                  setExpandedHierarchy(null);
                                }}
                                className="hierarchy-option group flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 hover:bg-red-50 hover:border-red-200 border border-transparent"
                              >
                                <div className="p-1 bg-red-500 rounded group-hover:scale-110 transition-transform duration-200">
                                  <AlertTriangle className="h-3 w-3 text-white" />
                                </div>
                                <span className="text-sm font-medium text-red-800 whitespace-nowrap">
                                  Emergency Management Recipients
                                </span>
                              </button>

                              <button
                                onClick={() => {
                                  handleHierarchyAction("Approval Chain with Bypass");
                                  setExpandedHierarchy(null);
                                }}
                                className="hierarchy-option group flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 hover:bg-green-50 hover:border-green-200 border border-transparent"
                              >
                                <div className="p-1 bg-green-500 rounded group-hover:scale-110 transition-transform duration-200">
                                  <Shield className="h-3 w-3 text-white" />
                                </div>
                                <span className="text-sm font-medium text-green-800 whitespace-nowrap">
                                  Approval Chain with Bypass
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="builder" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Visual Workflow Hierarchy Builder
                </CardTitle>
                <CardDescription>
                  Drag and drop to create custom approval workflows with role-based nodes and smart routing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowBuilder />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}