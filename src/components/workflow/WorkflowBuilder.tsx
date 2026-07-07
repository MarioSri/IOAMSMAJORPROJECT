import React, { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  MarkerType,
  Handle,
  Position,
  ConnectionMode,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  getSmoothStepPath,
  getStraightPath,
  EdgeProps,
  NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  UserCheck,
  Building,
  Crown,
  Clock,
  GitBranch,
  CheckCircle,
  XCircle,
  Timer,
  AlertTriangle,
  Play,
  Square,
  Diamond,
  Circle,
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Settings,
  Zap,
  Route,
  ArrowRight,
  RotateCw
} from "lucide-react";

interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  role?: string;
  description?: string;
  status?: string;
}

interface WorkflowEdgeData extends Record<string, unknown> {
  label?: string;
  color?: string;
  animated?: boolean;
  dashed?: boolean;
  weight?: number;
}

// Custom Edge Components
const AnimatedEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: EdgeProps<Edge<WorkflowEdgeData>>) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{
        ...style,
        strokeWidth: 3,
        stroke: data?.color || '#64748b',
        strokeDasharray: data?.animated ? '5,5' : undefined,
        animation: data?.animated ? 'dash 1s linear infinite' : undefined,
      }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="workflow-edge-label nodrag nopan bg-white px-2 py-1 rounded border shadow-sm text-xs font-medium"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px,${(sourceY + targetY) / 2}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const SmoothEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: EdgeProps<Edge<WorkflowEdgeData>>) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{
        ...style,
        strokeWidth: data?.weight || 2,
        stroke: data?.color || '#64748b',
        strokeDasharray: data?.dashed ? '8,4' : undefined,
      }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="workflow-edge-label nodrag nopan bg-blue-50 px-2 py-1 rounded border border-blue-200 shadow-sm text-xs font-medium text-blue-800"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px,${(sourceY + targetY) / 2}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const StraightEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: EdgeProps<Edge<WorkflowEdgeData>>) => {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{
        ...style,
        strokeWidth: 3,
        stroke: data?.color || '#64748b',
        strokeLinecap: 'round',
      }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="workflow-edge-label nodrag nopan bg-gray-50 px-2 py-1 rounded border shadow-sm text-xs font-medium"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px,${(sourceY + targetY) / 2}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
  smooth: SmoothEdge,
  straight: StraightEdge,
};

