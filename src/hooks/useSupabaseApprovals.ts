import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { approvalService } from '@/services/ApprovalService';
import { useToast } from './use-toast';
import { useVisibilityRefetch } from './useVisibilityRefetch';
import {
  authenticatePasskey,
  verifyBackupCode,
  listCredentials,
} from '@/services/WebAuthnService';

// ─── Cache helpers ────────────────────────────────────────────────────────────
const CACHE_CARDS_KEY = 'approvals-cards-cache';
const CACHE_HISTORY_KEY = 'approvals-history-cache';
const CACHE_TS_KEY = 'approvals-cache-ts';
/** Cache is considered fresh for 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

function readCache<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function isCacheFresh(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(CACHE_TS_KEY) || '0') < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function writeCache(cards: any[], history: any[]): void {
  try {
    localStorage.setItem(CACHE_CARDS_KEY, JSON.stringify(cards.slice(0, 100)));
    localStorage.setItem(CACHE_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch (e) {
    console.warn('[useSupabaseApprovals] Cache write failed:', e);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export function useSupabaseApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Initialise from cache so the first render already has data ──
  const [approvalCards, setApprovalCards] = useState<any[]>(() => readCache(CACHE_CARDS_KEY));
  const [approvalHistory, setApprovalHistory] = useState<any[]>(() => readCache(CACHE_HISTORY_KEY));

  // Only block the UI when there is truly nothing cached to show
  const [loading, setLoading] = useState(
    () => readCache(CACHE_CARDS_KEY).length === 0 && readCache(CACHE_HISTORY_KEY).length === 0
  );
  const [error, setError] = useState<string | null>(null);
  const [commentsVersion, setCommentsVersion] = useState(0);
  // WebAuthn gate state
  const [approveStatus, setApproveStatus] = useState<string>('');

  // Prevent overlapping fetches triggered by rapid realtime events
  const fetchingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch pending approvals ──────────────────────────────────────
  const fetchApprovals = useCallback(async (): Promise<any[]> => {
    if (!user) return [];

    if (!user.recipientId) {
      console.warn(
        '[useSupabaseApprovals] user.recipientId is undefined. ' +
        'ApprovalService will attempt self-healing resolution via role_recipients.supabase_uid.'
      );
    }

    const workflows = await approvalService.getPendingApprovals(user.id, user.role, user.recipientId);

    return workflows.map((workflow: any) => ({
      id: workflow.document.id,
      title: workflow.document.title,
      type: workflow.document.type,
      submitter: workflow.document.submitter_name,
      submittedBy: workflow.document.submitter_name,
      submittedDate: workflow.document.submitted_date?.split('T')[0] ?? '',
      date: workflow.document.submitted_date?.split('T')[0] ?? '',
      status: workflow.document.status,
      priority: workflow.document.priority,
      description: workflow.document.description,
      isEmergency: workflow.document.is_emergency,
      files: workflow.document.files,
      signedFileUrls: workflow.document.signed_file_urls ?? workflow.document.signedFileUrls ?? [],
      signatureMetadata: workflow.document.signature_metadata ?? workflow.document.signatureMetadata ?? [],
      fileAssignments: workflow.document.file_assignments,
      recipientIds: workflow.document.recipient_ids,
      recipients: workflow.document.recipients,
      trackingCardId: workflow.document.id,
      supabaseId: workflow.document.id,
      routingType: workflow.routing_type,
      isParallel: workflow.is_parallel,
      hasBypass: workflow.has_bypass,
      source: workflow.source,
      workflow: {
        currentStep: workflow.current_step,
        progress: workflow.progress,
        escalationLevel: workflow.escalation_level,
        bypassedRecipients: workflow.bypassed_recipients,
        steps: workflow.steps.map((s: any) => ({
          name: s.name,
          assignee: s.assignee,
          assigneeId: s.assignee_id,
          status: s.status,
          completedDate: s.completed_date,
          rejectedDate: s.rejected_date,
          rejectedBy: s.rejected_by,
          bypassReason: s.bypass_reason,
          escalated: s.escalated ?? false,
          escalationLevel: s.escalation_level ?? 0,
          escalatedAt: s.escalated_at ?? null,
        })),
      },
    }));
  }, [user]);

  // ── Fetch approval history ───────────────────────────────────────
  const fetchHistory = useCallback(async (): Promise<any[]> => {
    if (!user) return [];

    const history = await approvalService.getApprovalHistory(user.id);
    return history.map((h: any) => ({
      id: h.document.id,
      title: h.document.title,
      type: h.document.type,
      submitter: h.document.submitter_name,
      submittedDate: h.document.submitted_date?.split('T')[0] ?? '',
      status: h.action,
      priority: h.document.priority,
      description: h.document.description,
      signedFileUrls: h.document.signed_file_urls ?? h.document.signedFileUrls ?? [],
      signatureMetadata: h.document.signature_metadata ?? h.document.signatureMetadata ?? [],
      approvedBy: h.action === 'approved' ? h.approver_name : undefined,
      approvedDate: h.action === 'approved' ? h.action_date : undefined,
      rejectedBy: h.action === 'rejected' ? h.approver_name : undefined,
      rejectedDate: h.action === 'rejected' ? h.action_date : undefined,
      comment: h.comment,
    }));
  }, [user]);

  // ── Combined refresh — both fetches run in parallel ──────────────
  const refreshAll = useCallback(async (silent = false) => {
    if (!user) return;
    if (fetchingRef.current) {
      console.log('[useSupabaseApprovals] Fetch already in progress, skipping');
      return;
    }
    fetchingRef.current = true;

    // Only show the full loading indicator on a cold-start with empty cache
    if (!silent && approvalCards.length === 0 && approvalHistory.length === 0) {
      setLoading(true);
    }

    try {
      // ❶ Fetch cards and history concurrently
      const [cards, history] = await Promise.all([fetchApprovals(), fetchHistory()]);

      setApprovalCards(cards);
      setApprovalHistory(history);
      setError(null);
      writeCache(cards, history);
    } catch (err) {
      console.error('[useSupabaseApprovals] Refresh error:', err);
      // Only surface the error when nothing is visible
      if (approvalCards.length === 0 && approvalHistory.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to fetch approvals');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, fetchApprovals, fetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced version for real-time events
  const debouncedRefreshAll = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      refreshAll(true);
    }, 500); // Wait 500ms before refreshing
  }, [refreshAll]);

  // Re-fetch approvals whenever user returns to the tab.
  useVisibilityRefetch(useCallback(() => refreshAll(true), [refreshAll]), !!user);

  // ── Approve (with WebAuthn gate) ────────────────────────────────
  const approveDocument = useCallback(async (documentId: string, comment?: string, skipPasskey?: boolean) => {
    if (!user) throw new Error('User not authenticated');

    // Check whether this user has any active passkeys
    let credentials: any[] = [];
    try {
      credentials = await listCredentials();
    } catch {
      // If check fails, fall through to standard approval
    }

    if (!skipPasskey && credentials.length > 0) {
      // Passkeys registered — require biometric verification
      setApproveStatus('Verifying identity…');
      try {
        await authenticatePasskey('approval', documentId);
      } catch (biometricErr: any) {
        // Biometric failed — prompt for backup code via a simple browser prompt
        // (The inline BackupCodeEntry UI is used in the Approvals page component)
        const backupCode = window.prompt(
          'Biometric verification failed.\n\nEnter a backup recovery code to proceed:'
        );

        if (!backupCode) {
          setApproveStatus('Verification cancelled — approval blocked.');
          toast({
            title: 'Approval blocked',
            description: 'Identity verification is required to approve documents.',
            variant: 'destructive',
          });
          return;
        }

        try {
          await verifyBackupCode(backupCode);
        } catch (codeErr: any) {
          setApproveStatus('Invalid backup code — approval blocked.');
          toast({
            title: 'Invalid backup code',
            description: codeErr.message,
            variant: 'destructive',
          });
          return;
        }
      }
      setApproveStatus('');
    }

    // ── Existing approval logic — completely unchanged ────────────
    await approvalService.approveDocument(documentId, user.id, user.name, comment, user.recipientId);

    refreshAll(true);

    toast({
      title: 'Document Approved',
      description: 'Document has been approved successfully',
    });
  }, [user, refreshAll, toast]);

  // ── Reject ───────────────────────────────────────────────────────
  const rejectDocument = useCallback(async (documentId: string, reason: string) => {
    if (!user) throw new Error('User not authenticated');

    const prevCards = [...approvalCards];
    const prevHistory = [...approvalHistory];

    // Optimistic update
    setApprovalCards(cards => cards.filter(c => c.id !== documentId));

    try {
      await approvalService.rejectDocument(documentId, user.id, user.name, reason, user.recipientId);

      // Invalidate cache
      localStorage.removeItem(CACHE_CARDS_KEY);
      localStorage.removeItem(CACHE_HISTORY_KEY);
      localStorage.removeItem(CACHE_TS_KEY);

      // Wait for DB commit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh from DB
      await refreshAll(true);

      toast({
        title: 'Document Rejected',
        description: 'Document has been rejected',
        variant: 'destructive',
      });
    } catch (err) {
      // Revert on error
      setApprovalCards(prevCards);
      setApprovalHistory(prevHistory);
      writeCache(prevCards, prevHistory);
      throw err;
    }
  }, [user, approvalCards, approvalHistory, refreshAll, toast]);

  // ── Initial fetch + real-time subscriptions ──────────────────────
  useEffect(() => {
    if (!user) return;

    // Silent if cache is warm, visible only on cold start
    const cacheIsUsable = (
      readCache(CACHE_CARDS_KEY).length > 0 || readCache(CACHE_HISTORY_KEY).length > 0
    ) && isCacheFresh();

    refreshAll(!cacheIsUsable ? false : true);

    const silentRefreshAll = () => debouncedRefreshAll();
    const silentRefreshHistory = async () => {
      if (fetchingRef.current) return;
      try {
        const history = await fetchHistory();
        setApprovalHistory(history);
        writeCache(readCache(CACHE_CARDS_KEY), history);
      } catch {
        // swallow — cached data stays visible
      }
    };

    // 1. documents → re-fetch cards (only for documents where user is a recipient)
    // Note: We subscribe to all document changes but filter in the handler
    const documentsChannel = supabase
      .channel('approvals-documents-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'documents'
      }, (payload: any) => {
        // Only refresh if this document involves the current user as a recipient
        const doc = (payload.new || payload.old) as { recipient_ids?: string[] } | null;
        if (doc?.recipient_ids && Array.isArray(doc.recipient_ids)) {
          const isRecipient = doc.recipient_ids.includes(user.recipientId) || 
                             doc.recipient_ids.some((id: string) => id === user.recipientId);
          if (isRecipient) {
            console.log('[useSupabaseApprovals] Document change affects user, refreshing');
            silentRefreshAll();
          }
        }
      })
      .subscribe();

    // 2. document_workflows → re-fetch cards
    const workflowsChannel = supabase
      .channel('approvals-workflows-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_workflows' }, silentRefreshAll)
      .subscribe();

    // 3. workflow_steps → re-fetch cards
    const stepsChannel = supabase
      .channel('approvals-steps-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_steps' }, silentRefreshAll)
      .subscribe();

    // 4. document_approvals → re-fetch history only (cheaper)
    const approvalsChannel = supabase
      .channel('approvals-history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_approvals' }, silentRefreshHistory)
      .subscribe();

    // 5. approval_comments → bump version so Approvals.tsx re-fetches comments
    const commentsChannel = supabase
      .channel('approvals-comments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_comments' }, () => {
        setCommentsVersion(v => v + 1);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Approvals] Realtime channel error, refetching...');
          setTimeout(() => refreshAll(true), 2000);
        }
      });

    // Safety-net focus handler — dual guard alongside visibilitychange.
    const handleFocus = () => refreshAll(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      documentsChannel.unsubscribe();
      workflowsChannel.unsubscribe();
      stepsChannel.unsubscribe();
      approvalsChannel.unsubscribe();
      commentsChannel.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    approvalCards,
    approvalHistory,
    loading,
    error,
    commentsVersion,
    approveDocument,
    rejectDocument,
    approveStatus,
    refetch: () => refreshAll(false),
    refetchHistory: () => fetchHistory().then(h => setApprovalHistory(h)),
  };
}
