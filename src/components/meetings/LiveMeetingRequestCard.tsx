import React from 'react';
import {
  Clock, Users, MapPin, MessageSquare, CheckCircle, XCircle,
  AlertCircle, User, Settings, Video, Globe, ExternalLink,
  Calendar, FileText, Zap, AlertTriangle, Building, Monitor,
  AlarmClock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiveMeetingRequest, URGENCY_CONFIGS, PURPOSE_CONFIGS } from '@/types/liveMeeting';

interface LiveMeetingRequestCardProps {
  request: LiveMeetingRequest;
  currentUserRole?: string;
}

export const LiveMeetingRequestCard: React.FC<LiveMeetingRequestCardProps> = ({
  request,
  currentUserRole = 'employee'
}) => {
  const purposeConfig = (PURPOSE_CONFIGS as any)[request.purpose];
  const purposeLabel = purposeConfig?.label || request.purpose.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const getUrgencyIcon = () => {
    switch (request.urgency) {
      case 'immediate': return <Zap className="w-3 h-3" />;
      case 'urgent': return <AlertTriangle className="w-3 h-3" />;
      default: return null; // Normal does not need an extra icon in this specific design
    }
  };

  const getUrgencyColorClass = () => {
    switch (request.urgency) {
      case 'immediate': return 'text-red-600';
      case 'urgent': return 'text-orange-600';
      default: return 'text-blue-600';
    }
  };

  const getDocTypeColor = () => {
    if (request.documentType === 'letter') {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  // Expired when current time has passed the user-selected meeting end time.
  // Falls back to the urgency-window expiry when no end time was selected.
  const isExpired = request.requestedEndTime
    ? new Date() > request.requestedEndTime
    : new Date() > request.expiresAt;

  const formatDate = (date?: Date) => {
    if (!date) return 'Not specified';
    // toLocaleDateString('en-CA') yields YYYY-MM-DD in the local timezone,
    // avoiding the UTC-date-shift that toISOString().split('T')[0] produces.
    return date.toLocaleDateString('en-CA');
  };

  const formatTimeRange = (startDate?: Date, endDate?: Date) => {
    if (!startDate) return 'Not specified';
    const start = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Use the stored end time when available; fall back to start + 1 hour.
    const endMs = endDate ? endDate.getTime() : startDate.getTime() + 60 * 60 * 1000;
    const end = new Date(endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${start} — ${end}`;
  };

  return (
    <Card id={request.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6 pb-4 sm:pb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-0">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <div className="relative w-4 h-4">
                      <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full"></div>
                      <div className="absolute inset-1 w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                    {request.documentTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`flex items-center gap-1 ${getDocTypeColor()} px-2 py-1 rounded-full text-xs capitalize`}>
                      <FileText className="h-3 w-3" />
                      {request.documentType}
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                      <Calendar className="h-3 w-3" />
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <Badge variant={request.status === 'pending' ? 'outline' : 'outline'} className={request.status === 'pending' ? 'bg-yellow-100/50 text-yellow-800 border-yellow-200' : ''}>
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </Badge>
                <Badge variant="outline" className={`${getUrgencyColorClass()} font-semibold flex items-center gap-1`}>
                  {getUrgencyIcon()}
                  {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)} Priority
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium min-w-[60px]">From:</span> {request.requesterName} • {request.requesterRole.toUpperCase()}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium min-w-[60px]">Date:</span> {formatDate(request.requestedTime || request.scheduledTime)}
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium min-w-[60px]">Purpose:</span>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {purposeLabel}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium min-w-[60px]">Time:</span> {formatTimeRange(request.requestedTime || request.scheduledTime, request.requestedEndTime)}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium min-w-[60px]">Format:</span>
                  <div className="flex items-center gap-1">
                    {request.meetingFormat === 'online' ? <Monitor className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                    {request.meetingFormat === 'online' ? 'Online' : request.meetingFormat === 'in_person' ? 'In-Person' : 'Hybrid'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium min-w-[60px]">Location:</span>
                  <div className="flex items-center gap-1">
                    {request.meetingFormat === 'online' ? (
                      <>
                        <Globe className="h-4 w-4" />
                        <span className="truncate max-w-[200px]" title={request.meetingLink || 'Zoom Meeting'}>
                          {request.meetingLink || 'Meeting Link'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4" />
                        <span className="truncate max-w-[200px]" title={request.location || 'Office'}>
                          {request.location || 'Office'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {request.agenda && (
                <div className="space-y-2 mt-2 pt-2">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Description & Agenda</span>
                  </div>
                  <div className="bg-muted p-3 rounded text-sm">
                    <p>{request.agenda}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-full sm:min-w-[150px]">

            {request.status === 'accepted' && (
              <div className="flex flex-col gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800 justify-center py-1.5 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" /> Accepted
                </Badge>
                {request.meetingLink && (
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <a href={request.meetingLink} target="_blank" rel="noopener noreferrer">
                      Join Meeting
                    </a>
                  </Button>
                )}
              </div>
            )}

            {(request.status === 'rejected' || isExpired) && (
              <Badge variant="outline" className="bg-gray-100 text-gray-800 justify-center py-1.5 border-gray-200">
                {isExpired ? <><AlarmClock className="w-3 h-3 mr-1" /> Expired</> : <><XCircle className="w-3 h-3 mr-1" /> Declined</>}
              </Badge>
            )}

            {request.status === 'completed' && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 justify-center py-1.5 border-blue-200">
                <CheckCircle className="w-3 h-3 mr-1" /> Completed
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

