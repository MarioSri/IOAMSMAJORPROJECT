import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import { useCalendar } from '@/hooks/useCalendar';
import { Meeting } from '@/types/meeting';
import { useAuth } from '@/contexts/AuthContext';
import { meetingAPI } from '@/services/MeetingAPIService';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  MapPin,
  Video,
  Plus,
  Bell,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

interface CalendarWidgetProps {
  userRole: string;
  permissions: any;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { meetings, loading, refreshData } = useCalendar();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [approvingMeetingId, setApprovingMeetingId] = useState<string | null>(null);

  // Handle recipient approve/decline for approval-workflow meetings
  const handleApproveMeeting = useCallback(async (
    meeting: Meeting,
    decision: 'accepted' | 'declined',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!user) return;
    setApprovingMeetingId(meeting.id);
    try {
      const updatedAttendees = meeting.attendees.map(a =>
        (a.email === user.email || a.id === user.id) ? { ...a, status: decision } : a
      );

      // Auto-confirm when every attendee has accepted
      let newStatus = meeting.status;
      if (decision === 'accepted' && meeting.approvalWorkflow?.isRequired) {
        const allAccepted = updatedAttendees.every(a => a.status === 'accepted');
        if (allAccepted) newStatus = 'confirmed';
      }

      await meetingAPI.updateMeeting(meeting.id, {
        ...meeting,
        attendees: updatedAttendees,
        status: newStatus,
      });
      await refreshData();
      toast({
        title: decision === 'accepted' ? 'Meeting Accepted' : 'Meeting Declined',
        description: `You have ${decision} "${meeting.title}".`,
        variant: 'default',
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update your response.', variant: 'destructive' });
    } finally {
      setApprovingMeetingId(null);
    }
  }, [user, refreshData, toast]);

  // Meeting platforms configuration
  const meetingPlatforms = [
    { value: 'iaoms-meet', label: 'IAOMS MEET' }
  ];

  // Helper function to format time (matching MeetingScheduler.tsx)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Helper function to get meeting type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'online':
        return <Video className="w-3 h-3" />;
      case 'hybrid':
        return <Video className="w-3 h-3" />;
      case 'in-person':
        return <MapPin className="w-3 h-3" />;
      default:
        return <MapPin className="w-3 h-3" />;
    }
  };

  // Helper function to handle joining a meeting
  const handleJoinMeeting = (meeting: Meeting) => {
    if (meeting.meetingLinks?.iaomsMeet?.joinUrl) {
      window.open(meeting.meetingLinks.iaomsMeet.joinUrl, '_blank');
    } else {
      console.warn('No IAOMS MEET link available for this meeting.');
    }
  };

  const getUpcomingMeetings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate date comparison

    return meetings
      .filter(meeting => {
        const meetingDate = new Date(meeting.date);
        meetingDate.setHours(0, 0, 0, 0); // Reset to midnight

        // Include today and future dates
        return meetingDate >= today;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getTodaysMeetings = () => {
    const today = new Date().toISOString().split('T')[0];
    return meetings
      .filter(meeting => meeting.date === today)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      confirmed: {
        variant: "success" as const,
        text: "Confirmed",
        icon: <CheckCircle2 className="w-3 h-3 mr-1" />
      },
      pending: {
        variant: "warning" as const,
        text: "Pending Approval",
        icon: <Clock className="w-3 h-3 mr-1" />
      },
      cancelled: {
        variant: "destructive" as const,
        text: "Cancelled",
        icon: <XCircle className="w-3 h-3 mr-1" />
      },
      scheduled: {
        variant: "default" as const,
        text: "Scheduled",
        icon: <CalendarIcon className="w-3 h-3 mr-1" />
      }
    };
    return variants[status as keyof typeof variants] || {
      variant: "default" as const,
      text: status,
      icon: null
    };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'text-red-600 animate-pulse';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  const upcomingMeetings = getUpcomingMeetings();
  const todaysMeetings = getTodaysMeetings();
  const pendingApprovals = meetings.filter(m => m.status === 'scheduled').length;

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Calendar & Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
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
        <div className={cn(
          "flex justify-between",
          isMobile ? "flex-col gap-3" : "items-center"
        )}>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <CalendarIcon className="w-5 h-5 text-primary" />
            Calendar & Meetings
            {pendingApprovals > 0 && (
              <Badge variant="warning" className="animate-pulse">
                {pendingApprovals} pending
              </Badge>
            )}
          </CardTitle>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/calendar")}
            className={cn(isMobile && "text-xs")}
          >
            <Plus className="w-4 h-4 mr-1" />
            Schedule
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4 scroll-smooth">
          {/* Today's Meetings */}
          {todaysMeetings.length > 0 && (
          <div>
            <h4 className={cn(
              "font-semibold mb-2 flex items-center gap-2",
              isMobile ? "text-sm" : "text-base"
            )}>
              <Clock className="w-4 h-4 text-primary" />
              Today's Meetings ({todaysMeetings.length})
            </h4>
            <div className="space-y-2">
              {todaysMeetings.map((meeting) => {
                // Determine if current user is a recipient (not the creator) needing to respond
                const isCreator = meeting.createdBy === user?.id;
                const myAttendeeRecord = !isCreator
                  ? meeting.attendees.find(a => a.email === user?.email || a.id === user?.id)
                  : undefined;
                const needsMyApproval =
                  !isCreator &&
                  meeting.approvalWorkflow?.isRequired &&
                  myAttendeeRecord?.status === 'invited';

                return (
                <div
                  key={meeting.id}
                  className={cn(
                    "p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer",
                    meeting.priority === 'urgent' && "border-destructive bg-red-50"
                  )}
                  onClick={() => navigate('/calendar')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h5 className={cn(
                      "font-medium",
                      isMobile ? "text-sm" : "text-base"
                    )}>
                      {meeting.title}
                    </h5>
                    <Badge variant={getStatusBadge(meeting.status).variant} className="flex items-center text-xs">
                      {meeting.status === 'scheduled' && <CalendarIcon className="w-3 h-3 mr-1" />}
                      {getStatusBadge(meeting.status).text}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {meeting.date} at {formatTime(meeting.time)}
                    </div>
                    <div className="flex items-center gap-1">
                      {meeting.type === 'online' || meeting.type === 'hybrid' ? (
                        <Video className="w-3 h-3" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
                      {meeting.type === 'online' ?
                        meetingPlatforms.find(p => p.value === meeting.meetingLinks?.primary)?.label || 'Online'
                        : meeting.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className={cn("w-3 h-3", getPriorityColor(meeting.priority))} />
                      <span className={getPriorityColor(meeting.priority)}>
                        {meeting.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Accept / Decline row for recipients pending approval */}
                  {needsMyApproval && (
                    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 h-7 text-xs gap-1"
                        disabled={approvingMeetingId === meeting.id}
                        onClick={(e) => handleApproveMeeting(meeting, 'accepted', e)}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs gap-1"
                        disabled={approvingMeetingId === meeting.id}
                        onClick={(e) => handleApproveMeeting(meeting, 'declined', e)}
                      >
                        <ThumbsDown className="w-3 h-3" />
                        Decline
                      </Button>
                    </div>
                  )}

                  {/* Show my response status for non-pending approval meetings */}
                  {!needsMyApproval && !isCreator && myAttendeeRecord && meeting.approvalWorkflow?.isRequired && (
                    <div className="mt-2">
                      <Badge
                        variant={myAttendeeRecord.status === 'accepted' ? 'default' : myAttendeeRecord.status === 'declined' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        You: {myAttendeeRecord.status ? myAttendeeRecord.status.charAt(0).toUpperCase() + myAttendeeRecord.status.slice(1) : 'Invited'}
                      </Badge>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/calendar');
                    }}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Meetings */}
        <div>
          <h4 className={cn(
            "font-semibold mb-2 flex items-center gap-2",
            isMobile ? "text-sm" : "text-base"
          )}>
            <CalendarIcon className="w-4 h-4 text-primary" />
            Upcoming Meetings
          </h4>

          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => {
              const isCreator = meeting.createdBy === user?.id;
              const myAttendeeRecord = !isCreator
                ? meeting.attendees.find(a => a.email === user?.email || a.id === user?.id)
                : undefined;
              const needsMyApproval =
                !isCreator &&
                meeting.approvalWorkflow?.isRequired &&
                myAttendeeRecord?.status === 'invited';

              return (
              <div
                key={meeting.id}
                className="p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                onClick={() => navigate('/calendar')}
              >
                {/* Match Calendar page design exactly */}
                <div className="flex items-start justify-between mb-2">
                  <h4 className={cn(
                    "font-medium line-clamp-2",
                    isMobile ? "text-sm" : "text-sm"
                  )}>
                    {meeting.title}
                  </h4>
                  <Badge
                    variant={getStatusBadge(meeting.status).variant}
                    className="text-xs shrink-0 ml-2"
                  >
                    {getStatusBadge(meeting.status).icon}
                    {getStatusBadge(meeting.status).text}
                  </Badge>
                </div>

                {/* Vertical layout matching Calendar page */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {meeting.date} at {formatTime(meeting.time)}
                  </div>
                  <div className="flex items-center gap-1">
                    {getTypeIcon(meeting.type)}
                    {meeting.type === 'online' ?
                      meetingPlatforms.find(p => p.value === meeting.meetingLinks?.primary)?.label || 'Online'
                      : meeting.location}
                  </div>
                  {isCreator ? (
                    // Submitter: show all attendees with their approval statuses
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {meeting.attendees.length} attendees
                      </div>
                      {meeting.approvalWorkflow?.isRequired && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {meeting.attendees.map((attendee, idx) => (
                            <Badge
                              key={idx}
                              variant={
                                attendee.status === 'accepted' ? 'default' :
                                attendee.status === 'declined' ? 'destructive' : 'outline'
                              }
                              className="text-xs"
                            >
                              {attendee.name.split(' ')[0]}: {attendee.status
                                ? attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1)
                                : 'Invited'}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Recipient: show own attendee row
                    myAttendeeRecord && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm mt-1 w-fit">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${myAttendeeRecord.name}`} />
                          <AvatarFallback className="text-xs">
                            {myAttendeeRecord.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{myAttendeeRecord.name}</span>
                        {!needsMyApproval && (
                          <Badge variant="outline" className="text-xs">
                            {myAttendeeRecord.status
                              ? myAttendeeRecord.status.charAt(0).toUpperCase() + myAttendeeRecord.status.slice(1)
                              : 'Invited'}
                          </Badge>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Accept / Decline buttons for recipient with pending approval */}
                {needsMyApproval && (
                  <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 h-7 text-xs gap-1"
                      disabled={approvingMeetingId === meeting.id}
                      onClick={(e) => handleApproveMeeting(meeting, 'accepted', e)}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-7 text-xs gap-1"
                      disabled={approvingMeetingId === meeting.id}
                      onClick={(e) => handleApproveMeeting(meeting, 'declined', e)}
                    >
                      <ThumbsDown className="w-3 h-3" />
                      Decline
                    </Button>
                  </div>
                )}

                {/* View Details Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/calendar');
                  }}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Details
                </Button>
              </div>
              );
            })}

            {upcomingMeetings.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className={cn(isMobile ? "text-sm" : "text-base")}>
                  No upcoming meetings
                </p>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Quick Calendar View */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} className="text-center text-xs font-medium text-muted-foreground p-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 14 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() + i - 7);
              const dateStr = date.toISOString().split('T')[0];
              const dayMeetings = meetings.filter(m => m.date === dateStr);
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={i}
                  className={cn(
                    "p-1 text-center cursor-pointer rounded transition-colors",
                    isToday ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    dayMeetings.length > 0 && "border border-primary/50"
                  )}
                  onClick={() => setSelectedDate(date)}
                >
                  <div className={cn(
                    "text-xs font-medium",
                    isMobile && "text-xs"
                  )}>
                    {date.getDate()}
                  </div>
                  {dayMeetings.length > 0 && (
                    <div className="flex justify-center">
                      <div className={cn(
                        "w-1 h-1 rounded-full",
                        dayMeetings.some(m => m.priority === 'urgent') ? "bg-red-500" :
                          dayMeetings.some(m => m.priority === 'high') ? "bg-orange-500" : "bg-blue-500"
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget Footer */}
        <div className="flex items-center justify-center pt-4 border-t">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{meetings.length} Meetings</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarWidget;