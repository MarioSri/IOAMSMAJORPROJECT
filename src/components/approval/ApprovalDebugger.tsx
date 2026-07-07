import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { approvalService } from '@/services/ApprovalService';

interface PendingApproval {
  id: string;
  title: string;
  type?: string;
  submitter?: string;
  submittedDate?: string;
  priority?: string;
  description?: string;
  recipients?: string[];
  recipientIds?: string[];
  isEmergency?: boolean;
  isParallel?: boolean;
  source?: string;
  workflow?: {
    steps: Array<{ assignee: string; assigneeId?: string; status: string }>;
  };
}

export const ApprovalDebugger: React.FC = () => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const loadApprovalCards = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch from Supabase via ApprovalService
      const workflows = await approvalService.getPendingApprovals(user.id, user.role, user.recipientId);

      const cards: PendingApproval[] = workflows.map((workflow: any) => ({
        id: workflow.document?.id || workflow.id,
        title: workflow.document?.title || 'Unknown',
        type: workflow.document?.type,
        submitter: workflow.document?.submitter_name,
        submittedDate: workflow.document?.submitted_date,
        priority: workflow.document?.priority,
        description: workflow.document?.description,
        recipients: workflow.document?.recipients,
        recipientIds: workflow.document?.recipient_ids,
        isEmergency: workflow.document?.is_emergency,
        isParallel: workflow.is_parallel,
        source: workflow.source,
        workflow: {
          steps: (workflow.steps || []).map((s: any) => ({
            assignee: s.assignee,
            assigneeId: s.assignee_id,
            status: s.status,
          })),
        },
      }));

      setPendingApprovals(cards);

      let info = `Debug Information (Supabase):\n`;
      info += `Current User: ${user?.name} (${user?.role})\n`;
      info += `Recipient ID: ${user?.recipientId || 'N/A'}\n`;
      info += `Total Workflows Found: ${cards.length}\n\n`;

      cards.forEach((doc, index) => {
        info += `${index + 1}. "${doc.title}"\n`;
        info += `   Recipients: ${JSON.stringify(doc.recipients || [])}\n`;
        info += `   Recipient IDs: ${JSON.stringify(doc.recipientIds || [])}\n`;
        info += `   Source: ${doc.source || 'N/A'}\n`;
        info += `   Is Parallel: ${doc.isParallel || false}\n`;
        info += `   Steps: ${doc.workflow?.steps?.map(s => `${s.assignee}(${s.status})`).join(', ')}\n\n`;
      });

      setDebugInfo(info);
    } catch (err) {
      setDebugInfo(`Error loading from Supabase: ${err}`);
    }
  }, [user]);

  useEffect(() => {
    loadApprovalCards();
  }, [loadApprovalCards]);

  const createTestCard = () => {
    // Test card creation is no longer supported via localStorage
    // Use the Document Management page to create real documents
    console.log('[ApprovalDebugger] Test card creation disabled - use Document Management instead');
  };

  const clearTestCards = () => {
    // No localStorage to clear - data is in Supabase
    console.log('[ApprovalDebugger] Clear test cards disabled - data is managed via Supabase');
    loadApprovalCards();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Approval Cards Debugger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={loadApprovalCards} variant="outline">
            Refresh
          </Button>
          <Button onClick={createTestCard} variant="outline">
            Create Test Card
          </Button>
          <Button onClick={clearTestCards} variant="outline">
            Clear Test Cards
          </Button>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <pre className="text-sm whitespace-pre-wrap">{debugInfo}</pre>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Pending Approvals (from Supabase):</h3>
          {pendingApprovals.map((doc) => {
            return (
              <Card key={doc.id} className="border-green-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{doc.title}</h4>
                      <p className="text-sm text-gray-600">ID: {doc.id}</p>
                      <p className="text-sm text-gray-600">Recipients: {JSON.stringify(doc.recipients || [])}</p>
                      <p className="text-sm text-gray-600">Recipient IDs: {JSON.stringify(doc.recipientIds || [])}</p>
                      <p className="text-sm text-gray-600">Steps: {doc.workflow?.steps?.map(s => `${s.assignee}(${s.status})`).join(', ')}</p>
                    </div>
                    <Badge variant="default">MATCHED</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApprovalDebugger;