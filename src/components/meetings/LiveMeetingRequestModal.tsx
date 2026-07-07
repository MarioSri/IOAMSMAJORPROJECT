import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Clock,
  Calendar,
  MessageSquare,
  Zap,
  AlertTriangle,
  Activity,
  Video,
  MapPin,
  ChevronDown,
  Send,
  Settings,
  UserPlus,
  FileText,
  Building,
  Globe,
  ExternalLink,
  Link
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { liveMeetingService } from '@/services/LiveMeetingService';
import { NotificationDispatchService } from '@/services/NotificationDispatchService';
import { CreateLiveMeetingRequestDto, PURPOSE_CONFIGS, URGENCY_CONFIGS } from '@/types/liveMeeting';

interface LiveMeetingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: 'letter' | 'circular' | 'report';
  documentTitle: string;
  /** Optional: role_recipients UUIDs of the document's approval chain.
   * When provided, the Select Recipients list is scoped to those assignees only.
   * Falls back to the generic role-permission list when empty/undefined. */
  assigneeIds?: string[];
}

interface Participant {
  id: string;
  name: string;
  role: string;
  email: string;
  department: string;
  avatar?: string;
}

export const LiveMeetingRequestModal: React.FC<LiveMeetingRequestModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentType,
  documentTitle,
  assigneeIds
}) => {
  const [meetingFormat, setMeetingFormat] = useState<'in_person' | 'online'>('online');
  const [urgency, setUrgency] = useState<'immediate' | 'urgent' | 'normal'>('normal');
  const [purpose, setPurpose] = useState<'clarification' | 'approval_discussion' | 'document_review' | 'urgent_decision'>('clarification');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);
  const [agenda, setAgenda] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [purposeDropdownOpen, setPurposeDropdownOpen] = useState(false);

  /** Ref to the scrollable body div — used to lock scroll position when
   *  a recipient checkbox is toggled so the browser cannot auto-scroll
   *  the container to bring the hidden input into view. */
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      // Reset scroll position to top whenever the modal opens
      requestAnimationFrame(() => {
        if (scrollBodyRef.current) {
          scrollBodyRef.current.scrollTop = 0;
        }
      });
      loadAvailableParticipants();
    }
  }, [isOpen]);

  // Reset scroll to top after participants finish loading so the async
  // re-render cannot scroll the container to a previously-focused element.
  useEffect(() => {
    if (!loadingParticipants && availableParticipants.length > 0) {
      requestAnimationFrame(() => {
        if (scrollBodyRef.current) {
          scrollBodyRef.current.scrollTop = 0;
        }
      });
    }
  }, [loadingParticipants, availableParticipants]);

  const loadAvailableParticipants = async () => {
    try {
      setLoadingParticipants(true);
      const currentUserRole = user?.role || 'employee';
      const participants = await liveMeetingService.getAvailableParticipants(currentUserRole, user?.recipientId);

      // If the modal was opened from an approval card, scope candidates to that
      // card's workflow assignees so only relevant recipients are shown.
      if (assigneeIds && assigneeIds.length > 0) {
        const scoped = participants.filter(p => assigneeIds.includes(p.id));
        // Fall back to full list only when none of the assignees appear in the
        // role-permitted participants (e.g. permissions matrix not yet updated).
        setAvailableParticipants(scoped.length > 0 ? scoped : participants);
      } else {
        setAvailableParticipants(participants);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({
        title: "Error",
        description: "Failed to load available participants",
        variant: "destructive"
      });
    } finally {
      setLoadingParticipants(false);
    }
  };

  // Single-select note: checkboxes are rendered but behave like radios so exactly
  // one participant is chosen at a time (maps to the single target_user_id DB column).
  const handleParticipantToggle = (participantId: string) => {
    // Preserve scroll position: selecting a recipient causes React to re-render
    // which triggers the browser to scroll the sr-only checkbox into view,
    // jumping scrollTop to ~629px. We capture and restore it after the update.
    const savedScroll = scrollBodyRef.current?.scrollTop ?? 0;
    setSelectedParticipants(prev =>
      prev.includes(participantId) ? prev.filter(id => id !== participantId) : [participantId]
    );
    requestAnimationFrame(() => {
      if (scrollBodyRef.current) {
        scrollBodyRef.current.scrollTop = savedScroll;
      }
    });
  };

  // Use structured entries aligned with PURPOSE_CONFIGS so the correct value keys
  // are stored in the DB (fixes invalid values like 'need_clarification', etc.).
  const purposeOptions: Array<{ value: CreateLiveMeetingRequestDto['purpose']; label: string }> = [
    { value: 'clarification', label: PURPOSE_CONFIGS.clarification.label },
    { value: 'approval_discussion', label: PURPOSE_CONFIGS.approval_discussion.label },
    { value: 'document_review', label: PURPOSE_CONFIGS.document_review.label },
    { value: 'urgent_decision', label: PURPOSE_CONFIGS.urgent_decision.label },
  ];

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'immediate': return <Zap className="w-4 h-4" />;
      case 'urgent': return <AlertTriangle className="w-4 h-4" />;
      case 'normal': return <Activity className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'immediate': return 'text-red-600 bg-red-50 border-red-200';
      case 'urgent': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'online': return <Video className="w-4 h-4" />;
      case 'in_person': return <Building className="w-4 h-4" />;
      default: return <Video className="w-4 h-4" />;
    }
  };

  const handleSubmitRequest = async () => {
    if (selectedParticipants.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one participant",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const selectedParticipantData = selectedParticipants.map(id =>
        availableParticipants.find(p => p.id === id)
      ).filter(Boolean) as Array<{ id: string; name: string; role: string; email: string; department: string }>;

      const requestData: CreateLiveMeetingRequestDto = {
        documentId,
        documentType,
        documentTitle,
        targetUserIds: selectedParticipants,
        targetUserNames: selectedParticipantData.map(p => p.name),
        targetUserRoles: selectedParticipantData.map(p => p.role),
        targetUserEmails: selectedParticipantData.map(p => p.email),
        urgency,
        meetingFormat,
        purpose,
        agenda: agenda.trim() || undefined,
        requestedTime: requestedDate && startTime ? new Date(`${requestedDate}T${startTime}:00`) : undefined,
        requestedEndTime: requestedDate && endTime ? new Date(`${requestedDate}T${endTime}:00`) : undefined,
        location: meetingFormat === 'in_person' ? location : undefined,
        meetingLink: meetingFormat === 'online' ? meetingLink : undefined
      };

      await liveMeetingService.createRequest(requestData, {
        id: user!.id,
        name: user!.name,
        role: user!.role
      });

      const selectedParticipantNames = selectedParticipantData.map(p => p.name);

      // Dispatch global notifications to selected participants
      NotificationDispatchService.dispatch({
        recipientRowIds: selectedParticipants,
        title: 'LiveMeet+ Request',
        message: `${user?.name} has requested a ${meetingFormat} meeting for "${documentTitle}". ${agenda ? `Agenda: ${agenda}` : ''}`,
        type: 'meeting',
        urgent: urgency === 'immediate' || urgency === 'urgent',
        action_url: `${window.location.origin}/calendar`,
        document_id: documentId,
        emailParams: {
          type: 'livemeet_request',
          params: {
            requesterName: user?.name || 'A colleague',
            documentTitle,
            meetUrl: `${window.location.origin}/calendar`,
          },
        },
        pushPayload: {
          title: 'New LiveMeet+ Request',
          body: `${user?.name} wants to meet about "${documentTitle}"`,
          url: `${window.location.origin}/calendar`,
        },
      }).catch(err => console.error('[LiveMeet+] Dispatch failed:', err));

      // Dispatch custom event for notification widget updates
      window.dispatchEvent(new CustomEvent('livemeet-notification', {
        detail: {
          recipients: selectedParticipantNames,
          requester: user?.name,
          documentTitle,
          meetingFormat,
          urgency,
          agenda
        }
      }));

      console.log(`[LiveMeet+] Request created by ${user?.name} for: ${selectedParticipantNames.join(', ')}`);

      // Show success toast with participant names
      toast({
        title: "LiveMeet+ Request Sent",
        description: `Your LiveMeet+ request has been sent successfully to: ${selectedParticipantNames.join(', ')}.`,
        variant: "default"
      });

      // Reset form and close modal
      handleClose();
    } catch (error) {
      console.error('Error creating live meeting request:', error);
      toast({
        title: "Error",
        description: "Failed to send live meeting request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const convertTo12Hour = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleClose = () => {
    // Reset form state
    setMeetingFormat('online');
    setUrgency('normal');
    setPurpose('clarification');
    setSelectedParticipants([]);
    setAgenda('');
    setLocation('');
    setMeetingLink('');
    setRequestedTime('');
    setRequestedDate('');
    setStartTime('');
    setEndTime('');
    onClose();
  };

  const urgencyConfig = URGENCY_CONFIGS[urgency];
  const purposeConfig = PURPOSE_CONFIGS[purpose];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            // Prevent Radix from auto-focusing the first focusable element inside
            // the dialog. Without this, the browser calls scrollIntoView() on the
            // first interactive element in the scrollable body, jumping scrollTop
            // to ~629px and hiding the header and top form sections on open.
            e.preventDefault();
            // After content loads, reset scroll to top so header is always visible
            requestAnimationFrame(() => {
              if (scrollBodyRef.current) {
                scrollBodyRef.current.scrollTop = 0;
              }
            });
          }}
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[95vw] sm:max-w-6xl translate-x-[-50%] translate-y-[-50%] border-none bg-gray-50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg rounded-[28px] overflow-hidden max-h-[90vh] sm:max-h-[85vh] p-0 shadow-2xl" style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}>
          {/* Header — 'auto' grid row; VisuallyHidden elements live here to stay out of grid flow */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white relative sm:rounded-t-lg rounded-t-[28px] overflow-hidden">
            <VisuallyHidden.Root asChild>
              <DialogPrimitive.Title>LiveMeet+ Request</DialogPrimitive.Title>
            </VisuallyHidden.Root>
            <VisuallyHidden.Root asChild>
              <DialogPrimitive.Description>Create a live meeting request for document clarification</DialogPrimitive.Description>
            </VisuallyHidden.Root>
            <button
              className="absolute right-4 top-4 sm:right-6 sm:top-6 text-white hover:text-gray-200 transition-colors z-10"
              onClick={handleClose}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 w-6 h-6 bg-green-400 rounded-full"></div>
                <div className="absolute inset-1 w-4 h-4 bg-red-500 rounded-full"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold">LiveMeet+</h1>
                <p className="text-indigo-100 text-sm">Request Immediate Clarification Meeting for Document Review and Discussion</p>
              </div>
            </div>
          </div>

          {/* Scrollable body — '1fr' grid row; always fills remaining height */}
          <div
            ref={scrollBodyRef}
            className="bg-white scrollbar-thin scrollbar-thumb-gray-200 sm:rounded-b-lg rounded-b-[28px]"
            style={{ overflowY: 'auto', minHeight: 0 }}
          >
            {/* Single Column Layout */}
            <div className="p-4 pb-6">
              {/* Meeting Purpose */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  <span>Meeting Purpose</span>
                </label>

                <div className="relative">
                  <button
                    onClick={() => setPurposeDropdownOpen(!purposeDropdownOpen)}
                    className="w-full bg-white border-2 border-emerald-300 rounded-xl px-4 py-4 text-left flex items-center justify-between hover:border-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-medium text-gray-800">{purposeOptions.find(p => p.value === purpose)?.label || PURPOSE_CONFIGS.clarification.label}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${purposeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {purposeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                      {purposeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setPurpose(option.value);
                            setPurposeDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-500 mt-2">Requires Clarification on Document Content</p>
              </div>

              {/* Urgency Level */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <span>Urgency Level</span>
                </label>

                <div className="space-y-3">
                  {['normal', 'urgent', 'immediate'].map((level) => (
                    <div 
                      key={level} 
                      className="flex items-center cursor-pointer group"
                      onClick={() => setUrgency(level as any)}
                    >
                      <div className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all group-hover:shadow-md ${urgency === level
                        ? getUrgencyColor(level) + ' border-current'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${urgency === level ? 'bg-white bg-opacity-50' : 'bg-gray-100'
                          }`}>
                          {getUrgencyIcon(level)}
                        </div>
                        <span className="font-medium">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meeting Format */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Meeting Format</span>
                </label>

                <div className="space-y-3">
                  {[{ value: 'online', label: 'Online' }, { value: 'in_person', label: 'In-Person' }].map((format) => (
                    <div 
                      key={format.value} 
                      className="flex items-center cursor-pointer group"
                      onClick={() => setMeetingFormat(format.value as any)}
                    >
                      <div className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all group-hover:shadow-md ${meetingFormat === format.value
                        ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meetingFormat === format.value ? 'bg-white bg-opacity-50' : 'bg-gray-100'
                          }`}>
                          {getFormatIcon(format.value)}
                        </div>
                        <span className="font-medium">{format.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location (for in-person meetings) */}
              {(meetingFormat === 'in_person') && (
                <div className="space-y-2 mb-6">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Meeting Location
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="location"
                      placeholder="E.g: Principal's Office, Conference Room A"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-10 text-base sm:text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Link (for online meetings) */}
              {(meetingFormat === 'online') && (
                <div className="space-y-2 mb-6">
                  <Label htmlFor="meetingLink" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Meeting Link
                  </Label>
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="meetingLink"
                      placeholder="E.g: https://meet.google.com"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      className="pl-10 text-base sm:text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Date & Time */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <span>Preferred Date & Time</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap w-12 sm:w-auto">From:</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base sm:text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap w-12 sm:w-auto">To:</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Select Recipients Section */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  <span>Select Recipients</span>
                </label>

                <div className="space-y-2">
                  {availableParticipants.map((participant) => (
                    <div 
                      key={participant.id} 
                      className="flex items-center cursor-pointer group"
                      onClick={() => handleParticipantToggle(participant.id)}
                    >
                      <div className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all w-full group-hover:shadow-sm ${selectedParticipants.includes(participant.id)
                        ? 'border-indigo-200 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${selectedParticipants.includes(participant.id)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                          }`}>
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{participant.name}</p>
                          <p className="text-xs text-gray-500 truncate">{participant.role.toUpperCase()} • {participant.department.toUpperCase()}</p>
                        </div>
                        {selectedParticipants.includes(participant.id) && (
                          <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom participant entry is intentionally disabled: external IDs cannot
                    satisfy the RLS target_user_id check (must be a real role_recipients.id). */}
              </div>

              {/* Description & Agenda Section */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  <span>Description & Agenda</span>
                </label>

                <textarea
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Brief description of what needs to be discussed..."
                  className="w-full h-16 px-3 py-2 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-base sm:text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  className="px-6 py-3 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2.5 sm:px-8 sm:py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold text-sm sm:text-base hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50"
                  onClick={handleSubmitRequest}
                  disabled={loading || selectedParticipants.length === 0}
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Sending...' : 'Send LiveMeet+ Requests'}</span>
                </button>
              </div>
            </div>
          </div>


        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
};
