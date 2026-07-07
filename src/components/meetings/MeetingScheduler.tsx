import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LiveMeetingRequestModal } from "./LiveMeetingRequestModal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { meetingAPI } from "@/services/MeetingAPIService";
import { recipientService } from "@/services/RecipientService";
import { useCalendar } from "@/hooks/useCalendar";
import { filterMeetingsByRecipient } from "@/utils/meetingFilters";
import {
  Meeting,
  MeetingAttendee,
  MeetingType,
  MeetingPlatform,
  MeetingStatus,
  MeetingPriority,
  MeetingCategory,
  ConflictCheck,
  AISchedulingSuggestion,
  CreateMeetingResponse,
  ApprovalWorkflow,
  RecurringPattern,
  NotificationSettings
} from "@/types/meeting";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Plus,
  Video,
  MapPin,
  Bell,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  ExternalLink,
  Zap,
  Brain,
  AlertTriangle,
  Shield,
  FileText,
  Download,
  Upload,
  Repeat,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
  Wifi,
  Calendar,
  Settings,
  Star,
  BarChart3,
  TrendingUp,
  Filter,
  Search,
  Copy,
  Share,
  Archive,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  ScreenShare,
  UserPlus,
  UserMinus,
  Timer,
  Target,
  Lightbulb,
  BookOpen,
  Award,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  Send,
  Eye,
  EyeOff,
  Heart,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { FaSms, FaWhatsapp } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MeetingSchedulerProps {
  userRole: string;
  className?: string;
}