// Custom Node Components
const RoleNode = ({ data, selected }: NodeProps<Node<WorkflowNodeData>>) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Principal': return <Crown className="h-4 w-4" />;
      case 'Registrar': return <UserCheck className="h-4 w-4" />;
      case 'HOD': return <Building className="h-4 w-4" />;
      case 'Program Head': return <Users className="h-4 w-4" />;
      case 'Employee': return <Users className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Principal': return 'bg-green-100 border-green-500 text-green-800';
      case 'Registrar': return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'HOD': return 'bg-purple-100 border-purple-500 text-purple-800';
      case 'Program Head': return 'bg-indigo-100 border-indigo-500 text-indigo-800';
      case 'Employee': return 'bg-gray-100 border-gray-500 text-gray-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  return (
    <div className={`relative px-4 py-3 rounded-lg border-2 min-w-[140px] ${getRoleColor(data.role)} ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
      <div className="flex items-center gap-2">
        {getRoleIcon(data.role)}
        <span className="font-medium text-sm">{data.role}</span>
      </div>
      <div className="text-xs mt-1 font-medium">{data.label}</div>
      {data.description && (
        <div className="text-xs mt-1 opacity-75">{data.description}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
    </div>
  );
};

const StartNode = ({ data, selected }: NodeProps<Node<WorkflowNodeData>>) => (
  <div className={`relative bg-green-200 border-2 border-green-600 rounded-full w-16 h-16 flex items-center justify-center ${selected ? 'ring-2 ring-blue-400' : ''}`}>
    <Play className="h-6 w-6 text-green-800" />
    <div className="absolute -bottom-6 text-xs font-medium text-green-800 whitespace-nowrap">
      {data.label || 'Start'}
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      className="w-3 h-3 bg-green-600 border-2 border-white"
    />
  </div>
);

const EndNode = ({ data, selected }: NodeProps<Node<WorkflowNodeData>>) => (
  <div className={`relative bg-red-200 border-2 border-red-600 rounded-full w-16 h-16 flex items-center justify-center ${selected ? 'ring-2 ring-blue-400' : ''}`}>
    <Square className="h-6 w-6 text-red-800" />
    <div className="absolute -bottom-6 text-xs font-medium text-red-800 whitespace-nowrap">
      {data.label || 'End'}
    </div>
    <Handle
      type="target"
      position={Position.Top}
      className="w-3 h-3 bg-red-600 border-2 border-white"
    />
  </div>
);

const DecisionNode = ({ data, selected }: NodeProps<Node<WorkflowNodeData>>) => (
  <div className={`relative transform rotate-45 bg-yellow-100 border-2 border-yellow-500 w-20 h-20 flex items-center justify-center ${selected ? 'ring-2 ring-blue-400' : ''}`}>
    <div className="transform -rotate-45">
      <GitBranch className="h-4 w-4 text-yellow-800" />
    </div>
    <div className="absolute -bottom-8 transform -rotate-45 text-xs font-medium text-yellow-800 whitespace-nowrap">
      {data.label || 'Decision'}
    </div>
    <Handle
      type="target"
      position={Position.Top}
      className="w-3 h-3 bg-yellow-600 border-2 border-white transform -translate-y-2"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      className="w-3 h-3 bg-yellow-600 border-2 border-white transform translate-y-2"
    />
    <Handle
      type="source"
      position={Position.Right}
      className="w-3 h-3 bg-yellow-600 border-2 border-white transform translate-x-2"
      id="yes"
    />
    <Handle
      type="source"
      position={Position.Left}
      className="w-3 h-3 bg-yellow-600 border-2 border-white transform -translate-x-2"
      id="no"
    />
  </div>
);

const ProcessNode = ({ data, selected }: NodeProps<Node<WorkflowNodeData>>) => (
  <div className={`relative bg-blue-100 border-2 border-blue-500 rounded-lg px-4 py-3 min-w-[140px] ${selected ? 'ring-2 ring-blue-400' : ''}`}>
    <Handle
      type="target"
      position={Position.Top}
      className="w-3 h-3 bg-blue-600 border-2 border-white"
    />
    <div className="flex items-center gap-2 text-blue-800">
      <Circle className="h-4 w-4" />
      <span className="font-medium text-sm">Process</span>
    </div>
    <div className="text-xs mt-1 font-medium">{data.label}</div>
    {data.description && (
      <div className="text-xs mt-1 opacity-75">{data.description}</div>
    )}
    <Handle
      type="source"
      position={Position.Bottom}
      className="w-3 h-3 bg-blue-600 border-2 border-white"
    />
  </div>
);

const StatusNode = ({ data, selected }: NodeProps<Node<WorkflowNodeData>>) => {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved': return { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-100 border-green-500 text-green-800', label: 'Approved' };
      case 'rejected': return { icon: <XCircle className="h-4 w-4" />, color: 'bg-red-100 border-red-500 text-red-800', label: 'Rejected' };
      case 'pending': return { icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-100 border-yellow-500 text-yellow-800', label: 'Pending' };
      case 'draft': return { icon: <Timer className="h-4 w-4" />, color: 'bg-gray-100 border-gray-500 text-gray-800', label: 'Draft' };
      default: return { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-gray-100 border-gray-500 text-gray-800', label: 'Unknown' };
    }
  };

  const statusDisplay = getStatusDisplay(data.status);

  return (
    <div className={`relative px-3 py-2 rounded-lg border-2 min-w-[100px] ${statusDisplay.color} ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-600 border-2 border-white"
      />
      <div className="flex items-center gap-2">
        {statusDisplay.icon}
        <span className="font-medium text-sm">{statusDisplay.label}</span>
      </div>
      {data.description && (
        <div className="text-xs mt-1 opacity-75">{data.description}</div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  roleNode: RoleNode,
  decisionNode: DecisionNode,
  processNode: ProcessNode,
  statusNode: StatusNode,
};

const initialNodes: Node[] = [
  {
    id: 'start-1',
    type: 'startNode',
    position: { x: 250, y: 25 },
    data: { label: 'Workflow Start' },
  },
  {
    id: 'role-1',
    type: 'roleNode',
    position: { x: 200, y: 125 },
    data: { role: 'Employee', label: 'Submit Request', description: 'Initial submission' },
  },
  {
    id: 'decision-1',
    type: 'decisionNode',
    position: { x: 225, y: 225 },
    data: { label: 'Urgent?' },
  },
  {
    id: 'role-2',
    type: 'roleNode',
    position: { x: 100, y: 325 },
    data: { role: 'HOD', label: 'Department Review', description: 'Normal process' },
  },
  {
    id: 'role-3',
    type: 'roleNode',
    position: { x: 350, y: 325 },
    data: { role: 'Principal', label: 'Emergency Review', description: 'Fast track' },
  },
  {
    id: 'role-4',
    type: 'roleNode',
    position: { x: 100, y: 425 },
    data: { role: 'Registrar', label: 'Final Approval', description: 'Standard approval' },
  },
  {
    id: 'end-1',
    type: 'endNode',
    position: { x: 250, y: 525 },
    data: { label: 'Complete' },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e-start-role1',
    source: 'start-1',
    target: 'role-1',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-role1-decision1',
    source: 'role-1',
    target: 'decision-1',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-decision1-role2',
    source: 'decision-1',
    target: 'role-2',
    sourceHandle: 'no',
    type: 'smoothstep',
    label: 'No',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-decision1-role3',
    source: 'decision-1',
    target: 'role-3',
    sourceHandle: 'yes',
    type: 'smoothstep',
    label: 'Yes',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-role2-role4',
    source: 'role-2',
    target: 'role-4',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-role3-end1',
    source: 'role-3',
    target: 'end-1',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-role4-end1',
    source: 'role-4',
    target: 'end-1',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

export const WorkflowBuilder = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [connectionMode, setConnectionMode] = useState<'normal' | 'priority' | 'emergency' | 'conditional'>('normal');

  const getConnectionStyle = (mode: string) => {
    switch (mode) {
      case 'priority':
        return {
          type: 'animated',
          data: {
            color: '#f59e0b',
            weight: 3,
            animated: true,
            label: 'Priority'
          },
          style: { stroke: '#f59e0b', strokeWidth: 3 }
        };
      case 'emergency':
        return {
          type: 'straight',
          data: {
            color: '#ef4444',
            weight: 4,
            label: 'Emergency'
          },
          style: { stroke: '#ef4444', strokeWidth: 4 }
        };
      case 'conditional':
        return {
          type: 'smooth',
          data: {
            color: '#3b82f6',
            weight: 2,
            dashed: true,
            label: 'Conditional'
          },
          style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '8,4' }
        };
      default:
        return {
          type: 'smooth',
          data: {
            color: '#64748b',
            weight: 2,
            label: 'Normal'
          },
          style: { stroke: '#64748b', strokeWidth: 2 }
        };
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      // Add validation for connections
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      // Prevent self-connections
      if (params.source === params.target) return;

      // Prevent multiple connections between same nodes
      const existingConnection = edges.find(
        edge => edge.source === params.source && edge.target === params.target
      );
      if (existingConnection) return;

      // Get connection style based on current mode
      const connectionStyle = getConnectionStyle(connectionMode);

      // Add the edge with enhanced styling
      const newEdge: Edge = {
        ...params,
        id: `edge-${Date.now()}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        ...connectionStyle,
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, nodes, edges, connectionMode]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const updateEdge = (edgeId: string, newData: Partial<Edge>) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId ? { ...edge, ...newData } : edge
      )
    );
    setSelectedEdge(null);
  };

  const deleteEdge = (edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    setSelectedEdge(null);
  };

  const addNode = (type: string, nodeData: Partial<WorkflowNodeData>) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { ...nodeData },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNode = (nodeId: string, newData: Partial<WorkflowNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
    setEditingNode(null);
    setSelectedNode(null);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNode(null);
  };

  const saveWorkflow = () => {
    const workflow = {
      name: workflowName,
      nodes,
      edges,
      createdAt: new Date().toISOString()
    };

    const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '[]');
    savedWorkflows.push(workflow);
    localStorage.setItem('workflows', JSON.stringify(savedWorkflows));

    alert(`Workflow "${workflowName}" saved successfully!`);
  };

  const loadWorkflow = () => {
    const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '[]');
    if (savedWorkflows.length > 0) {
      const workflow = savedWorkflows[savedWorkflows.length - 1]; // Load last saved
      setNodes(workflow.nodes);
      setEdges(workflow.edges);
      setWorkflowName(workflow.name);
    }
  };

  const clearWorkflow = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setWorkflowName('New Workflow');
  };

  const nodeLibrary = [
    {
      type: 'startNode',
      data: { label: 'Start' },
      icon: Play,
      color: 'bg-green-100 hover:bg-green-200',
      description: 'Workflow start point'
    },
    {
      type: 'endNode',
      data: { label: 'End' },
      icon: Square,
      color: 'bg-red-100 hover:bg-red-200',
      description: 'Workflow end point'
    },
    {
      type: 'roleNode',
      data: { role: 'Principal', label: 'Principal Review', description: 'Review by Principal' },
      icon: Crown,
      color: 'bg-green-100 hover:bg-green-200',
      description: 'Principal role task'
    },
    {
      type: 'roleNode',
      data: { role: 'Registrar', label: 'Registrar Check', description: 'Check by Registrar' },
      icon: UserCheck,
      color: 'bg-blue-100 hover:bg-blue-200',
      description: 'Registrar role task'
    },
    {
      type: 'roleNode',
      data: { role: 'HOD', label: 'HOD Approval', description: 'Department head approval' },
      icon: Building,
      color: 'bg-purple-100 hover:bg-purple-200',
      description: 'HOD role task'
    },
    {
      type: 'roleNode',
      data: { role: 'Program Head', label: 'Program Review', description: 'Program head review' },
      icon: Users,
      color: 'bg-indigo-100 hover:bg-indigo-200',
      description: 'Program head role task'
    },
    {
      type: 'roleNode',
      data: { role: 'Employee', label: 'Employee Task', description: 'Employee task' },
      icon: Users,
      color: 'bg-gray-100 hover:bg-gray-200',
      description: 'Employee role task'
    },
    {
      type: 'decisionNode',
      data: { label: 'Decision Point' },
      icon: Diamond,
      color: 'bg-yellow-100 hover:bg-yellow-200',
      description: 'Decision/branching point'
    },
    {
      type: 'processNode',
      data: { label: 'Process Step', description: 'Processing step' },
      icon: Circle,
      color: 'bg-blue-100 hover:bg-blue-200',
      description: 'General process step'
    },
    {
      type: 'statusNode',
      data: { status: 'approved', description: 'Approved status' },
      icon: CheckCircle,
      color: 'bg-green-100 hover:bg-green-200',
      description: 'Status node'
    },
    {
      type: 'statusNode',
      data: { status: 'rejected', description: 'Rejected status' },
      icon: XCircle,
      color: 'bg-red-100 hover:bg-red-200',
      description: 'Rejection status'
    },
    {
      type: 'statusNode',
      data: { status: 'pending', description: 'Pending status' },
      icon: Clock,
      color: 'bg-yellow-100 hover:bg-yellow-200',
      description: 'Pending status'
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
        <div className="flex items-center gap-4">
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="w-48"
            placeholder="Workflow name"
          />
          <Badge variant="outline" className="gap-1">
            <Circle className="h-3 w-3" />
            {nodes.length} nodes
          </Badge>
          <Badge variant="outline" className="gap-1">
            <GitBranch className="h-3 w-3" />
            {edges.length} connections
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearWorkflow}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={loadWorkflow}>
            <Upload className="h-4 w-4 mr-1" />
            Load
          </Button>
          <Button variant="default" size="sm" onClick={saveWorkflow}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Connection Mode Selector */}
      <div className="flex items-center gap-4 p-4 bg-background border rounded-lg">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4" />
          <span className="text-sm font-medium">Connection Mode:</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={connectionMode === 'normal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setConnectionMode('normal')}
            className="gap-1"
          >
            <ArrowRight className="h-3 w-3" />
            Normal
          </Button>
          <Button
            variant={connectionMode === 'priority' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setConnectionMode('priority')}
            className="gap-1 text-yellow-700 border-yellow-300 hover:bg-yellow-50"
          >
            <Zap className="h-3 w-3" />
            Priority
          </Button>
          <Button
            variant={connectionMode === 'emergency' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setConnectionMode('emergency')}
            className="gap-1 text-red-700 border-red-300 hover:bg-red-50"
          >
            <AlertTriangle className="h-3 w-3" />
            Emergency
          </Button>
          <Button
            variant={connectionMode === 'conditional' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setConnectionMode('conditional')}
            className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            <GitBranch className="h-3 w-3" />
            Conditional
          </Button>
        </div>
      </div>

      <div className="flex h-[700px] gap-4">
        {/* Node Library */}
        <div className="w-72 bg-background border rounded-lg overflow-hidden">
          <div className="p-4 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Node Library
            </h3>
            <p className="text-sm text-muted-foreground">Click to add nodes to canvas</p>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto max-h-[580px]">
            {nodeLibrary.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className={`w-full justify-start gap-3 h-auto p-3 transition-colors ${item.color}`}
                  onClick={() => addNode(item.type, item.data)}
                >
                  <IconComponent className="h-4 w-4" />
                  <div className="text-left flex-1">
                    <div className="font-medium text-sm">
                      {item.data.role || item.data.status || item.data.label || 'Node'}
                    </div>
                    <div className="text-xs opacity-75">
                      {item.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 border rounded-lg bg-background overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            style={{ backgroundColor: 'hsl(var(--background))' }}
            defaultEdgeOptions={{
              type: 'smooth',
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2 }
            }}
            connectionLineStyle={{
              strokeWidth: 3,
              stroke: connectionMode === 'priority' ? '#f59e0b' :
                connectionMode === 'emergency' ? '#ef4444' :
                  connectionMode === 'conditional' ? '#3b82f6' : '#64748b',
              strokeDasharray: connectionMode === 'conditional' ? '8,4' : undefined,
            }}
          >
            <Controls
              showZoom
              showFitView
              showInteractive
              className="bg-background border rounded-lg shadow-sm"
            />
            <MiniMap
              zoomable
              pannable
              nodeStrokeWidth={3}
              className="bg-background border rounded-lg shadow-sm"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
            />
            <Background
              gap={20}
              size={1}
              color="hsl(var(--muted-foreground))"
              style={{ opacity: 0.1 }}
            />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-background border rounded-lg overflow-hidden">
          <div className="p-4 border-b bg-muted/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Properties
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedNode ? 'Configure selected node' : selectedEdge ? 'Configure selected connection' : 'Select node or connection'}
            </p>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[580px]">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <Circle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Node Selected</span>
                </div>

                <div>
                  <Label className="text-sm font-medium">Node Type</Label>
                  <p className="text-sm text-muted-foreground capitalize">{selectedNode.type}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Node ID</Label>
                  <p className="text-sm text-muted-foreground font-mono">{selectedNode.id}</p>
                </div>

                {selectedNode.data?.role && (
                  <div>
                    <Label className="text-sm font-medium">Role</Label>
                    <p className="text-sm text-muted-foreground">{String(selectedNode.data.role)}</p>
                  </div>
                )}

                {selectedNode.data?.label && (
                  <div>
                    <Label className="text-sm font-medium">Label</Label>
                    <p className="text-sm text-muted-foreground">{String(selectedNode.data.label)}</p>
                  </div>
                )}

                {selectedNode.data?.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground">{String(selectedNode.data.description)}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingNode(selectedNode)}
                    className="flex-1"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteNode(selectedNode.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                  <Route className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Connection Selected</span>
                </div>

                <div>
                  <Label className="text-sm font-medium">Connection ID</Label>
                  <p className="text-sm text-muted-foreground font-mono">{selectedEdge.id}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Connection Type</Label>
                  <p className="text-sm text-muted-foreground capitalize">{selectedEdge.type}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">From → To</Label>
                  <p className="text-sm text-muted-foreground">{selectedEdge.source} → {selectedEdge.target}</p>
                </div>

                {selectedEdge.data?.label && (
                  <div>
                    <Label className="text-sm font-medium">Label</Label>
                    <p className="text-sm text-muted-foreground">{String(selectedEdge.data.label)}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Connection Style</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={`w-8 h-0.5 rounded ${selectedEdge.data?.color === '#f59e0b' ? 'bg-yellow-500' :
                        selectedEdge.data?.color === '#ef4444' ? 'bg-red-500' :
                          selectedEdge.data?.color === '#3b82f6' ? 'bg-blue-500 border-dashed' : 'bg-gray-400'
                        }`}
                    ></div>
                    <span className="text-xs text-muted-foreground">
                      {selectedEdge.data?.color === '#f59e0b' ? 'Priority' :
                        selectedEdge.data?.color === '#ef4444' ? 'Emergency' :
                          selectedEdge.data?.color === '#3b82f6' ? 'Conditional' : 'Normal'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteEdge(selectedEdge.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Connection
                  </Button>
                </div>
              </div>
            ) : editingNode ? (
              <NodeEditForm
                node={editingNode}
                onSave={updateNode}
                onCancel={() => setEditingNode(null)}
              />
            ) : (
              <div className="text-center py-8">
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Circle className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">
                      Select a node or connection
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click on any node or wire to configure it
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium mb-3 block">Wire Connection Types</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-0.5 bg-gray-400 rounded"></div>
                        <span className="text-xs">Normal Flow</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-0.5 bg-yellow-500 rounded animate-pulse"></div>
                        <span className="text-xs">Priority (Animated)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-1 bg-red-500 rounded"></div>
                        <span className="text-xs">Emergency (Thick)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                        <span className="text-xs">Conditional (Dashed)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Node Edit Form Component
const NodeEditForm = ({ node, onSave, onCancel }: {
  node: Node;
  onSave: (nodeId: string, newData: Partial<WorkflowNodeData>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    label: String(node.data.label || ''),
    description: String(node.data.description || ''),
    role: String(node.data.role || ''),
    status: String(node.data.status || '')
  });

  const handleSave = () => {
    onSave(node.id, formData);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Edit Node</Label>
        <p className="text-xs text-muted-foreground">Modify node properties</p>
      </div>

      <div>
        <Label htmlFor="label" className="text-sm">Label</Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="Node label"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="description" className="text-sm">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Node description"
          className="mt-1"
        />
      </div>

      {node.type === 'roleNode' && (
        <div>
          <Label htmlFor="role" className="text-sm">Role</Label>
          <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Principal">Principal</SelectItem>
              <SelectItem value="Registrar">Registrar</SelectItem>
              <SelectItem value="HOD">HOD</SelectItem>
              <SelectItem value="Program Head">Program Head</SelectItem>
              <SelectItem value="Employee">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {node.type === 'statusNode' && (
        <div>
          <Label htmlFor="status" className="text-sm">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="default" size="sm" onClick={handleSave} className="flex-1">
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
};