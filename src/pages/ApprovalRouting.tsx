import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WorkflowConfiguration } from '@/components/workflow/WorkflowConfiguration';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseBypass } from '@/hooks/useSupabaseBypass';
import { useTutorialContext } from '@/contexts/TutorialContext';
import { cn } from '@/lib/utils';
import {
  Settings,
  Clock,
  CheckCircle2,
  ArrowRightLeft,
  Shield,
  Zap,
  BarChart3,
  Bell,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Send,
  User,
  GitBranch,
  RotateCcw,
  ChevronRight,
  ArrowLeftRight,
  Repeat,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ApprovalRouting() {
  const { user } = useAuth();
  const bypassService = useSupabaseBypass();
  const [isBypassMode, setIsBypassMode] = useState(false);
  const [isFeaturesExpanded, setIsFeaturesExpanded] = useState(false);
  const { isAdvanced, getCurrentStep } = useTutorialContext();
  
  const currentStepObj = getCurrentStep();
  const isApprovalTutorialActive = isAdvanced && currentStepObj?.id.startsWith('adv-approval-');
  const displayBypassMode = isBypassMode || isApprovalTutorialActive;

  const stats = useMemo(() => bypassService?.getStatistics() || {
    pending: 0,
    completed: 0,
    bypassed: 0,
    total: 0,
    responseRate: 0,
    averageTime: '0 hours'
  }, [bypassService?.documents]);
  const ADMIN_ROLES = ['principal', 'registrar', 'hod', 'program-head'];
  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;

  return (
    <ResponsiveLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
        {!displayBypassMode && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Approval Chain with Bypass</h1>
            <p className="text-base text-muted-foreground">Documents can bypass Standard Approval Steps for faster Authorization and Response.</p>
          </div>
        )}

        <Card className={`shadow-elegant ${displayBypassMode ? 'border-blue-500 bg-blue-50' : ''}`}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className={`w-6 h-6 ${displayBypassMode ? 'text-blue-600 animate-pulse' : 'text-primary'}`} />
                <span className="text-xl sm:text-2xl">Approval Chain with Bypass</span>
              </CardTitle>

              <Button
                onClick={() => setIsBypassMode(!isBypassMode)}
                variant={displayBypassMode ? "default" : "outline"}
                className={`w-full sm:w-auto font-bold ${displayBypassMode ? 'animate-pulse shadow-glow bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                size="lg"
              >
                {displayBypassMode ? (
                  <>
                    <XCircle className="w-5 h-5 mr-2" />
                    Cancel Bypass
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    ACTIVATE BYPASS
                  </>
                )}
              </Button>
            </div>

            {displayBypassMode && (
              <div className="bg-blue-100 border border-blue-200 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                  <ArrowRightLeft className="w-5 h-5" />
                  BYPASS MODE ACTIVE
                </div>

              </div>
            )}
          </CardHeader>
        </Card>

        {!displayBypassMode && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.pending || 0}</p>
                  </div>
                  <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Avg. Time</p>
                    <p className="text-lg sm:text-2xl font-bold">{(stats as any).averageTime || '0 hours'}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 sm:w-8 sm:h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Bypass Count</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.bypassed || 0}</p>
                  </div>
                  <Zap className="w-5 h-5 sm:w-8 sm:h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Response Rate</p>
                    <p className="text-lg sm:text-2xl font-bold">{stats.responseRate || 0}%</p>
                  </div>
                  <Shield className="w-5 h-5 sm:w-8 sm:h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!displayBypassMode && (
          <Card className="transition-all duration-300 ease-in-out">
            <CardHeader 
              className="flex flex-col space-y-1.5 p-6 cursor-pointer hover:bg-muted/5 transition-colors"
              onClick={() => setIsFeaturesExpanded(!isFeaturesExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                  <ArrowRightLeft className="w-5 h-5" />
                  System Features
                </CardTitle>
                <div className="flex items-center justify-center p-1 rounded-full bg-muted/20 text-muted-foreground">
                  {isFeaturesExpanded ? (
                    <ChevronUp className="w-6 h-6 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-6 h-6 transition-transform duration-300" />
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                The Approval Chain with Bypass system supports three distinct routing mechanisms. Each method determines how documents flow between selected recipients during the approval process.
              </p>
            </CardHeader>
            {isFeaturesExpanded && (
              <CardContent className="p-6 pt-0 space-y-6 animate-fade-in">
              <div className="border rounded-lg p-5 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 p-2.5 rounded-lg bg-white shadow-sm text-blue-500">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Sequential Routing
                      <Badge variant="outline" className="text-xs bg-white/50">1 of 3</Badge>
                    </h3>
                    <p className="text-base sm:text-sm text-muted-foreground">
                      Documents flow through recipients one at a time in a predefined order. Each recipient must complete their action before the document moves to the next person.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4 border">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Document Flow Diagram</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-700">
                      <Send className="w-4 h-4" /> Submitter
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700">
                      <User className="w-4 h-4" /> Recipient 1
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700">
                      <User className="w-4 h-4" /> Recipient 2
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700">
                      <User className="w-4 h-4" /> Recipient 3
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> Complete
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">How It Works</p>
                  <ol className="space-y-2">
                    {[
                      "Document is submitted and sent to the first recipient in the chain",
                      "Recipient 1 reviews and approves/signs the document",
                      "Upon approval, the document automatically advances to Recipient 2",
                      "This process continues until all recipients have approved",
                      "If any recipient rejects, the workflow stops or escalates based on settings"
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-500">{i + 1}</span>
                        <span className="text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="border rounded-lg p-5 bg-green-50 border-green-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 p-2.5 rounded-lg bg-white shadow-sm text-green-500">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Parallel Routing
                      <Badge variant="outline" className="text-xs bg-white/50">2 of 3</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Documents are sent to all recipients simultaneously. All recipients can review and act on the document at the same time, reducing overall processing time.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4 border overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Document Flow Diagram</p>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium w-fit">
                      <Send className="w-4 h-4" /> Submitter
                    </div>

                    <div className="flex md:flex-col items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:-rotate-45" />
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-45" />
                    </div>

                    <div className="flex flex-col gap-2 w-full md:w-auto px-4 md:px-0">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium justify-center md:justify-start">
                          <User className="w-4 h-4" /> Recipient {i}
                        </div>
                      ))}
                    </div>

                    <div className="flex md:flex-col items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-45" />
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:-rotate-45" />
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-medium w-fit">
                      <CheckCircle2 className="w-4 h-4" /> Complete
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">How It Works</p>
                  <ol className="space-y-2">
                    {[
                      "Document is submitted and sent to ALL recipients at the same time",
                      "Each recipient receives their own approval card independently",
                      "Recipients can approve/reject in any order without waiting",
                      "System tracks all responses and consolidates the final status",
                      "Document is marked complete when all recipients have responded"
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-green-500">{i + 1}</span>
                        <span className="text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>


              <div className="border rounded-lg p-5 bg-purple-50 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 p-2.5 rounded-lg bg-white shadow-sm text-purple-500">
                    <ArrowLeftRight className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      Bi-Directional Routing
                      <Badge variant="outline" className="text-xs bg-white/50">3 of 3</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Documents are sent to all recipients simultaneously (like Parallel), with added Resend and Re-Upload capability. If any recipient rejects, the submitter can resend the document to them.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4 border overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Document Flow Diagram</p>
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium w-fit">
                        <Send className="w-4 h-4" /> Submitter
                      </div>

                      <div className="flex md:flex-col items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-90 md:-rotate-45" />
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-90 md:rotate-0" />
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-90 md:rotate-45" />
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto px-4 md:px-0">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium justify-center md:justify-start">
                            <User className="w-4 h-4" /> Recipient {i}
                          </div>
                        ))}
                      </div>

                      <div className="flex md:flex-col items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-90 md:rotate-45" />
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-90 md:rotate-0" />
                        <ChevronRight className="w-4 h-4 text-purple-400 rotate-90 md:-rotate-45" />
                      </div>

                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-medium w-fit">
                        <CheckCircle2 className="w-4 h-4" /> Complete
                      </div>
                    </div>

                    <div className="border-t border-purple-200 pt-4">
                      <p className="text-xs text-purple-600 font-medium mb-3 flex items-center justify-center md:justify-start gap-1">
                        <RotateCcw className="w-3 h-3" /> Rejection Recovery (Unique to Bi-Directional)
                      </p>
                      <div className="flex flex-col md:flex-row items-center justify-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium uppercase tracking-tight">
                          <XCircle className="w-4 h-4" /> Rejection
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-sm font-medium uppercase tracking-tight">
                          <AlertTriangle className="w-4 h-4" /> Bypassed
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
                        <div className="flex flex-row md:flex-col gap-2">
                          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-[10px] md:text-xs font-medium uppercase">
                            <Repeat className="w-3 h-3" /> Resend
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-[10px] md:text-xs font-medium uppercase">
                            <FileText className="w-3 h-3" /> Re-Upload
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90 md:rotate-0" />
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm font-medium uppercase tracking-tight">
                          <UserCheck className="w-4 h-4" /> Retry
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">How It Works</p>
                  <ol className="space-y-2">
                    {[
                      "Document is submitted and sent to ALL recipients at the same time",
                      "All recipients can approve/reject independently and simultaneously",
                      "If a recipient rejects, their step is marked as \"bypassed\"",
                      "Submitter sees Resend and Re-Upload buttons for bypassed recipients",
                      "Clicking Resend reactivates the approval card for rejected recipients",
                      "Re-Upload allows submitter to attach revised documents before resending"
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-base sm:text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-purple-500">{i + 1}</span>
                        <span className="text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-base">Bypass Mode</h4>
                    <p className="text-base sm:text-sm text-muted-foreground mt-1">
                      When Bypass Mode is activated, you can configure any of these routing types for your document submission.
                      The bypass feature allows authorized users to skip certain approval steps in emergency situations while
                      maintaining a complete audit trail of all actions taken.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            )}
          </Card>
        )}

        {displayBypassMode && (
          <Card className="shadow-elegant border-blue-500">
            <CardContent className="p-6">
              <WorkflowConfiguration 
                hideWorkflowsTab={true} 
                bypassService={bypassService} 
                onSuccess={() => setIsBypassMode(false)}
              />
            </CardContent>
          </Card>
        )}

      </div>
    </ResponsiveLayout>
  );
}
