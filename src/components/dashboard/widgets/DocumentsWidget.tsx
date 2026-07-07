import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import { AISummarizerModal } from '@/components/shared/AISummarizerModal';
import { useSupabaseRecentDocuments } from '@/hooks/useSupabaseRecentDocuments';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  User,
  Calendar,
  Building,
  Zap,
  Filter,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  type: 'Letter' | 'Circular' | 'Report';
  status: 'pending' | 'approved' | 'rejected' | 'in-review' | 'emergency';
  submittedBy: string;
  submittedByRole: string;
  department: string;
  branch?: string;
  year?: string;
  date: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  description: string;
  requiresAction: boolean;
  escalationLevel: number;
  aiSummary?: string;
  approvalCard?: {
    id: string;
    title: string;
    description: string;
    files?: Record<string, unknown>[];
  };  // Raw approval card for AI summarization
}

interface DocumentsWidgetProps {
  userRole: string;
  permissions: Record<string, boolean>;
  isCustomizing?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

const DocumentsWidget: React.FC<DocumentsWidgetProps> = ({
  userRole,
  permissions,
  isCustomizing,
  onSelect,
  isSelected
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const { documents, loading } = useSupabaseRecentDocuments();
  const [filter, setFilter] = useState<'all' | 'pending' | 'emergency'>('all');
  const [showAISummarizer, setShowAISummarizer] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);



  const getFilteredDocuments = () => {
    switch (filter) {
      case 'pending':
        return documents.filter(doc => doc.status === 'pending' || doc.status === 'in-review');

      case 'emergency':
        return documents.filter(doc => doc.status === 'emergency' || doc.priority === 'emergency');
      default:
        return documents;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending': return <Clock className="w-4 h-4 text-warning" />;
      case 'in-review': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'emergency': return <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: { variant: "success" as const, text: "Approved" },
      rejected: { variant: "destructive" as const, text: "Rejected" },
      pending: { variant: "warning" as const, text: "Pending" },
      'in-review': { variant: "default" as const, text: "In Review" },
      emergency: { variant: "destructive" as const, text: "EMERGENCY" }
    };
    return variants[status as keyof typeof variants] || { variant: "default" as const, text: status };
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

  const filteredDocuments = getFilteredDocuments();
  const urgentCount = documents.filter(doc => doc.requiresAction && (doc.priority === 'high' || doc.priority === 'emergency')).length;

  if (loading) {
    return (
      <Card className={cn(
        "shadow-elegant",
        isSelected && "border-primary",
        isCustomizing && "cursor-pointer"
      )} onClick={onSelect}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Recent Approvals
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

  const cardContent = (
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
            <FileText className="w-5 h-5 text-primary" />
            Recent Approvals
            {urgentCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {urgentCount} urgent
              </Badge>
            )}
          </CardTitle>

          <div className={cn(
            "flex items-center gap-2",
            isMobile && "w-full justify-between"
          )}>
            <div className={cn("flex gap-1", isMobile && "flex-1")}>
              {(['all', 'pending', 'emergency'] as const).map(filterType => (
                <Button
                  key={filterType}
                  variant={filter === filterType ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(filterType)}
                  className={cn(isMobile ? "text-xs px-3 h-8 flex-1" : "px-3")}
                >
                  {filterType === 'all' ? 'All' :
                    filterType === 'pending' ? 'Pending' : 'Emergency'}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/approvals")}
              className={cn(isMobile && "text-xs")}
            >
              <Eye className="w-4 h-4 mr-1" />
              View All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className={cn(isMobile ? "h-64" : "h-80")}>
          <div className="space-y-3">
            {filteredDocuments.slice(0, isMobile ? 5 : 8).map((doc, index) => (
              <div
                key={doc.id}
                className={cn(
                  "relative p-4 border rounded-lg hover:bg-accent transition-all cursor-pointer animate-fade-in",
                  doc.status === 'emergency' && "border-destructive bg-red-50 animate-pulse",
                  doc.priority === 'emergency' && "border-destructive bg-red-50 animate-pulse",
                  doc.requiresAction && "border-l-4 border-l-warning"
                )}
                onClick={() => {
                  console.log('🖱️ [Dashboard] Card clicked:', doc.id);
                  navigate(`/approvals#${doc.id}`);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "font-medium line-clamp-2",
                      isMobile ? "text-sm" : "text-base"
                    )}>
                      {doc.title}
                    </h4>
                    {doc.aiSummary && (
                      <p className={cn(
                        "text-muted-foreground mt-1 line-clamp-2",
                        isMobile ? "text-xs" : "text-sm"
                      )}>
                        🤖 {doc.aiSummary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    {getStatusIcon(doc.status)}
                    <Badge variant={getStatusBadge(doc.status).variant} className="text-xs">
                      {getStatusBadge(doc.status).text}
                    </Badge>
                  </div>
                </div>

                <div className={cn(
                  "grid gap-2 text-xs text-muted-foreground",
                  isMobile ? "grid-cols-1" : "grid-cols-2 md:grid-cols-4"
                )}>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{doc.submittedBy}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{doc.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{doc.date}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className={cn("w-3 h-3", getPriorityColor(doc.priority))} />
                    <span className={getPriorityColor(doc.priority)}>
                      {doc.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Branch and Year info for Program Heads */}
                {(userRole === 'program-head' || userRole === 'hod') && (doc.branch || doc.year) && (
                  <div className="flex items-center gap-2 mt-2">
                    {doc.branch && (
                      <Badge variant="outline" className="text-xs">
                        {doc.branch}
                      </Badge>
                    )}
                    {doc.year && (
                      <Badge variant="outline" className="text-xs">
                        {doc.year}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Action Required Indicator */}
                {doc.requiresAction && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-warning/10 rounded border border-warning/20">
                    <Zap className="w-4 h-4 text-warning" />
                    <span className="text-sm font-medium text-warning">
                      Action Required
                    </span>
                    {doc.escalationLevel > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        Escalated {doc.escalationLevel}x
                      </Badge>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/approvals#${doc.id}`);
                  }}>
                    <Eye className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDoc(doc);
                    setShowAISummarizer(true);
                  }}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Summarizer
                  </Button>
                </div>
              </div>
            ))}

            {filteredDocuments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className={cn(isMobile ? "text-sm" : "text-base")}>
                  No approvals found
                </p>
                <p className="text-xs">
                  {filter === 'all' ? 'No approvals available' : `No ${filter} approvals`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Widget Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredDocuments.length} approvals</span>
            {urgentCount > 0 && (
              <span className="text-warning font-medium">
                {urgentCount} require action
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/approvals")}
          >
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      {cardContent}
      {selectedDoc && (
        <AISummarizerModal
          isOpen={showAISummarizer}
          onClose={() => {
            setShowAISummarizer(false);
            setSelectedDoc(null);
          }}
          document={selectedDoc}
          approvalCard={selectedDoc.approvalCard}
        />
      )}
    </>
  );
};

export default DocumentsWidget;