import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  Phone, 
  Smartphone, 
  MessageCircle,
  Clock,
  Users
} from "lucide-react";

interface NotificationBehaviorPreviewProps {
  useProfileDefaults: boolean;
  overrideForEmergency: boolean;
  notificationStrategy: 'recipient-based' | 'document-based';
  selectedRecipients: string[];
  emergencyChannels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  schedulingInterval: string;
}

export const NotificationBehaviorPreview: React.FC<NotificationBehaviorPreviewProps> = ({
  useProfileDefaults,
  overrideForEmergency,
  notificationStrategy,
  selectedRecipients,
  emergencyChannels,
  schedulingInterval
}) => {
  const getActiveChannels = () => {
    if (useProfileDefaults) {
      return ['Based on individual recipient preferences'];
    }
    
    const channels = [];
    if (emergencyChannels.email) channels.push('Email');
    if (emergencyChannels.sms) channels.push('SMS');
    if (emergencyChannels.push) channels.push('Push');
    if (emergencyChannels.whatsapp) channels.push('WhatsApp');
    
    return channels.length > 0 ? channels : ['No channels selected'];
  };

  const getBehaviorDescription = () => {
    if (useProfileDefaults) {
      return {
        title: "Profile-Based Notifications",
        description: "Each recipient will receive notifications according to their personal profile settings",
        icon: CheckCircle2,
        color: "text-blue-600 bg-blue-50 border-blue-200"
      };
    }
    
    if (overrideForEmergency) {
      return {
        title: "Emergency Override Active",
        description: `Using ${notificationStrategy} strategy with custom emergency settings`,
        icon: AlertTriangle,
        color: "text-orange-600 bg-orange-50 border-orange-200"
      };
    }
    
    return {
      title: "Default Behavior",
      description: "Standard notification delivery",
      icon: CheckCircle2,
      color: "text-gray-600 bg-gray-50 border-gray-200"
    };
  };

  const behavior = getBehaviorDescription();
  const IconComponent = behavior.icon;
  const activeChannels = getActiveChannels();

  return (
    <Card className="shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IconComponent className="w-4 h-4" />
          Notification Behavior Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Behavior */}
        <div className={`p-3 rounded-lg border ${behavior.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <IconComponent className="w-4 h-4" />
            <span className="font-medium text-sm">{behavior.title}</span>
          </div>
          <p className="text-xs">{behavior.description}</p>
        </div>

        {/* Recipients Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recipients</span>
          </div>
          <Badge variant="outline">{selectedRecipients.length} selected</Badge>
        </div>

        {/* Active Channels */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Active Channels</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {activeChannels.map((channel, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {channel}
              </Badge>
            ))}
          </div>
        </div>

        {/* Scheduling */}
        {overrideForEmergency && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Scheduling</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {schedulingInterval || 'Immediate'}
            </Badge>
          </div>
        )}

        {/* Strategy Info */}
        {overrideForEmergency && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>Strategy:</strong> {notificationStrategy === 'recipient-based' 
              ? 'Individual settings per recipient' 
              : 'Same settings for all recipients'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};