export function MeetingScheduler({ userRole, className }: MeetingSchedulerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    allMeetings,
    meetings: filteredMeetings,
    loading: calendarLoading,
    isConnected,
    refreshData: refreshMeetings,
  } = useCalendar();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictCheck | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISchedulingSuggestion | null>(null);
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showAISuggestionsDialog, setShowAISuggestionsDialog] = useState(false);
  const [showLiveMeetingModal, setShowLiveMeetingModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'live-requests'>('calendar');
  const [filterBy, setFilterBy] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [showEditMeeting, setShowEditMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  // Use meetings from useCalendar hook (already filtered by recipient)
  const meetings = filteredMeetings;

  // New Meeting Form State
  const [newMeeting, setNewMeeting] = useState<Partial<Meeting>>({
    title: "",
    description: "",
    date: "",
    time: "",
    duration: 60,
    attendees: [],
    location: "",
    type: "online",
    status: "scheduled",
    priority: "medium",
    category: "academic",
    isRecurring: false,
    tags: [],
    department: user?.department || "",
    notifications: {
      email: true,
      push: true,
      sms: false,
      whatsapp: false,
      reminders: [
        { type: 'email', timing: 1440, enabled: true }, // 24h
        { type: 'push', timing: 60, enabled: true }, // 1h
        { type: 'email', timing: 10, enabled: true } // 10m
      ],
      escalation: {
        enabled: false,
        escalateAfterHours: 24,
        escalateTo: [],
        autoApprove: false
      }
    },
    meetingLinks: {
      primary: 'iaoms-meet'
    }
  });

  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>({
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: [],
    endDate: undefined,
    occurrences: undefined,
    exceptions: []
  });

  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalWorkflow>({
    isRequired: false,
    approvers: [],
    currentStep: 0,
    status: 'pending',
    requestedAt: new Date(),
    comments: []
  });

  // Meeting Statistics calculations
  const meetingStats = useMemo(() => {
    const total = meetings.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const online = meetings.filter(m => (m.type === 'online' || m.type === 'hybrid') && m.date === todayStr).length;

    // Average duration
    const totalDuration = meetings.reduce((acc, m) => acc + (m.duration || 0), 0);
    const avg = total > 0 ? Math.round(totalDuration / total) : 0;

    // Calculate This Week
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - today.getDay()));

    const countThisWeek = meetings.filter(m => {
      const d = new Date(m.date);
      return d >= startOfWeek && d <= endOfWeek;
    }).length;

    return {
      total: total.toString(),
      thisWeek: countThisWeek.toString(),
      online: online.toString(),
      avgDuration: `${avg}m`
    };
  }, [meetings]);

  // Meetings are now loaded via useCalendar hook (real-time Supabase subscription)
  // No localStorage or manual polling needed

  // Helper functions
  const timeSlots = [
    "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45",
    "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45",
    "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45",
    "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45",
    "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30", "17:45",
    "18:00", "18:15", "18:30", "18:45", "19:00", "19:15", "19:30", "19:45",
    "20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30", "21:45",
    "22:00", "22:15", "22:30", "22:45", "23:00", "23:15", "23:30"
  ];

  const [availableAttendees, setAvailableAttendees] = useState<MeetingAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // Load available attendees from recipients list
  useEffect(() => {
    const loadAttendees = async () => {
      setLoadingAttendees(true);
      try {
        const recipients = await recipientService.fetchRecipients();
        setAvailableAttendees(recipients.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          department: r.department || '',
          status: 'invited' as const,
          isRequired: true,
          canEdit: false,
          supabase_uid: r.supabase_uid
        } as any)));
      } catch (error) {
        console.error('Failed to load attendees:', error);
      } finally {
        setLoadingAttendees(false);
      }
    };
    loadAttendees();
  }, []);


  const meetingPlatforms: { value: MeetingPlatform; label: string; icon: React.ReactNode }[] = [
    { value: "iaoms-meet", label: "IAOMS MEET", icon: <Video className="w-4 h-4 text-primary" /> }
  ];

  const getStatusBadge = (status: MeetingStatus) => {
    const variants = {
      scheduled: { variant: "secondary" as const, text: "Scheduled", icon: <Clock className="w-3 h-3" /> },
      confirmed: { variant: "default" as const, text: "Confirmed", icon: <CheckCircle className="w-3 h-3" /> },
      "in-progress": { variant: "default" as const, text: "In Progress", icon: <Zap className="w-3 h-3" /> },
      completed: { variant: "default" as const, text: "Completed", icon: <CheckCircle className="w-3 h-3" /> },
      cancelled: { variant: "destructive" as const, text: "Cancelled", icon: <XCircle className="w-3 h-3" /> },
      postponed: { variant: "secondary" as const, text: "Postponed", icon: <Calendar className="w-3 h-3" /> }
    };
    return variants[status] || { variant: "default" as const, text: status, icon: <Clock className="w-3 h-3" /> };
  };

  const getPriorityBadge = (priority: MeetingPriority, meetingTitle?: string) => {
    const variants = {
      low: { variant: "default" as const, text: "Low Priority", className: "bg-green-500 text-white font-semibold" },
      medium: { variant: "default" as const, text: "Medium Priority", className: "bg-green-500 text-white font-semibold" },
      high: { variant: "default" as const, text: meetingTitle === "Faculty Recruitment Board Meeting" ? "Urgent Priority" : "High Priority", className: "bg-green-500 text-white font-semibold" },
      urgent: { variant: "default" as const, text: "Urgent Priority", className: "bg-green-500 text-white font-semibold" }
    };
    return variants[priority] || { variant: "default" as const, text: priority, className: "bg-green-500 text-white font-semibold" };
  };

  const getTypeIcon = (type: MeetingType) => {
    switch (type) {
      case "online": return <Video className="w-4 h-4" />;
      case "physical": return <MapPin className="w-4 h-4" />;
      case "hybrid": return <Globe className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Event handlers
  const resetNewMeetingForm = useCallback(() => {
    setNewMeeting({
      title: "",
      description: "",
      date: "",
      time: "",
      duration: 60,
      attendees: [],
      location: "",
      type: "online",
      status: "scheduled",
      priority: "medium",
      category: "academic",
      isRecurring: false,
      tags: [],
      department: user?.department || "",
      notifications: {
        email: true,
        push: true,
        sms: false,
        whatsapp: false,
        reminders: [
          { type: 'email', timing: 1440, enabled: true },
          { type: 'push', timing: 60, enabled: true },
          { type: 'email', timing: 10, enabled: true }
        ],
        escalation: {
          enabled: false,
          escalateAfterHours: 24,
          escalateTo: [],
          autoApprove: false
        }
      }
    });
    setRecurringPattern({
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [],
      endDate: undefined,
      occurrences: undefined,
      exceptions: []
    });
  }, [user]);

  const handleCreateMeeting = useCallback(async () => {
    if (!newMeeting.title || !newMeeting.date || !newMeeting.time) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Check for conflicts first
      const conflictCheck = await meetingAPI.checkConflicts(newMeeting);

      if (conflictCheck.hasConflict && conflictCheck.conflicts.length > 0) {
        setConflicts(conflictCheck);
        setShowConflictDialog(true);
        return;
      }

      // Build meeting payload — backend handles ID generation, DB save, and platform link creation
      const meetingData: Partial<Meeting> = {
        title: newMeeting.title || "",
        description: newMeeting.description || "",
        date: newMeeting.date || "",
        time: newMeeting.time || "",
        duration: newMeeting.duration || 60,
        attendees: (newMeeting.attendees || []) as MeetingAttendee[],
        location: newMeeting.location || "",
        type: newMeeting.type || "online",
        status: newMeeting.status || "scheduled",
        priority: newMeeting.priority || "medium",
        category: newMeeting.category || "academic",
        isRecurring: !!newMeeting.isRecurring,
        tags: newMeeting.tags || [],
        department: newMeeting.department || user?.department || "",
        createdBy: user?.id || 'unknown',
        approvalWorkflow: approvalWorkflow.isRequired ? approvalWorkflow : undefined,
        recurringPattern: newMeeting.isRecurring ? recurringPattern : undefined,
        documents: [],
        meetingLinks: newMeeting.meetingLinks,
      };

      const response: CreateMeetingResponse = await meetingAPI.createMeeting(meetingData);

      console.log('[MeetingScheduler] New meeting created:', response.meeting?.id);

      // Refresh in background — don't block the UI
      refreshMeetings().catch(() => { });

      setShowNewMeetingDialog(false);
      resetNewMeetingForm();

      toast({
        title: "Meeting Created",
        description: `${response.meeting.title} has been scheduled successfully`,
        variant: "default"
      });

      // Every meeting is now 'iaoms-meet' since 'physical' has been removed
      if (response.meetingLinks) {
        const platform = response.meetingLinks.primary;
        const link = (response.meetingLinks as any).iaomsMeet; // Access the specific info
        if (link && link.joinUrl) {
          toast({
            title: "Meeting Link Generated",
            description: `IAOMS MEET link ready — attendees will receive it automatically`,
            variant: "default"
          });
        }
      }

    } catch (error: any) {
      console.error('Meeting creation failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [newMeeting, user, approvalWorkflow, recurringPattern, toast, resetNewMeetingForm, refreshMeetings]);

  const handleGetAISuggestions = useCallback(async () => {
    if (!newMeeting.title || !newMeeting.attendees?.length) {
      toast({
        title: "Information Missing",
        description: "Please provide a title and at least one attendee for AI suggestions",
        variant: "default"
      });
      return;
    }

    setLoading(true);
    try {
      const suggestions = await meetingAPI.getAISchedulingSuggestions(newMeeting);
      setAiSuggestions(suggestions);
      setShowAISuggestionsDialog(true);
    } catch (error) {
      toast({
        title: "AI Help Unavailable",
        description: "Could not generate scheduling suggestions at this time",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [newMeeting, toast]);


  const addAttendee = useCallback((attendeeData: Partial<MeetingAttendee>) => {
    const attendee: MeetingAttendee = {
      id: attendeeData.id || '', // Provide default empty string for id
      name: attendeeData.name || '', // Provide default empty string for name
      email: attendeeData.email || '', // Provide default empty string for email
      role: attendeeData.role || '', // Provide default empty string for role
      department: attendeeData.department || '', // Provide default empty string for department
      status: "invited",
      isRequired: true,
      canEdit: false
    };

    setNewMeeting(prev => ({
      ...prev,
      attendees: [...(prev.attendees || []), attendee]
    }));
  }, []);

  const removeAttendee = useCallback((attendeeId: string) => {
    setNewMeeting(prev => ({
      ...prev,
      attendees: prev.attendees?.filter(a => a.id !== attendeeId)
    }));
  }, []);

  const handleJoinMeeting = async (meeting: Meeting) => {
    try {
      toast({
        title: "Joining Meeting",
        description: "Requesting secure join link...",
        variant: "default"
      });

      const { joinUrl, platform, isHost } = await meetingAPI.joinMeeting(meeting.id);

      if (joinUrl) {
        // Open in a centered popup window for meeting experience
        const width = 1200;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        window.open(
          joinUrl,
          `meeting-${meeting.id}`,
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        toast({
          title: isHost ? "Starting Meeting" : "Joining Meeting",
          description: `Opening ${platform}...`,
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error('Join meeting failed:', error);
      toast({
        title: "Cannot Join Meeting",
        description: error.message || "Failed to get meeting link. Please contact the organizer.",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingDetails(true);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setNewMeeting({
      title: meeting.title,
      description: meeting.description,
      date: meeting.date,
      time: meeting.time,
      duration: meeting.duration,
      attendees: meeting.attendees,
      location: meeting.location,
      type: meeting.type,
      status: meeting.status,
      priority: meeting.priority,
      category: meeting.category,
      isRecurring: meeting.isRecurring,
      tags: meeting.tags,
      department: meeting.department,
      notifications: meeting.notifications
    });
    setShowEditMeeting(true);
  };

  const handleDuplicateMeeting = async (meeting: Meeting) => {
    try {
      const { id, createdAt, updatedAt, meetingLinks, ...rest } = meeting;
      await meetingAPI.createMeeting({
        ...rest,
        title: `${meeting.title} (Copy)`,
        status: 'scheduled',
      });
      await refreshMeetings();
      toast({
        title: "Meeting Duplicated",
        description: `${meeting.title} has been duplicated`,
        variant: "default"
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to duplicate meeting", variant: "destructive" });
    }
  };

  const handleCancelMeeting = async (meeting: Meeting) => {
    try {
      await meetingAPI.cancelMeeting(meeting.id);
      await refreshMeetings();
    } catch { /* ignore */ }
    toast({
      title: "Meeting Cancelled",
      description: `${meeting.title} has been cancelled`,
      variant: "destructive"
    });
  };

  const handleSaveEditMeeting = async () => {
    if (editingMeeting && newMeeting.title && newMeeting.date && newMeeting.time) {
      try {
        await meetingAPI.updateMeeting(editingMeeting.id, newMeeting);
        await refreshMeetings();
        setShowEditMeeting(false);
        setEditingMeeting(null);
        resetNewMeetingForm();
        toast({
          title: "Meeting Updated",
          description: `${newMeeting.title} has been updated successfully`,
          variant: "default"
        });
      } catch (error) {
        toast({ title: "Error", description: "Failed to update meeting", variant: "destructive" });
      }
    }
  };

  const handleRemindMeeting = (meeting: Meeting) => {
    toast({
      title: "Reminder Sent",
      description: `Reminder sent to all attendees for "${meeting.title}"`,
      variant: "default"
    });
  };

  const handleApproveMeeting = async (meeting: Meeting, status: 'accepted' | 'declined') => {
    if (!user) return;
    try {
      const updatedAttendees = meeting.attendees.map(a =>
        (a.email === user.email || a.id === user.id) ? { ...a, status } : a
      );

      let newMeetingStatus = meeting.status;
      if (meeting.approvalWorkflow?.isRequired && status === 'accepted') {
        const allAccepted = updatedAttendees.every(a => a.status === 'accepted');
        if (allAccepted) {
          newMeetingStatus = 'confirmed';
        }
      }

      await meetingAPI.updateMeeting(meeting.id, {
        ...meeting,
        attendees: updatedAttendees,
        status: newMeetingStatus
      });
      await refreshMeetings();
      toast({
        title: "Status Updated",
        description: `You have ${status} the meeting.`,
        variant: "default"
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update your status.", variant: "destructive" });
    }
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      const dayMeetings = meetings.filter(m => m.date === dateStr);

      days.push({
        date: i,
        fullDate: dateStr,
        meetings: dayMeetings,
        isToday: i === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
        isSelected: dateStr === selectedDate.toISOString().split('T')[0]
      });
    }

    return days;
  };

  return (
    <TooltipProvider>
      <div className={`space-y-6 animate-fade-in ${className}`}>
        {/* Header with Stats */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 text-sm justify-between sm:justify-start">
              <Badge variant="outline" className="gap-1 flex-1 sm:flex-none justify-center">
                <Calendar className="w-3 h-3" />
                {meetings.length} Meetings
              </Badge>
              <Badge variant="outline" className="gap-1 flex-1 sm:flex-none justify-center">
                <Clock className="w-3 h-3" />
                {meetings.filter(m => m.status === 'scheduled').length} Scheduled
              </Badge>
            </div>

            <Button variant="gradient" onClick={() => setShowNewMeetingDialog(true)} className="animate-scale-in w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(value: 'calendar' | 'list' | 'live-requests') => setViewMode(value)} className="w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <TabsList className="grid w-full h-auto sm:h-10 sm:w-fit grid-cols-2">
              <TabsTrigger value="calendar" className="gap-1.5 sm:gap-2 text-xs sm:text-sm py-2 sm:py-1.5">
                <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 sm:gap-2 text-xs sm:text-sm py-2 sm:py-1.5">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                List View
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={filterBy} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setFilterBy(value)}>
                <SelectTrigger className="w-full sm:w-32 text-base sm:text-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={refreshMeetings}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Calendar View */}
          <TabsContent value="calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid */}
              <Card className="lg:col-span-2 shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    >
                      <ChevronDown className="w-4 h-4 rotate-90 text-primary" />
                    </Button>
                    <div className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    >
                      <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="flex items-center justify-center text-xs sm:text-sm font-medium text-muted-foreground p-1 sm:p-2 min-h-[1.5rem] sm:min-h-[2rem]">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {generateCalendarDays().map((day) => (
                      <div
                        key={day.date}
                        className={`p-1 sm:p-2 rounded-lg cursor-pointer transition-all hover:bg-accent flex flex-col items-center justify-start min-h-[3rem] sm:min-h-[3rem] ${day.isToday ? 'bg-primary text-primary-foreground' :
                          day.isSelected ? 'bg-accent' : ''
                          }`}
                        onClick={() => setSelectedDate(new Date(day.fullDate))}
                      >
                        <div className="text-sm font-medium text-center">{day.date}</div>
                        {day.meetings.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-1 justify-center w-full">
                            {day.meetings.slice(0, 2).map((meeting, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${meeting.status === 'confirmed' ? 'bg-green-500' :
                                    meeting.status === 'scheduled' ? 'bg-blue-500' :
                                      'bg-yellow-500'
                                    }`} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{meeting.title}</p>
                                  <p className="text-xs">{formatTime(meeting.time)}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {day.meetings.length > 2 && (
                              <span className="text-[10px] sm:text-xs">+{day.meetings.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Meetings Sidebar */}
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Upcoming Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {meetings
                        .filter(m => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const mDate = new Date(m.date);
                          mDate.setHours(0, 0, 0, 0);
                          return mDate >= today;
                        })
                        .slice(0, 5).map((meeting) => (
                        <div key={meeting.id} className="p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer" onClick={() => setSelectedMeeting(meeting)}>
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm line-clamp-2">{meeting.title}</h4>
                            <Badge variant={getStatusBadge(meeting.status).variant} className="text-xs shrink-0 ml-2">
                              {getStatusBadge(meeting.status).icon}
                              {getStatusBadge(meeting.status).text}
                            </Badge>
                          </div>
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
                            {meeting.createdBy === user?.id ? (
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {meeting.attendees.length} attendees
                              </div>
                            ) : (
                              meeting.attendees.filter(a => a.email === user?.email || a.id === user?.id).map((attendee, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm mt-1 w-fit">
                                  <Avatar className="w-5 h-5">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${attendee.name}`} />
                                    <AvatarFallback className="text-xs">
                                      {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{attendee.name}</span>
                                  {meeting.approvalWorkflow?.isRequired && attendee.status === 'invited' ? (
                                    <div className="flex items-center gap-1 ml-2">
                                      <Button size="sm" variant="default" className="h-5 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); handleApproveMeeting(meeting, 'accepted'); }}>Accept</Button>
                                      <Button size="sm" variant="destructive" className="h-5 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); handleApproveMeeting(meeting, 'declined'); }}>Decline</Button>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      {attendee.status ? attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1) : ''}
                                    </Badge>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {(meeting.type === 'online' || meeting.type === 'hybrid') && meeting.meetingLinks && (!meeting.approvalWorkflow?.isRequired || meeting.status === 'confirmed') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinMeeting(meeting);
                              }}
                            >
                              <Video className="w-3 h-3 mr-1" />
                              Join Meeting
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="space-y-4">
            {/* Meeting Statistics */}
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>Meeting Statistics</CardTitle>
                <CardDescription>Overview of your scheduled meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <Card>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Total Meetings</p>
                          <p className="text-lg sm:text-2xl font-bold">{meetingStats.total}</p>
                        </div>
                        <CalendarIcon className="w-5 h-5 sm:w-8 sm:h-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">This Week</p>
                          <p className="text-lg sm:text-2xl font-bold">{meetingStats.thisWeek}</p>
                        </div>
                        <TrendingUp className="w-5 h-5 sm:w-8 sm:h-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Today Online Meetings</p>
                          <p className="text-lg sm:text-2xl font-bold">{meetingStats.online}</p>
                        </div>
                        <Video className="w-5 h-5 sm:w-8 sm:h-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>


                </div>
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>All Meetings</CardTitle>
                <CardDescription>Manage and track all scheduled meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="border rounded-lg p-3 sm:p-4 space-y-3 hover:shadow-md transition-all">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 w-full">
                          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{meeting.title}</h3>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={getPriorityBadge(meeting.priority, meeting.title).variant} className={`text-xs ${getPriorityBadge(meeting.priority, meeting.title).className || ''}`}>
                                  {getPriorityBadge(meeting.priority, meeting.title).text}
                                </Badge>
                                {meeting.isRecurring && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Repeat className="w-3 h-3" />
                                    Recurring
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Mobile-only status and menu */}
                            <div className="flex sm:hidden items-center gap-2">
                              <Badge variant={getStatusBadge(meeting.status).variant} className="gap-1">
                                {getStatusBadge(meeting.status).icon}
                                {getStatusBadge(meeting.status).text}
                              </Badge>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditMeeting(meeting)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Meeting
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicateMeeting(meeting)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600" onClick={() => handleCancelMeeting(meeting)}>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Cancel Meeting
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>


                          {/* Comments */}
                          {meeting.description && (
                            <div className="mt-3">
                              <div className="flex items-center gap-1 mb-2">
                                <MessageSquare className="h-4 w-4" />
                                <span className="text-sm font-medium">Description & Agenda</span>
                              </div>
                              <div className="bg-muted p-3 rounded text-sm">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium">{meeting.attendees.find(a => a.id === meeting.createdBy || (a as any).supabase_uid === meeting.createdBy)?.name || availableAttendees.find(a => (a as any).supabase_uid === meeting.createdBy || a.id === meeting.createdBy)?.name || (meeting.createdBy === user?.id ? user?.name : '') || "System"}</span>
                                </div>
                                <p>{meeting.description}</p>
                              </div>
                            </div>
                            )}

                          {/* Category */}
                          {meeting.category && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                Category – {meeting.category.charAt(0).toUpperCase() + meeting.category.slice(1)}
                              </Badge>
                            </div>
                          )}

                          {/* Tags */}
                          {meeting.tags && meeting.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {meeting.tags.map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end">
                          <Badge variant={getStatusBadge(meeting.status).variant} className="gap-1">
                            {getStatusBadge(meeting.status).icon}
                            {getStatusBadge(meeting.status).text}
                          </Badge>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditMeeting(meeting)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Meeting
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateMeeting(meeting)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleCancelMeeting(meeting)}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Meeting
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          <span>{meeting.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{formatTime(meeting.time)} ({meeting.duration}m)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(meeting.type)}
                          <span>
                            {meeting.type === 'online' ?
                              meetingPlatforms.find(p => p.value === meeting.meetingLinks?.primary)?.label || 'Online'
                              : meeting.location}
                          </span>
                        </div>
                        {meeting.createdBy === user?.id && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span>{meeting.attendees.length} attendees</span>
                          </div>
                        )}
                      </div>

                      {/* Attendees */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Attendees</Label>
                        <div className="flex flex-wrap gap-2">
                          {meeting.createdBy === user?.id ? (
                            <>
                              {meeting.attendees.slice(0, 5).map((attendee, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm">
                                  <Avatar className="w-5 h-5">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${attendee.name}`} />
                                    <AvatarFallback className="text-xs">
                                      {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{attendee.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {attendee.status ? attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1) : ''}
                                  </Badge>
                                </div>
                              ))}
                              {meeting.attendees.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{meeting.attendees.length - 5} more
                                </Badge>
                              )}
                            </>
                          ) : (
                            meeting.attendees.filter(a => a.email === user?.email || a.id === user?.id).map((attendee, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm">
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${attendee.name}`} />
                                  <AvatarFallback className="text-xs">
                                    {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{attendee.name}</span>
                                {meeting.approvalWorkflow?.isRequired && attendee.status === 'invited' ? (
                                  <div className="flex items-center gap-2 ml-2">
                                    <Button size="sm" variant="default" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleApproveMeeting(meeting, 'accepted'); }}>Accept</Button>
                                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleApproveMeeting(meeting, 'declined'); }}>Decline</Button>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    {attendee.status ? attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1) : ''}
                                  </Badge>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-2">
                          {(meeting.type === 'online' || meeting.type === 'hybrid') && meeting.meetingLinks && (!meeting.approvalWorkflow?.isRequired || meeting.status === 'confirmed') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleJoinMeeting(meeting)}
                            >
                              <Video className="w-4 h-4 mr-2" />
                              Join Meeting
                            </Button>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleRemindMeeting(meeting)}>
                            <Bell className="w-4 h-4 mr-1" />
                            Remind
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>

        {/* New Meeting Dialog */}
        <Dialog open={showNewMeetingDialog} onOpenChange={setShowNewMeetingDialog}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Schedule New Meeting
              </DialogTitle>
              <DialogDescription>
                Create a new meeting with advanced scheduling options and integrations
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="attendees">Attendees</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="approval">Approval</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Meeting Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter meeting title"
                      value={newMeeting.title}
                      onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                      className="text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={newMeeting.category} onValueChange={(value: MeetingCategory) => setNewMeeting({ ...newMeeting, category: value })}>
                      <SelectTrigger className="text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="administrative">Administrative</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="recruitment">Recruitment</SelectItem>
                        <SelectItem value="disciplinary">Disciplinary</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newMeeting.date}
                      onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                      className="text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Select value={newMeeting.time} onValueChange={(value) => setNewMeeting({ ...newMeeting, time: value })}>
                      <SelectTrigger className="text-base sm:text-sm">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>{formatTime(time)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={newMeeting.duration?.toString()} onValueChange={(value) => setNewMeeting({ ...newMeeting, duration: parseInt(value) })}>
                      <SelectTrigger className="text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newMeeting.priority} onValueChange={(value: MeetingPriority) => setNewMeeting({ ...newMeeting, priority: value })}>
                      <SelectTrigger className="text-base sm:text-sm">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Meeting Type</Label>
                    <Select
                      value={newMeeting.meetingLinks?.primary || 'iaoms-meet'}
                      onValueChange={(value: MeetingPlatform) => setNewMeeting(prev => ({
                        ...prev,
                        type: 'online',
                        meetingLinks: { ...prev.meetingLinks, primary: value },
                      }))}
                    >
                      <SelectTrigger className="text-base sm:text-sm">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iaoms-meet">
                          <span className="flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> IAOMS MEET</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description & Agenda</Label>
                  <Textarea
                    id="description"
                    placeholder="Meeting agenda, objectives, and important notes..."
                    value={newMeeting.description}
                    onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                    rows={4}
                    className="text-base sm:text-sm"
                  />
                </div>
              </TabsContent>

              {/* Attendees Tab */}
              <TabsContent value="attendees" className="space-y-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Select Attendees</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Available Staff ({availableAttendees.length})</Label>
                    <ScrollArea className="h-48 sm:h-64 border rounded-md p-2">
                      {loadingAttendees && (
                        <div className="flex items-center justify-center py-8">
                          {/* Loading indicator removed as requested */}
                        </div>
                      )}
                      {!loadingAttendees && availableAttendees.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          No staff found. Check network connection.
                        </div>
                      )}
                      {availableAttendees.map((person) => (
                        <div key={person.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${person.name}`} />
                              <AvatarFallback className="text-xs">
                                {person.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{person.name}</p>
                              <p className="text-xs text-muted-foreground">{person.role}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addAttendee(person)}
                            disabled={newMeeting.attendees?.some(a => a.id === person.id)}
                          >
                            <UserPlus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Selected Attendees ({newMeeting.attendees?.length || 0})</Label>
                    <ScrollArea className="h-48 sm:h-64 border rounded-md p-2">
                      {newMeeting.attendees?.map((attendee) => (
                        <div key={attendee.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${attendee.name}`} />
                              <AvatarFallback className="text-xs">
                                {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{attendee.name}</p>
                              <p className="text-xs text-muted-foreground">{attendee.role}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeAttendee(attendee.id)}
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Meeting Settings</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">Email Notifications</Label>
                          <p className="text-xs text-muted-foreground">Receive updates via email</p>
                        </div>
                      </div>
                      <Switch
                        checked={newMeeting.notifications?.email}
                        onCheckedChange={(checked) => setNewMeeting({
                          ...newMeeting,
                          notifications: { ...newMeeting.notifications!, email: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">Push Notifications</Label>
                          <p className="text-xs text-muted-foreground">Browser and mobile notifications</p>
                        </div>
                      </div>
                      <Switch
                        checked={newMeeting.notifications?.push}
                        onCheckedChange={(checked) => setNewMeeting({
                          ...newMeeting,
                          notifications: { ...newMeeting.notifications!, push: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 opacity-50">
                      <div className="flex items-center gap-3">
                        <FaSms className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label className="text-sm font-medium">SMS Alerts</Label>
                          <p className="text-xs text-muted-foreground">Critical updates via SMS</p>
                        </div>
                      </div>
                      <Switch
                        checked={newMeeting.notifications?.sms}
                        onCheckedChange={(checked) => setNewMeeting({
                          ...newMeeting,
                          notifications: { ...newMeeting.notifications!, sms: checked }
                        })}
                        disabled
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 opacity-50">
                      <div className="flex items-center gap-3">
                        <FaWhatsapp className="w-5 h-5 text-green-600" />
                        <div>
                          <Label className="text-sm font-medium">WhatsApp Notifications</Label>
                          <p className="text-xs text-muted-foreground">Receive updates via WhatsApp</p>
                        </div>
                      </div>
                      <Switch
                        checked={newMeeting.notifications?.whatsapp}
                        onCheckedChange={(checked) => setNewMeeting({
                          ...newMeeting,
                          notifications: { ...newMeeting.notifications!, whatsapp: checked }
                        })}
                        disabled
                      />
                    </div>
                  </div>


                </div>
              </TabsContent>

              {/* Approval Tab */}
              <TabsContent value="approval" className="space-y-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Approval Workflow</h3>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Require Approval</Label>
                    <p className="text-xs text-muted-foreground">Meeting needs approval before sending invites</p>
                  </div>
                  <Switch
                    checked={approvalWorkflow.isRequired}
                    onCheckedChange={(checked) => setApprovalWorkflow({
                      ...approvalWorkflow,
                      isRequired: checked
                    })}
                  />
                </div>

                {approvalWorkflow.isRequired && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Approval Required</AlertTitle>
                    <AlertDescription>
                      This meeting will be sent to the appropriate authorities for approval before invites are sent.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowNewMeetingDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateMeeting} disabled={loading} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Schedule Meeting
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Conflict Resolution Dialog */}
        <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Scheduling Conflicts Detected
              </DialogTitle>
              <DialogDescription>
                The selected time conflicts with existing meetings. Review conflicts and suggestions below.
              </DialogDescription>
            </DialogHeader>

            {conflicts && (
              <div className="space-y-4">
                {conflicts.conflicts.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Conflicts:</h4>
                    <div className="space-y-2">
                      {conflicts.conflicts.map((conflict, index) => (
                        <div key={index} className="p-2 border rounded-md bg-red-50">
                          <p className="text-sm font-medium">{conflict.attendeeName}</p>
                          <p className="text-xs text-muted-foreground">
                            Has meeting "{conflict.meetingTitle}" at the same time
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {conflicts.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Suggested Alternative Times:</h4>
                    <div className="space-y-2">
                      {conflicts.suggestions.slice(0, 3).map((suggestion, index) => (
                        <div key={index} className="p-2 border rounded-md bg-green-50 cursor-pointer hover:bg-green-100"
                          onClick={() => {
                            setNewMeeting({ ...newMeeting, date: suggestion.date, time: suggestion.time });
                            setShowConflictDialog(false);
                          }}>
                          <p className="text-sm font-medium">
                            {suggestion.date} at {formatTime(suggestion.time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Availability Score: {Math.round(suggestion.availabilityScore * 100)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConflictDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowConflictDialog(false);
                handleCreateMeeting();
              }}>
                Schedule Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Suggestions Dialog */}
        <Dialog open={showAISuggestionsDialog} onOpenChange={setShowAISuggestionsDialog}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-500" />
                AI Scheduling Suggestions
              </DialogTitle>
              <DialogDescription>
                Smart recommendations based on attendee availability and preferences
              </DialogDescription>
            </DialogHeader>

            {aiSuggestions && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiSuggestions.recommendedSlots.slice(0, 4).map((slot, index) => (
                    <div key={index} className="p-3 border rounded-lg cursor-pointer hover:bg-accent"
                      onClick={() => {
                        setNewMeeting({ ...newMeeting, date: slot.date, time: slot.time, duration: slot.duration });
                        setShowAISuggestionsDialog(false);
                      }}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{slot.date}</h4>
                        <Badge variant="outline">{Math.round(slot.availabilityScore * 100)}% available</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(slot.time)} • {slot.duration} minutes
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {slot.conflictCount} conflicts
                      </p>
                    </div>
                  ))}
                </div>

                {aiSuggestions.conflictAnalysis && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium mb-2">Conflict Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Best time range: {aiSuggestions.conflictAnalysis.bestTimeRange.start} - {aiSuggestions.conflictAnalysis.bestTimeRange.end}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reason: {aiSuggestions.conflictAnalysis.bestTimeRange.reason}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAISuggestionsDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Meeting Details Dialog */}
        <Dialog open={showMeetingDetails} onOpenChange={setShowMeetingDetails}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Meeting Details</DialogTitle>
            </DialogHeader>
            {selectedMeeting && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-medium">Title</Label>
                    <p className="break-words">{selectedMeeting.title}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Status</Label>
                    <div className="mt-1">
                      <Badge variant={getStatusBadge(selectedMeeting.status).variant}>
                        {getStatusBadge(selectedMeeting.status).text}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="font-medium">Date & Time</Label>
                    <p>{selectedMeeting.date} at {formatTime(selectedMeeting.time)}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Duration</Label>
                    <p>{selectedMeeting.duration} minutes</p>
                  </div>
                  <div>
                    <Label className="font-medium">Type</Label>
                    <p>{selectedMeeting.type}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Priority</Label>
                    <div className="mt-1">
                      <Badge variant={getPriorityBadge(selectedMeeting.priority, selectedMeeting.title).variant}>
                        {getPriorityBadge(selectedMeeting.priority, selectedMeeting.title).text}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{selectedMeeting.description}</p>
                </div>
                <div>
                  <Label className="font-medium">Attendees {selectedMeeting.createdBy === user?.id ? `(${selectedMeeting.attendees.length})` : ''}</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedMeeting.createdBy === user?.id ? (
                      selectedMeeting.attendees.map((attendee, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${attendee.name}`} />
                            <AvatarFallback className="text-xs">
                              {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{attendee.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {attendee.status ? attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1) : ''}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      selectedMeeting.attendees.filter(a => a.email === user?.email || a.id === user?.id).map((attendee, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${attendee.name}`} />
                            <AvatarFallback className="text-xs">
                              {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{attendee.name}</span>
                          {selectedMeeting.approvalWorkflow?.isRequired && attendee.status === 'invited' ? (
                            <div className="flex items-center gap-2 ml-2">
                              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleApproveMeeting(selectedMeeting, 'accepted')}>Accept</Button>
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleApproveMeeting(selectedMeeting, 'declined')}>Decline</Button>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {attendee.status ? attendee.status.charAt(0).toUpperCase() + attendee.status.slice(1) : ''}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Meeting Dialog */}
        <Dialog open={showEditMeeting} onOpenChange={setShowEditMeeting}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                    className="text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newMeeting.date}
                    onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                    className="text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select value={newMeeting.time} onValueChange={(value) => setNewMeeting({ ...newMeeting, time: value })}>
                    <SelectTrigger className="text-base sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{formatTime(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={newMeeting.duration?.toString()} onValueChange={(value) => setNewMeeting({ ...newMeeting, duration: parseInt(value) })}>
                    <SelectTrigger className="text-base sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  rows={3}
                  className="text-base sm:text-sm"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowEditMeeting(false)}>Cancel</Button>
              <Button onClick={handleSaveEditMeeting}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Live Meeting Request Modal */}
        <LiveMeetingRequestModal
          isOpen={showLiveMeetingModal}
          onClose={() => setShowLiveMeetingModal(false)}
          documentId="meeting-scheduler"
          documentType="report"
          documentTitle="LiveMeet+ Request"
        />
      </div>
    </TooltipProvider>
  );
}