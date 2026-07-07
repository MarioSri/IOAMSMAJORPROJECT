import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, TrendingUp, Clock, Users, AlertTriangle, Zap, Activity, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { LiveMeetingRequestCard } from './LiveMeetingRequestCard';
import { LiveMeetingRequest, LiveMeetingResponse, LiveMeetingStats } from '@/types/liveMeeting';


interface LiveMeetingRequestManagerProps {
  requests: LiveMeetingRequest[];
  stats: LiveMeetingStats | null;
  loading: boolean;
  isConnected: boolean;
  respondToRequest: (response: LiveMeetingResponse) => Promise<void>;
  refreshData: () => Promise<void>;
}

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  description?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, description }) => (
  <Card>
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
          <p className={`text-lg sm:text-2xl font-bold text-${color}-600`}>{value}</p>
          {description && <p className="text-[10px] sm:text-xs text-gray-500 mt-1 truncate">{description}</p>}
        </div>
        <div className={`p-1.5 sm:p-2 bg-${color}-100 rounded-lg flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

export const LiveMeetingRequestManager: React.FC<LiveMeetingRequestManagerProps> = ({
  requests: activeRequests,
  stats,
  loading,
  isConnected,
  respondToRequest: respond,
  refreshData
}) => {
  const [filteredRequests, setFilteredRequests] = useState<LiveMeetingRequest[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  // Defense-in-depth: exclude requests sent by the current user.
  // The DB RLS and service layer already enforce this; this filter
  // catches any edge cases where a request slips through.
  const receiverRequests = activeRequests.filter(
    request => request.requesterId !== user?.id
  );

  useEffect(() => {
    applyFilters();
  }, [receiverRequests, filter, searchTerm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Live meeting requests updated",
      variant: "default"
    });
  };

  const applyFilters = () => {
    let filtered = receiverRequests;

    if (filter !== 'all') {
      filtered = filtered.filter(request => {
        switch (filter) {
          case 'pending':
            return request.status === 'pending';
          case 'urgent':
            return request.urgency === 'urgent';
          case 'immediate':
            return request.urgency === 'immediate';
          case 'today': {
            const today = new Date().toDateString();
            return new Date(request.createdAt).toDateString() === today;
          }
          default:
            return true;
        }
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(request =>
        request.documentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.purpose.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRequests(filtered);
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full"></div>
              <div className="absolute inset-1 w-2 h-2 bg-red-500 rounded-full"></div>
            </div>
            LiveMeet+
            {isConnected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Supabase Live"></div>}
            {filteredRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {filteredRequests.filter(r => r.status === 'pending').length} pending
              </Badge>
            )}
          </h3>
          <p className="text-gray-600 mt-1">
            Real-Time Communication Requests for Document Workflows
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard
            title="Pending LiveMeet+"
            value={stats.pendingRequests}
            icon={<Clock className="h-5 w-5 text-yellow-600" />}
            color="yellow"
            description="Awaiting response"
          />
          <StatsCard
            title="Immediate"
            value={stats.immediateRequests}
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            color="red"
            description="Within 15 minutes"
          />
          <StatsCard
            title="Today's LiveMeet+"
            value={stats.todaysMeetings}
            icon={<Users className="h-5 w-5 text-blue-600" />}
            color="blue"
            description="Scheduled today"
          />
          <StatsCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            color="green"
            description="Acceptance rate"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search requests by title, requester, or purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">All Pendings</SelectItem>
              <SelectItem value="normal">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Normal</span>
                </div>
              </SelectItem>
              <SelectItem value="urgent">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span>Urgent</span>
                </div>
              </SelectItem>
              <SelectItem value="immediate">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-600" />
                  <span>Immediate</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-4">
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <p className="font-medium">No live meeting requests</p>
              <p className="text-sm mt-1">Requests will appear here when sent to you.</p>
            </div>
          )}

          {filteredRequests.map(request => (
            <LiveMeetingRequestCard
              key={request.id}
              request={request}
            />
          ))}

        </div>
      </div>
    </div>
  );
};