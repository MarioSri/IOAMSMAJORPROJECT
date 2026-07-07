import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Calendar as CalendarIcon,
  TrendingUp,
  AlertTriangle,
  Eye,
  Search
} from "lucide-react";
import { AdvancedSignatureIcon } from "@/components/ui/signature-icon";

interface DashboardStatsProps {
  userRole: string;
  onNavigate: (view: string) => void;
}

export function DashboardStats({ userRole, onNavigate }: DashboardStatsProps) {
  const navigate = useNavigate();
  // Stats data - fetched from API
  const getStatsForRole = () => {
    const commonStats = [
      {
        title: "Total Documents",
        value: "0",
        change: "0%",
        icon: FileText,
        color: "text-blue-500",
        bgColor: "bg-blue-50"
      },
      {
        title: "Pending Reviews",
        value: "0",
        change: "0",
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-yellow-50"
      },
      {
        title: "Approved",
        value: "0",
        change: "0",
        icon: CheckCircle,
        color: "text-success",
        bgColor: "bg-green-50"
      },
      {
        title: "Rejected",
        value: "0",
        change: "0",
        icon: XCircle,
        color: "text-destructive",
        bgColor: "bg-red-50"
      }
    ];

    const roleSpecific = {
      principal: [
        ...commonStats,
        {
          title: "Active Users",
          value: "0",
          change: "0%",
          icon: Users,
          color: "text-purple-500",
          bgColor: "bg-purple-50"
        }
      ],
      registrar: [
        ...commonStats,
        {
          title: "Workflows Active",
          value: "0",
          change: "0",
          icon: TrendingUp,
          color: "text-indigo-500",
          bgColor: "bg-indigo-50"
        }
      ],
      hod: commonStats,
      employee: commonStats.slice(0, 3)
    };

    return roleSpecific[userRole as keyof typeof roleSpecific] || commonStats;
  };

  const stats = getStatsForRole();

  const recentDocuments = [
    {
      id: 1,
      title: "Faculty Recruitment Letter",
      type: "Letter",
      status: "approved",
      submittedBy: "Dr. Sharma",
      date: "2024-01-15",
      priority: "normal"
    },
    {
      id: 2,
      title: "Semester Fee Structure Circular",
      type: "Circular",
      status: "pending",
      submittedBy: "Finance Team",
      date: "2024-01-14",
      priority: "high"
    },
    {
      id: 3,
      title: "Monthly Academic Report",
      type: "Report",
      status: "under-review",
      submittedBy: "Academic Cell",
      date: "2024-01-13",
      priority: "normal"
    },
    {
      id: 4,
      title: "Infrastructure Development Plan",
      type: "Report",
      status: "rejected",
      submittedBy: "Engineering Dept",
      date: "2024-01-12",
      priority: "urgent"
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { variant: "success" as const, text: "Approved" },
      pending: { variant: "warning" as const, text: "Pending" },
      "under-review": { variant: "default" as const, text: "Under Review" },
      rejected: { variant: "destructive" as const, text: "Rejected" }
    };

    return statusConfig[status as keyof typeof statusConfig] || { variant: "default" as const, text: status };
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      normal: "text-blue-500",
      high: "text-warning",
      urgent: "text-destructive"
    };
    return colors[priority as keyof typeof colors] || "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-elegant hover:shadow-glow transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className={stat.change.startsWith('+') ? 'text-success' : 'text-destructive'}>
                      {stat.change}
                    </span>
                    {' '}from last week
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Approvals */}
      <Card className="shadow-elegant">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Approvals</CardTitle>
              <CardDescription>Latest approval submissions and their status</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/documents")}>
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{doc.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {doc.type} • Submitted by {doc.submittedBy} • {doc.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${getPriorityColor(doc.priority)}`} />
                  <Badge variant={getStatusBadge(doc.status).variant}>
                    {getStatusBadge(doc.status).text}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Frequently used actions for your role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/search")}
            >
              <Search className="w-6 h-6 text-primary" />
              <span className="text-sm">Universal Search</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/documents")}
            >
              <FileText className="w-6 h-6 text-primary" />
              <span className="text-sm">Submit Document</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/approvals")}
            >
              <AdvancedSignatureIcon className="w-6 h-6 text-warning" />
              <span className="text-sm">Review Pending</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/calendar")}
            >
              <CalendarIcon className="w-6 h-6 text-blue-500" />
              <span className="text-sm">Schedule Meeting</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col gap-2"
              onClick={() => navigate("/documents")}
            >
              <Users className="w-6 h-6 text-purple-500" />
              <span className="text-sm">View Documents</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}