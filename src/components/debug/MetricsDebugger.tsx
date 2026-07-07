/**
 * MetricsDebugger Component
 * 
 * Temporary debugging utility to verify metrics stability fix.
 * Add this component to Documents.tsx to monitor real-time behavior.
 * 
 * Usage:
 * import { MetricsDebugger } from '@/components/debug/MetricsDebugger';
 * 
 * // In Documents component, add:
 * {process.env.NODE_ENV === 'development' && (
 *   <MetricsDebugger documents={documentHook.documents} user={user} />
 * )}
 */

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface MetricsDebuggerProps {
  documents: any[];
  user: any;
}

export const MetricsDebugger: React.FC<MetricsDebuggerProps> = ({ documents, user }) => {
  const [events, setEvents] = useState<Array<{ time: string; type: string; message: string }>>([]);
  const [cacheStatus, setCacheStatus] = useState<any>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const previousDocsRef = useRef<any[]>([]);
  const eventCountRef = useRef(0);

  useEffect(() => {
    const prev = previousDocsRef.current;
    const current = documents;

    if (prev.length !== current.length) {
      const event = {
        time: new Date().toLocaleTimeString(),
        type: 'COUNT_CHANGE',
        message: `Document count changed: ${prev.length} → ${current.length}`
      };
      setEvents(e => [...e.slice(-19), event]);
      eventCountRef.current++;
    }

    const prevIds = new Set(prev.map(d => d.id));
    const currentIds = new Set(current.map(d => d.id));

    currentIds.forEach(id => {
      if (!prevIds.has(id)) {
        const doc = current.find(d => d.id === id);
        setEvents(e => [...e.slice(-19), {
          time: new Date().toLocaleTimeString(),
          type: 'INSERT',
          message: `New document: ${doc?.title || id}`
        }]);
        eventCountRef.current++;
      }
    });

    prevIds.forEach(id => {
      if (!currentIds.has(id)) {
        const doc = prev.find(d => d.id === id);
        setEvents(e => [...e.slice(-19), {
          time: new Date().toLocaleTimeString(),
          type: 'DELETE',
          message: `Removed document: ${doc?.title || id}`
        }]);
        eventCountRef.current++;
      }
    });

    current.forEach(doc => {
      const prevDoc = prev.find(d => d.id === doc.id);
      if (prevDoc && prevDoc.status !== doc.status) {
        setEvents(e => [...e.slice(-19), {
          time: new Date().toLocaleTimeString(),
          type: 'UPDATE',
          message: `Status changed: ${doc.title} (${prevDoc.status} → ${doc.status})`
        }]);
        eventCountRef.current++;
      }
    });

    previousDocsRef.current = current;
  }, [documents]);

  useEffect(() => {
    const checkCache = () => {
      try {
        const cache = JSON.parse(localStorage.getItem('documents-cache') || '[]');
        const cachedUser = localStorage.getItem('documents-cache-user');
        
        const wrongUserDocs = cache.filter((d: any) => d.submitter_id !== user?.id);
        const duplicates = cache.length - new Set(cache.map((d: any) => d.id)).size;
        
        setCacheStatus({
          cacheSize: cache.length,
          cachedUser,
          currentUser: user?.id,
          userMatch: cachedUser === user?.id,
          wrongUserDocs: wrongUserDocs.length,
          duplicates,
          lastCheck: new Date().toLocaleTimeString()
        });
      } catch (e) {
        setCacheStatus({ error: 'Failed to read cache' });
      }
    };

    checkCache();
    const interval = setInterval(checkCache, 2000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const verifyIntegrity = () => {
    const issues: string[] = [];
    
    const wrongUserDocs = documents.filter(d => d.submitter_id !== user?.id);
    if (wrongUserDocs.length > 0) {
      issues.push(`❌ ${wrongUserDocs.length} documents from other users`);
    }

    const ids = documents.map(d => d.id);
    const duplicates = ids.length - new Set(ids).size;
    if (duplicates > 0) {
      issues.push(`❌ ${duplicates} duplicate documents`);
    }

    if (cacheStatus.cachedUser !== user?.id) {
      issues.push(`❌ Cache belongs to different user`);
    }

    if (issues.length === 0) {
      setEvents(e => [...e.slice(-19), {
        time: new Date().toLocaleTimeString(),
        type: 'VERIFY',
        message: '✅ All integrity checks passed'
      }]);
    } else {
      issues.forEach(issue => {
        setEvents(e => [...e.slice(-19), {
          time: new Date().toLocaleTimeString(),
          type: 'ERROR',
          message: issue
        }]);
      });
    }
  };

  const clearEvents = () => {
    setEvents([]);
    eventCountRef.current = 0;
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsExpanded(true)}
          variant="outline"
          className="shadow-lg"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Debug ({eventCountRef.current} events)
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[600px] z-50 shadow-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Metrics Debugger</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Documents:</span>
            <Badge variant="outline">{documents.length}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Events:</span>
            <Badge variant="outline">{eventCountRef.current}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">User Match:</span>
            {cacheStatus.userMatch ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
          </div>
        </div>

        <div className="border-t pt-3 space-y-1">
          <div className="font-medium mb-2">Cache Status:</div>
          <div className="text-xs space-y-1 bg-muted p-2 rounded">
            <div>Size: {cacheStatus.cacheSize || 0}</div>
            <div>User: {cacheStatus.cachedUser?.slice(0, 8)}...</div>
            <div>Match: {cacheStatus.userMatch ? '✅' : '❌'}</div>
            {cacheStatus.wrongUserDocs > 0 && (
              <div className="text-red-600">
                Wrong User Docs: {cacheStatus.wrongUserDocs}
              </div>
            )}
            {cacheStatus.duplicates > 0 && (
              <div className="text-red-600">
                Duplicates: {cacheStatus.duplicates}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={verifyIntegrity}
            className="flex-1"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Verify
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearEvents}
            className="flex-1"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>

        <div className="border-t pt-3">
          <div className="font-medium mb-2">Event Log:</div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto bg-muted p-2 rounded">
            {events.length === 0 ? (
              <div className="text-muted-foreground text-center py-2">
                No events yet
              </div>
            ) : (
              events.map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">
                    {event.time}
                  </span>
                  <Badge
                    variant={
                      event.type === 'ERROR' ? 'destructive' :
                      event.type === 'VERIFY' ? 'default' :
                      'outline'
                    }
                    className="text-xs shrink-0"
                  >
                    {event.type}
                  </Badge>
                  <span className="break-all">{event.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t pt-3 text-xs text-muted-foreground">
          <div className="font-medium mb-1">Monitor for:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Unexpected count changes</li>
            <li>Documents from other users</li>
            <li>Duplicate documents</li>
            <li>Cache user mismatches</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
