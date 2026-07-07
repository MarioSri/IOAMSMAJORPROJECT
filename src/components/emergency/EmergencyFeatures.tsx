import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import {
  AlertTriangle,
  Zap,
  Clock,
  Users,
  FileText,
  Send,
  Shield,
  Bell,
  Siren,
  Upload
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EmergencyFeaturesProps {
  userRole: string;
}

export function EmergencyFeatures({ userRole }: EmergencyFeaturesProps) {
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyHistory, setEmergencyHistory] = useState([]);

  const emergencyContacts = [
    { role: "Principal", name: "Dr. Rajesh Kumar", phone: "+91-9876543210", available: true },
    { role: "Registrar", name: "Prof. Anita Sharma", phone: "+91-9876543211", available: true },
    { role: "Security Head", name: "Mr. Ramesh Singh", phone: "+91-9876543212", available: true },
    { role: "Medical Officer", name: "Dr. Priya Patel", phone: "+91-9876543213", available: true },
  ];

  const emergencyTypes = [
    { type: "Infrastructure", icon: AlertTriangle, color: "text-destructive" },
    { type: "Security", icon: Shield, color: "text-warning" },
    { type: "Medical", icon: Zap, color: "text-red-500" },
    { type: "Academic", icon: FileText, color: "text-blue-500" },
    { type: "Financial", icon: Bell, color: "text-purple-500" }
  ];

  const handleEmergencySubmit = (data: any) => {
    const emergency = {
      id: Date.now(),
      title: data.description || "Emergency Document",
      submittedBy: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`,
      timestamp: new Date().toLocaleString(),
      priority: "critical",
      status: "active",
      description: data.description
    };
    setEmergencyHistory([emergency, ...emergencyHistory]);
    setEmergencyMode(false);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "destructive" as const, text: "Active" },
      resolved: { variant: "success" as const, text: "Resolved" },
      pending: { variant: "warning" as const, text: "Pending" }
    };
    return variants[status as keyof typeof variants] || { variant: "default" as const, text: status };
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: "text-red-600 bg-red-50 border-red-200",
      high: "text-orange-600 bg-orange-50 border-orange-200",
      medium: "text-yellow-600 bg-yellow-50 border-yellow-200"
    };
    return colors[priority as keyof typeof colors] || "text-gray-600 bg-gray-50 border-gray-200";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Emergency Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Siren className="w-6 h-6 text-destructive animate-pulse-glow" />
            Emergency Management Center
          </h2>
          <p className="text-muted-foreground">Critical document submission and emergency response system</p>
        </div>

        <Dialog open={emergencyMode} onOpenChange={setEmergencyMode}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              size="lg"
              className="animate-pulse bg-red-600 hover:bg-red-700 shadow-lg"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              EMERGENCY SUBMIT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl border-destructive">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-600" />
                Document Submission
              </DialogTitle>
              <DialogDescription>
                This will bypass normal approval workflows and send directly to all relevant authorities
              </DialogDescription>
            </DialogHeader>

            <Alert className="border-destructive bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                Emergency mode active: Document will be sent immediately to Principal, Registrar, and relevant department heads
              </AlertDescription>
            </Alert>

            <DocumentUploader
              userRole={userRole}
              onSubmit={handleEmergencySubmit}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Emergency Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-elegant border-l-4 border-l-destructive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Emergencies</p>
                <p className="text-2xl font-bold text-destructive">
                  {emergencyHistory.filter((e: any) => e.status === 'active').length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant border-l-4 border-l-warning">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Time</p>
                <p className="text-2xl font-bold text-warning">
                  <Clock className="w-5 h-5 inline mr-1" />
                  {"0 min"}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Zap className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant border-l-4 border-l-success">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved This Month</p>
                <p className="text-2xl font-bold text-success">
                  {emergencyHistory.filter((e: any) => e.status === 'resolved').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Shield className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Contacts */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Emergency Contacts
          </CardTitle>
          <CardDescription>
            Key personnel available for immediate emergency response
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {emergencyContacts.map((contact, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors animate-scale-in"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${contact.available ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                  <div>
                    <h4 className="font-medium">{contact.name}</h4>
                    <p className="text-sm text-muted-foreground">{contact.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{contact.phone}</p>
                  <Badge variant={contact.available ? "success" : "secondary"} className="text-xs">
                    {contact.available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Types */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Emergency Categories</CardTitle>
          <CardDescription>Different types of emergency situations and their protocols</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {emergencyTypes.map((emergency, index) => (
              <Card key={index} className="border hover:shadow-md transition-all cursor-pointer group animate-scale-in">
                <CardContent className="p-4 text-center">
                  <emergency.icon className={`w-8 h-8 mx-auto mb-2 ${emergency.color} group-hover:scale-110 transition-transform`} />
                  <h4 className="font-medium text-sm">{emergency.type}</h4>
                  <p className="text-xs text-muted-foreground mt-1">Emergency</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>



      {/* Emergency Protocols */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Emergency Response Protocols</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Document Submission
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Bypasses normal approval workflow</li>
                <li>• Immediate notification to all authorities</li>
                <li>• Real-time status tracking</li>
                <li>• Automatic escalation if no response</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Notification System
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• SMS alerts to emergency contacts</li>
                <li>• Email notifications with high priority</li>
                <li>• Dashboard emergency banners</li>
                <li>• Mobile push notifications</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}