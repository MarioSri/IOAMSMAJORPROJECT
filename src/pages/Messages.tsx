import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { LiveMeetingRequestManager } from "@/components/meetings/LiveMeetingRequestManager";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Users,
  BarChart3,
  Zap,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { useResponsive } from "@/hooks/useResponsive";
import { useLiveMeeting } from "@/hooks/useLiveMeeting";
import { useChatStats } from "@/hooks/useDepartmentChat";
import { useSearchParams } from "react-router-dom";

export default function Messages() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || "chat");

  const { totalChannels, onlineUsers, unreadCounts, clearUnread } = useChatStats(user?.id);
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  const [activePolls] = useState(0);

  const {
    requests: liveMeetRequests,
    stats: liveMeetStats,
    loading: liveMeetLoading,
    isConnected: liveMeetConnected,
    respondToRequest: liveMeetRespond,
    refreshData: liveMeetRefresh
  } = useLiveMeeting();

  const liveMeetPendingCount = liveMeetRequests.filter(r => r.status === 'pending').length;

  // Sync state with URL parameter
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  if (!user) return null;

  return (
    <ResponsiveLayout>
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Communication Center</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Departmental messages and collaboration tools</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full h-auto grid-cols-2">
            <TabsTrigger value="chat" className="relative text-xs sm:text-sm py-2 sm:py-1.5 h-full whitespace-normal">
              <span className="hidden sm:inline">Department Chat</span>
              <span className="sm:hidden">Chat</span>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="ml-1 sm:ml-2 px-1 py-0 text-[10px] sm:text-xs animate-pulse self-center">
                  {totalUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="live-requests" className="relative text-xs sm:text-sm py-2 sm:py-1.5 h-full whitespace-normal">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <div className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-green-400 rounded-full"></div>
                  <div className="relative w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></div>
                </div>
                <span>LiveMeet+</span>
              </div>
              {liveMeetPendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 sm:ml-2 px-1 py-0 text-[10px] sm:text-xs animate-pulse self-center">
                  {liveMeetPendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>


          <TabsContent value="live-requests" className="space-y-6">
            <ErrorBoundary>
              <LiveMeetingRequestManager
                requests={liveMeetRequests}
                stats={liveMeetStats}
                loading={liveMeetLoading}
                isConnected={liveMeetConnected}
                respondToRequest={liveMeetRespond}
                refreshData={liveMeetRefresh}
              />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <div className="hidden md:grid grid-cols-4 gap-3 sm:gap-4 mb-6">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Online</p>
                      <p className="text-lg sm:text-2xl font-bold">{onlineUsers}</p>
                    </div>
                    <Users className="w-5 h-5 sm:w-8 sm:h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Channels</p>
                      <p className="text-lg sm:text-2xl font-bold">{totalChannels}</p>
                    </div>
                    <Lock className="w-5 h-5 sm:w-8 sm:h-8 text-indigo-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Polls</p>
                      <p className="text-lg sm:text-2xl font-bold">{activePolls}</p>
                    </div>
                    <BarChart3 className="w-5 h-5 sm:w-8 sm:h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs sm:text-sm font-medium">Live</span>
                      </div>
                    </div>
                    <Zap className="w-5 h-5 sm:w-8 sm:h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="min-h-[calc(100vh-350px)] sm:min-h-[600px] border-none sm:border">
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  Department Communication Hub
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-sm hidden xs:block">
                  Real-time chat, document workflows, and collaboration tools
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[calc(100vh-350px)] sm:h-[600px]">
                  <ErrorBoundary>
                    <ChatInterface channelMessageCounts={unreadCounts} onChannelRead={clearUnread} />
                  </ErrorBoundary>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveLayout>
  );
}