import React, { useState, useEffect } from "react";
import { useResponsive } from "@/hooks/useResponsive";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { AdvancedDigitalSignature } from "@/components/signature/AdvancedDigitalSignature";
import { LiveMeetingRequestModal } from "@/components/meetings/LiveMeetingRequestModal";
import { FileViewer } from "@/components/documents/FileViewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Clock, FileText, User, Calendar, MessageSquare, Video, Eye, ChevronRight, CircleAlert, Undo2, SquarePen, AlertTriangle, Zap, Share2, CircleCheckBig } from "lucide-react";
import { DocumensoIntegration } from "@/components/documents/DocumensoIntegration";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ExternalNotificationDispatcher } from "@/services/ExternalNotificationDispatcher";
import { isUserInRecipients, findUserStepInWorkflow } from "@/utils/recipientMatching";
import { useSupabaseApprovals } from "@/hooks/useSupabaseApprovals";
import { approvalService } from "@/services/ApprovalService";
import { supabaseStorageService } from "@/services/SupabaseStorageService";
import isJpg from 'is-jpg';
import { format } from 'date-fns';

/** Escapes a string for safe inclusion as HTML text content (CWE-79 mitigation). */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? dateString : format(date, "dd MMM yyyy, hh:mm a");
};

const Approvals = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();

  // Use Supabase as the single source of truth
  const {
    approvalCards,
    approvalHistory: supabaseApprovalHistory,
    loading,
    error,
    commentsVersion,
    approveDocument,
    rejectDocument,
    refetch
  } = useSupabaseApprovals();

  const [showLiveMeetingModal, setShowLiveMeetingModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ id: string; type: string; title: string; assigneeIds?: string[] }>(
    { id: '', type: 'letter', title: '', assigneeIds: [] }
  );

  const [showDocumenso, setShowDocumenso] = useState(false);
  const [documensoDocument, setDocumensoDocument] = useState<any>(null);
  // Comments state - regular & shared comments persisted to Supabase approval_comments table
  const [comments, setComments] = useState<{ [key: string]: Array<{ id: string, author: string, date: string, message: string }> }>({});
  // Draft inputs kept in localStorage (ephemeral, allowed per rules)
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [sharedComments, setSharedComments] = useState<{ [key: string]: Array<{ id: string, comment: string, sharedBy: string, sharedFor: string, timestamp: string }> }>({});
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  const [viewingFile, setViewingFile] = useState<File | null>(null);
  const [viewingFiles, setViewingFiles] = useState<File[]>([]);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to card if hash exists in URL and cards are loaded
    if (approvalCards && approvalCards.length > 0 && location.hash) {
      const targetId = location.hash.substring(1);
      
      const timer1 = setTimeout(() => {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedCardId(targetId);
          
          // Remove highlight after exactly 3000ms
          const timer2 = setTimeout(() => {
            setHighlightedCardId(null);
          }, 3000);
          
          return () => clearTimeout(timer2);
        }
      }, 150); // slight delay to allow rendering and layout to settle
      
      return () => clearTimeout(timer1);
    }
  }, [location.hash, approvalCards]);

  // Sync Supabase approval history into local state
  useEffect(() => {
    if (supabaseApprovalHistory && supabaseApprovalHistory.length > 0) {
      setApprovalHistory(supabaseApprovalHistory);
    }
  }, [supabaseApprovalHistory]);

  // Load comments from Supabase for all visible approval cards — fetched concurrently
  const loadCommentsFromSupabase = async (cards: any[]) => {
    if (!cards || cards.length === 0) return;

    const results = await Promise.all(
      cards.map(async (card) => {
        try {
          const dbComments = await approvalService.getComments(card.id);
          return { id: card.id, dbComments };
        } catch (err) {
          console.warn('[Approvals] Failed to load comments for card:', String(card.id).replace(/[\r\n]/g, ' '), err);
          return { id: card.id, dbComments: [] };
        }
      })
    );

    const allComments: { [key: string]: Array<{ id: string, author: string, date: string, message: string }> } = {};
    const allShared: { [key: string]: Array<{ id: string, comment: string, sharedBy: string, sharedFor: string, timestamp: string }> } = {};

    for (const { id, dbComments } of results) {
      const regular = dbComments.filter((c: any) => !c.is_shared).map((c: any) => ({
        id: c.id,
        author: c.author_name,
        date: c.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        message: c.message,
      }));
      const shared = dbComments.filter((c: any) => c.is_shared).map((c: any) => ({
        id: c.id,
        comment: c.message,
        sharedBy: c.author_name,
        sharedFor: c.shared_for || 'all',
        timestamp: c.created_at || new Date().toISOString(),
      }));
      if (regular.length > 0) allComments[id] = regular;
      if (shared.length > 0) allShared[id] = shared;
    }

    setComments(allComments);
    setSharedComments(allShared);
  };

  useEffect(() => {
    // Load draft inputs from localStorage (ephemeral, allowed)
    const savedInputs = JSON.parse(localStorage.getItem('comment-inputs') || '{}');
    setCommentInputs(savedInputs);

    // Load comments from Supabase
    if (approvalCards && approvalCards.length > 0) {
      loadCommentsFromSupabase(approvalCards);
    }
  }, [user, approvalCards]);

  // Re-fetch comments when realtime notifies of a change (commentsVersion bumps)
  useEffect(() => {
    if (commentsVersion > 0 && approvalCards && approvalCards.length > 0) {
      loadCommentsFromSupabase(approvalCards);
    }
  }, [commentsVersion]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    navigate("/");
  };

  const handleAddComment = async (cardId: string) => {
    const comment = commentInputs[cardId]?.trim();
    if (comment && user) {
      // Optimistically update UI
      const tempId = `temp-${Date.now()}`;
      const newComment = {
        id: tempId,
        author: user.name || 'Reviewer',
        date: new Date().toISOString().split('T')[0],
        message: comment
      };
      setComments(prev => ({
        ...prev,
        [cardId]: [...(prev[cardId] || []), newComment]
      }));

      const clearedInputs = { ...commentInputs, [cardId]: '' };
      setCommentInputs(clearedInputs);
      localStorage.setItem('comment-inputs', JSON.stringify(clearedInputs));

      // Persist to Supabase
      try {
        await approvalService.addComment(cardId, user.id, user.name, comment, false);
        // Refresh comments from Supabase to get real IDs
        const dbComments = await approvalService.getComments(cardId);
        const regular = dbComments.filter((c: any) => !c.is_shared).map((c: any) => ({
          id: c.id, author: c.author_name,
          date: c.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          message: c.message,
        }));
        setComments(prev => ({ ...prev, [cardId]: regular }));
      } catch (err: any) {
        console.error('Failed to save comment to Supabase:', err);
        const detail = err?.message || err?.error_description || '';
        toast({ title: 'Error', description: `Failed to save comment.${detail ? ' ' + detail : ''}`, variant: 'destructive' });
      }
    }
  };

  const handleShareComment = async (cardId: string, doc?: any) => {
    const comment = commentInputs[cardId]?.trim();
    if (comment && user) {
      let nextRecipient = 'all';
      if (doc) {
        nextRecipient = getNextRecipient(doc);
      }

      // Optimistically update UI
      const tempId = `temp-${Date.now()}`;
      const sharedComment = {
        id: tempId,
        comment,
        sharedBy: user.name ?? 'Previous Approver',
        sharedFor: nextRecipient,
        timestamp: new Date().toISOString()
      };
      setSharedComments(prev => ({
        ...prev,
        [cardId]: [...(prev[cardId] || []), sharedComment]
      }));

      const clearedInputs = { ...commentInputs, [cardId]: '' };
      setCommentInputs(clearedInputs);
      localStorage.setItem('comment-inputs', JSON.stringify(clearedInputs));

      // Persist to Supabase
      try {
        await approvalService.addComment(cardId, user.id, user.name, comment, true, nextRecipient);
        // Refresh shared comments from Supabase
        const dbComments = await approvalService.getComments(cardId);
        const shared = dbComments.filter((c: any) => c.is_shared).map((c: any) => ({
          id: c.id, comment: c.message, sharedBy: c.author_name,
          sharedFor: c.shared_for || 'all', timestamp: c.created_at || new Date().toISOString(),
        }));
        setSharedComments(prev => ({ ...prev, [cardId]: shared }));
      } catch (err) {
        console.error('Failed to share comment to Supabase:', err);
        toast({ title: 'Error', description: 'Failed to share comment.', variant: 'destructive' });
      }

      toast({
        title: "Comment Shared",
        description: "Your comment will be visible only to the next recipients in the approval chain.",
      });
    }
  };

  const deleteCommentOptimistically = async (
    cardId: string,
    index: number,
    commentObj: any,
    setter: React.Dispatch<React.SetStateAction<any>>
  ): Promise<void> => {
    setter(prev => ({
      ...prev,
      [cardId]: prev[cardId]?.filter((_, i) => i !== index) || []
    }));

    if (commentObj?.id && !commentObj.id.startsWith('temp-')) {
      try {
        await approvalService.deleteComment(commentObj.id);
      } catch (err) {
        console.error('Failed to delete comment:', err);
      }
    }
  };

  const handleUndoComment = (cardId: string, index: number): Promise<void> =>
    deleteCommentOptimistically(cardId, index, comments[cardId]?.[index], setComments);

  const handleUndoSharedComment = (cardId: string, index: number): Promise<void> =>
    deleteCommentOptimistically(cardId, index, sharedComments[cardId]?.[index], setSharedComments);

  const editCommentToInput = (cardId: string, message: string): void => {
    const newInputs = { ...commentInputs, [cardId]: message };
    setCommentInputs(newInputs);
    localStorage.setItem('comment-inputs', JSON.stringify(newInputs));
  };

  const handleEditSharedComment = (cardId: string, index: number): void => {
    const comment = sharedComments[cardId]?.[index]?.comment;
    if (comment) {
      editCommentToInput(cardId, comment);
      handleUndoSharedComment(cardId, index);
    }
  };

  const handleEditComment = (cardId: string, index: number): void => {
    const message = comments[cardId]?.[index]?.message;
    if (message) {
      editCommentToInput(cardId, message);
      handleUndoComment(cardId, index);
    }
  };

  const createDocumentFile = (doc: any): File => {
    let filesToUse = doc.files || [];

    if (doc.fileAssignments && Object.keys(doc.fileAssignments).length > 0 && user) {
      const currentUserRole = user?.role?.toLowerCase() || '';
      const userRecipientId = doc.recipientIds?.find((id: string) =>
        id.toLowerCase().includes(currentUserRole)
      );

      filesToUse = doc.files.filter((file: any) => {
        const assignedRecipients = doc.fileAssignments[file.name];
        if (!assignedRecipients || assignedRecipients.length === 0) return true;
        return assignedRecipients.includes(userRecipientId);
      });
    }

    if (filesToUse && filesToUse.length > 0) {
      const fileData = filesToUse[0];

      // ── NEW: Supabase Storage path ──────────────────────────────────
      if (fileData.storage_path) {
        // Return a placeholder File; the caller (handleViewDocument) handles async fetch.
        // createDocumentFile is sync, so we return the HTML fallback here;
        // the async handlers (handleViewDocument / handleApproveSign) take priority.
        const blob = new Blob([`Supabase file: ${fileData.file_name || fileData.name}`], { type: 'text/plain' });
        return new File([blob], fileData.file_name || fileData.name || 'file', { type: fileData.file_type || fileData.type || 'application/octet-stream' });
      }

      // ── LEGACY: base64 data URL path ────────────────────────────────
      if (fileData.data) {
        // Convert base64 back to File
        const byteCharacters = atob(fileData.data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new File([byteArray], fileData.name, { type: fileData.type });
      }
    }

    // Fallback: generate an HTML preview from the document's metadata when no file data is available
    // All user-controlled values are HTML-escaped to prevent XSS (CWE-79).
    const emergencySection = doc.isEmergency
      ? '<div class="emergency"><strong>EMERGENCY DOCUMENT</strong><br>This document requires immediate attention.</div>'
      : '';
    const emergencyFeaturesSection = doc.emergencyFeatures
      ? `<div class="section">
    <h2>Emergency Features</h2>
    <ul>
      <li>Auto-escalation: ${doc.emergencyFeatures.autoEscalation ? 'Enabled' : 'Disabled'}</li>
      <li>Notification Settings: ${escapeHtml(doc.emergencyFeatures.notificationSettings)}</li>
      <li>Smart Delivery: ${doc.emergencyFeatures.smartDelivery ? 'Enabled' : 'Disabled'}</li>
    </ul>
  </div>`
      : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>${escapeHtml(doc.title)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    .info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .section { margin: 20px 0; }
    .emergency { background: #fee2e2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(doc.title)}</h1>
  ${emergencySection}
  <div class="info">
    <p><strong>Submitted by:</strong> ${escapeHtml(doc.submitter || doc.submittedBy)}</p>
    <p><strong>Date:</strong> ${escapeHtml(doc.submittedDate || doc.date)}</p>
    <p><strong>Type:</strong> ${escapeHtml(doc.type)}</p>
    <p><strong>Priority:</strong> ${escapeHtml(doc.priority)}</p>
  </div>
  <div class="section">
    <h2>Description</h2>
    <p>${escapeHtml(doc.description)}</p>
  </div>
  ${emergencyFeaturesSection}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const fileName = `${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    return new File([blob], fileName, { type: 'text/html' });
  };



  const handleViewDocument = async (doc: any) => {
    let filesToView = doc.files || [];

    if (doc.fileAssignments && Object.keys(doc.fileAssignments).length > 0 && user) {
      const currentUserRole = user?.role?.toLowerCase() || '';
      const userRecipientId = doc.recipientIds?.find((id: string) =>
        id.toLowerCase().includes(currentUserRole)
      );

      filesToView = doc.files.filter((file: any) => {
        const assignedRecipients = doc.fileAssignments[file.name];

        if (!assignedRecipients || assignedRecipients.length === 0) {
          return true;
        }

        return assignedRecipients.includes(userRecipientId);
      });
    }

    if (filesToView && filesToView.length > 0) {
      try {
        const reconstructedFiles: File[] = [];

        for (const file of filesToView) {
          const fileName = file.file_name || file.name || 'Unknown File';
          const fileType = file.file_type || file.type || 'application/octet-stream';

          // ── NEW: Supabase Storage path ──────────────────────────────
          if (file.storage_path) {
            try {
              console.log('🌐 [Approvals] Fetching from Supabase Storage:', fileName);
              const blob = await supabaseStorageService.downloadFile(file.storage_path);
              const storageFile = new File([blob], fileName, { type: blob.type || fileType });
              reconstructedFiles.push(storageFile);
              console.log('✅ [Approvals] File fetched from Storage:', fileName, storageFile.size, 'bytes');
              continue;
            } catch (storageErr) {
              console.warn('⚠️ [Approvals] Storage fetch failed, trying base64 fallback:', storageErr);
            }
          }

          // ── LEGACY: base64 data URL path ────────────────────────────
          const fileData = file.data || file;

          if (typeof fileData === 'string' && fileData.startsWith('data:')) {
            try {
              const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
              if (!matches) {
                throw new Error('Invalid data URL format');
              }

              const mimeType = matches[1] || fileType;
              const base64Data = matches[2];

              if (base64Data.startsWith('data:')) {
                const innerMatches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
                if (innerMatches) {
                  const realBase64 = innerMatches[2];
                  const binaryString = atob(realBase64);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
                  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                    if (!isJpg(bytes)) throw new Error(`Invalid JPEG file: ${fileName}.`);
                  }
                  reconstructedFiles.push(new File([new Blob([bytes], { type: mimeType })], fileName, { type: mimeType }));
                  continue;
                }
              }

              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }

              if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' ||
                fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
                if (!isJpg(bytes)) {
                  throw new Error(`Invalid JPEG file: ${fileName}. The file signature does not match JPEG format.`);
                }
              }

              reconstructedFiles.push(new File([new Blob([bytes], { type: mimeType })], fileName, { type: mimeType }));
            } catch (err) {
              console.error('Failed to reconstruct file:', fileName, err);
              toast({
                title: "File Error",
                description: `Failed to load ${fileName}: ${err instanceof Error ? err.message : 'Unknown error'}`,
                variant: "destructive"
              });
            }
          } else if (fileData instanceof File) {
            reconstructedFiles.push(fileData);
          }
        }

        if (reconstructedFiles.length === 0) {
          console.warn('No files could be reconstructed');
          toast({
            title: "No Files",
            description: "No valid files found to display",
            variant: "destructive"
          });
          return;
        } else if (reconstructedFiles.length > 1) {
          setViewingFiles(reconstructedFiles);
          setViewingFile(null);
        } else {
          setViewingFile(reconstructedFiles[0]);
          setViewingFiles([]);
        }
      } catch (error) {
        console.error('Error reconstructing files:', error);
        toast({
          title: "Error",
          description: `Failed to load files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
        return;
      }
    } else {
      const file = createDocumentFile(doc);
      setViewingFile(file);
      setViewingFiles([]);
    }

    setViewingDocument(doc);
    setShowDocumentViewer(true);
  };

  const handleApproveSign = async (doc: any) => {
    // Reconstruct all files assigned to the current user (same logic as handleViewDocument)
    // Covers documents from: Document Management, Emergency Management, Approval Chain with Bypass
    let filesToSign = doc.files || [];

    if (doc.fileAssignments && Object.keys(doc.fileAssignments).length > 0 && user) {
      const currentUserRole = user?.role?.toLowerCase() || '';
      const userRecipientId = doc.recipientIds?.find((id: string) =>
        id.toLowerCase().includes(currentUserRole)
      );
      filesToSign = doc.files.filter((file: any) => {
        const assignedRecipients = doc.fileAssignments[file.name];
        if (!assignedRecipients || assignedRecipients.length === 0) return true;
        return assignedRecipients.includes(userRecipientId);
      });
    }

    if (filesToSign && filesToSign.length > 0) {
      try {
        const reconstructedFiles: File[] = [];
        for (const fileEntry of filesToSign) {
          const fileName = fileEntry.file_name || fileEntry.name || 'Unknown File';
          const fileType = fileEntry.file_type || fileEntry.type || 'application/octet-stream';

          // ── NEW: Supabase Storage path ──────────────────────────────
          if (fileEntry.storage_path) {
            try {
              console.log('🌐 [Approvals/Sign] Fetching from Supabase Storage:', fileName);
              const blob = await supabaseStorageService.downloadFile(fileEntry.storage_path);
              reconstructedFiles.push(new File([blob], fileName, { type: blob.type || fileType }));
              console.log('✅ [Approvals/Sign] File fetched for signing:', fileName);
              continue;
            } catch (storageErr) {
              console.warn('⚠️ [Approvals/Sign] Storage fetch failed, trying base64 fallback:', storageErr);
            }
          }

          // ── LEGACY: base64 data URL path ────────────────────────────
          const fileData = fileEntry.data || fileEntry;
          if (typeof fileData === 'string' && fileData.startsWith('data:')) {
            try {
              const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
              if (!matches) continue;
              const mimeType = matches[1] || fileType;
              const base64Str = matches[2].startsWith('data:')
                ? (fileData.match(/^data:([^;]+);base64,(.+)$/) ?? [])[2]
                : matches[2];
              if (!base64Str) continue;
              const binaryString = atob(base64Str);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
              reconstructedFiles.push(new File([new Blob([bytes], { type: mimeType })], fileName, { type: mimeType }));
            } catch (err) {
              console.error('Failed to reconstruct file for signing:', fileName, err);
            }
          } else if (fileData instanceof File) {
            reconstructedFiles.push(fileData);
          }
        }

        if (reconstructedFiles.length > 0) {
          setDocumensoDocument({
            id: doc.id,
            title: doc.title,
            content: doc.description,
            type: doc.type,
          });

          if (reconstructedFiles.length === 1) {
            setViewingFile(reconstructedFiles[0]);
            setViewingFiles([]);
          } else {
            setViewingFiles(reconstructedFiles);
            setViewingFile(null);
          }
          setShowDocumenso(true);
          return;
        }
      } catch (error) {
        console.error('Error reconstructing files for signing:', error);
      }
    }

    // Fallback: generate HTML preview from document metadata
    const file = createDocumentFile(doc);
    setDocumensoDocument({
      id: doc.id,
      title: doc.title,
      content: doc.description,
      type: doc.type,
    });
    setViewingFile(file);
    setViewingFiles([]);
    setShowDocumenso(true);
  };

  if (!user) {
    return null; // This should be handled by ProtectedRoute, but adding as safety
  }


  const handleAcceptDocument = async (docId: string, skipPasskey?: boolean) => {
    try {
      const commentText = comments[docId]?.map(c => c.message).join(' ') || undefined;
      await approveDocument(docId, commentText, skipPasskey);
    } catch (error) {
      console.error('Failed to approve document:', error);
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve document",
        variant: "destructive"
      });
    }
  };

  const handleRejectDocument = async (docId: string) => {
    const userComments = comments[docId];
    if (!userComments || userComments.length === 0) {
      toast({
        title: "Comments Required",
        description: "Please provide comments before rejecting the document.",
        variant: "destructive"
      });
      return;
    }

    try {
      const reason = userComments.map(c => c.message).join(' ');
      await rejectDocument(docId, reason);
    } catch (error) {
      console.error('Failed to reject document:', error);
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : "Failed to reject document",
        variant: "destructive"
      });
    }
  };

  const isUserInRecipientsLocal = (_doc: any): boolean => {
    // ApprovalService.getPendingApprovals already filters by recipientId/assignee_id,
    // so all cards returned are already relevant to this user. No need to double-filter.
    return true;
  };

  // Helper function to check if current user should see a shared comment
  const shouldSeeSharedComment = (sharedFor: string): boolean => {
    if (!user) return false;
    if (!sharedFor) return false;

    // Orphaned comments were shared before a hard rejection — never display them
    if (sharedFor === 'orphaned') return false;

    // If shared for 'all', everyone can see it
    if (sharedFor === 'all') return true;

    const currentUserRole = (user.role || '').toLowerCase();
    const currentUserName = (user.name || '').toLowerCase();
    const sharedForLower = sharedFor.toLowerCase();

    // Return false if user info is incomplete
    if (!currentUserRole && !currentUserName) return false;

    // Check if the sharedFor matches current user's role or name
    const matches = (currentUserRole && sharedForLower.includes(currentUserRole)) ||
      (currentUserName && sharedForLower.includes(currentUserName)) ||
      (currentUserName && currentUserName.includes(sharedForLower)) ||
      (currentUserName && sharedForLower.replace(/\s+/g, '-').includes(currentUserName.replace(/\s+/g, '-')));

    return matches;
  };

  // Helper function to get the next recipient in the approval chain
  const getNextRecipient = (doc: any): string => {
    if (!user) return 'all';

    // Check if document has workflow structure
    if (doc.workflow && doc.workflow.steps) {
      const currentStepIndex = doc.workflow.steps.findIndex(
        (step: any) => step.status === 'current'
      );

      if (currentStepIndex !== -1 && currentStepIndex < doc.workflow.steps.length - 1) {
        const nextStep = doc.workflow.steps[currentStepIndex + 1];
        const nextRecipient = nextStep.name || nextStep.assignee || 'next-recipient';
        return nextRecipient;
      }
    }

    // Fallback: Check recipientIds array if no workflow
    if (doc.recipientIds && Array.isArray(doc.recipientIds)) {
      const currentUserRole = (user.role || '').toLowerCase();
      const currentUserName = (user.name || '').toLowerCase().replace(/\s+/g, '-');

      // Find current user's position in recipients array
      const userIndex = doc.recipientIds.findIndex((recipientId: string) => {
        const recipientLower = recipientId.toLowerCase();
        return (currentUserRole && recipientLower.includes(currentUserRole)) ||
          (currentUserName && recipientLower.includes(currentUserName));
      });

      if (userIndex !== -1 && userIndex < doc.recipientIds.length - 1) {
        const nextRecipientId = doc.recipientIds[userIndex + 1];
        return nextRecipientId;
      }
    }

    // Default to 'all' if next recipient cannot be determined
    return 'all';
  };

  // Helper function to check if current user is the last recipient in approval chain
  const isLastRecipient = (doc: any): boolean => {
    if (!user) return false;

    // Check if document has workflow structure
    if (doc.workflow && doc.workflow.steps) {
      const currentStepIndex = doc.workflow.steps.findIndex(
        (step: any) => step.status === 'current'
      );
      const isLastStep = currentStepIndex === doc.workflow.steps.length - 1;
      return isLastStep;
    }

    // Fallback: Check recipientIds array if no workflow
    if (doc.recipientIds && Array.isArray(doc.recipientIds)) {
      const currentUserRole = (user.role || '').toLowerCase();
      const currentUserName = (user.name || '').toLowerCase().replace(/\s+/g, '-');

      // Find current user's position in recipients array
      const userIndex = doc.recipientIds.findIndex((recipientId: string) => {
        const recipientLower = recipientId.toLowerCase();
        return recipientLower.includes(currentUserRole) || recipientLower.includes(currentUserName);
      });

      if (userIndex !== -1) {
        const isLast = userIndex === doc.recipientIds.length - 1;
        return isLast;
      }
    }

    // Default to false (show button) if structure is unclear
    return false;
  };

  // Determines the Share Comments button state based on the current workflow/document state.
  // Returns { visible, enabled, reason } to drive the three-state button UI.
  const getShareCommentState = (doc: any): { visible: boolean; enabled: boolean; reason?: string } => {
    // Hard rejection with no bypass: chain stopped, no next recipients will ever exist
    if (doc.status === 'rejected' && !doc.hasBypass) {
      return {
        visible: true,
        enabled: false,
        reason: 'The approval chain has ended due to rejection, and no further recipients are available.',
      };
    }
    // Last recipient: sharing was never applicable — hide silently
    if (isLastRecipient(doc)) {
      return { visible: false, enabled: false };
    }
    // Chain active (pending, or bypass-rejection that advanced the chain)
    return { visible: true, enabled: true };
  };

  // All approval data now comes from Supabase via useSupabaseApprovals hook
  // No localStorage event listeners needed - Supabase realtime handles updates
  const handleDocumensoComplete = (docId: string) => {
    // 1. Trigger backend approval, explicitly skipping passkey since it was already done in DocumensoIntegration
    handleAcceptDocument(docId, true).then(() => {
      // Force refresh to move card from Pending to History
      refetch();
    }).catch((err) => {
      console.error('Failed to complete approval after signing:', err);
    });
  };

  // Compute start of the current week (Monday 00:00) for "This Week" stats
  const getStartOfWeek = (): Date => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ...
    const diff = day === 0 ? 6 : day - 1; // days since Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const startOfWeek = getStartOfWeek();

  const isThisWeek = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d >= startOfWeek;
  };

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Approval Center</h1>
            <p className="text-muted-foreground">Review and approve pending documents with digital signatures</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-warning/10 rounded-lg">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvalCards.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Approvals</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-success/10 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvalHistory.filter(h => h.status === 'approved' && isThisWeek(h.approvedDate)).length}</p>
                  <p className="text-sm text-muted-foreground">Approved This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvalHistory.filter(h => h.status === 'rejected' && isThisWeek(h.rejectedDate)).length}</p>
                  <p className="text-sm text-muted-foreground">Rejected This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 h-auto">
            <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents Awaiting Your Approval</CardTitle>
                <CardDescription>Review and approve or reject pending documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">


                  {/* Error state — surfaces hidden errors instead of blank page */}
                  {error && !loading && (
                    <div className="text-center py-8 text-destructive">
                      <CircleAlert className="h-6 w-6 mx-auto mb-2" />
                      <p className="font-medium">Error loading approvals</p>
                      <p className="text-sm mt-1">{error}</p>
                    </div>
                  )}

                  {/* Empty state */}
                  {!loading && !error && approvalCards.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-6 w-6 mx-auto mb-2" />
                      <p>No pending approvals</p>
                      <p className="text-sm mt-1">Documents requiring your review will appear here.</p>
                    </div>
                  )}

                  {/* Approval cards */}
                  {!loading && !error && approvalCards.filter(doc => {
                    const isInRecipients = isUserInRecipientsLocal(doc);

                    if (!isInRecipients) {
                      return false;
                    }

                    // Unified filter: the service layer now sets step statuses
                    // correctly for all routing types. For parallel/bidirectional,
                    // all steps start as 'current'. For sequential, only
                    // the active step is 'current'. So checking status === 'current'
                    // is sufficient for all routing types.
                    if (doc.workflow?.steps) {
                      const userStep = findUserStepInWorkflow(
                        { name: user?.name, role: user?.role, department: user?.department, branch: user?.branch, recipientId: user?.recipientId },
                        doc.workflow.steps
                      );

                      if (userStep) {
                        return userStep.step.status === 'current';
                      }

                      // No matching step found — show card as fallback (may be a
                      // non-workflow document or a step with a mismatched assignee_id)
                      return true;
                    }

                    return true;
                  })
                    .filter((doc, index, self) =>
                      index === self.findIndex((d) => d.id === doc.id)
                    )
                    .map((doc) => (
                      <Card id={doc.id} key={doc.id} className={`hover:shadow-md transition-all duration-500 ${doc.id === highlightedCardId ? 'ring-2 ring-primary ring-offset-2 scale-[1.01] shadow-lg' : ''} ${doc.isEmergency ? 'border-destructive bg-red-50 animate-pulse' : ''}`}>
                        <CardContent className="p-6">
                          <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-1 space-y-4">
                              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="w-full sm:w-auto">
                                  <h3 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                                    {doc.title}
                                    {doc.isEmergency && (
                                      <Badge variant="destructive" className="text-xs">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        EMERGENCY
                                      </Badge>
                                    )}
                                    {(() => {
                                      // Check if this document has escalation (from Supabase workflow data)
                                      const escalationLevel = doc.workflow?.escalationLevel || 0;

                                      if (escalationLevel > 0) {
                                        return (
                                          <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-700">
                                            <Zap className="w-3 h-3 mr-1" />
                                            Escalated {escalationLevel}x
                                          </Badge>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <FileText className="h-4 w-4" />
                                      {doc.type}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <User className="h-4 w-4" />
                                      {doc.submitter}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {formatDateTime(doc.submittedDate)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                  <Clock className="h-4 w-4 text-yellow-600" />
                                  <Badge variant="warning">Pending</Badge>
                                  <Badge variant="outline" className={`${doc.priority === 'high' || doc.priority === 'critical' ? 'text-orange-600 font-semibold' :
                                    doc.priority === 'medium' || doc.priority === 'urgent' ? 'text-yellow-600' :
                                      'text-blue-600'
                                    }`}>
                                    {doc.priority === 'high' || doc.priority === 'critical' ? 'High Priority' :
                                      doc.priority === 'medium' || doc.priority === 'urgent' ? 'Medium Priority' :
                                        'Normal Priority'}
                                  </Badge>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="text-sm font-medium">Description</span>
                                </div>
                                <div className="bg-muted p-3 rounded text-sm">
                                  <p>{doc.description}</p>
                                </div>
                              </div>

                              {(() => {
                                // Use workflow data from Supabase approval card directly
                                const escalationLevel = doc.workflow?.escalationLevel || 0;

                                if (doc.isEmergency || escalationLevel > 0) {
                                  return (
                                    <div className="flex items-center gap-2 p-2 bg-warning/10 rounded border border-warning/20">
                                      <Zap className="w-4 h-4 text-warning" />
                                      <span className="text-sm font-medium text-warning">
                                        Action Required
                                      </span>
                                      {escalationLevel > 0 && (
                                        <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-700">
                                          Escalated {escalationLevel}x
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {sharedComments[doc.id]?.filter(s => shouldSeeSharedComment(s.sharedFor) && s.sharedBy !== user?.name).length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">Comment Shared by Previous Recipient</span>
                                  </div>
                                  <div className="space-y-2">
                                    {sharedComments[doc.id].filter(s => shouldSeeSharedComment(s.sharedFor) && s.sharedBy !== user?.name).map((shared, index) => (
                                      <div key={index} className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm">
                                        <p className="text-blue-800">{shared.comment}</p>
                                        <p className="text-xs text-blue-600 mt-1">â€” {shared.sharedBy}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {sharedComments[doc.id]?.filter(s => s.sharedBy === user?.name).length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">Share Comment with Next Recipient(s)</span>
                                  </div>
                                  <div className="space-y-2">
                                    {sharedComments[doc.id].filter(s => s.sharedBy === user?.name).map((shared, index) => (
                                      <div key={index} className={`bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-start'}`}>
                                        <div className="flex-1">
                                          <p className="text-blue-800">{shared.comment}</p>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                          <button
                                            className="px-2 py-1 sm:px-4 sm:py-2 bg-blue-200 rounded-full flex items-center justify-center hover:bg-blue-300 transition-colors"
                                            onClick={() => {
                                              const originalIndex = sharedComments[doc.id].findIndex(s => s.comment === shared.comment && s.timestamp === shared.timestamp);
                                              handleEditSharedComment(doc.id, originalIndex);
                                            }}
                                            title="Edit"
                                          >
                                            <SquarePen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-700" />
                                          </button>
                                          <button
                                            className="px-2 py-1 sm:px-4 sm:py-2 bg-blue-200 rounded-full flex items-center justify-center hover:bg-blue-300 transition-colors"
                                            onClick={() => {
                                              const originalIndex = sharedComments[doc.id].findIndex(s => s.comment === shared.comment && s.timestamp === shared.timestamp);
                                              handleUndoSharedComment(doc.id, originalIndex);
                                            }}
                                            title="Undo"
                                          >
                                            <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-700" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {comments[doc.id]?.filter(c => c.author === user?.name).length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    <span className="text-sm font-medium">Your Comments</span>
                                  </div>
                                  <div className="space-y-2">
                                    {comments[doc.id].filter(c => c.author === user?.name).map((commentObj, index) => (
                                      <div key={index} className={`bg-muted p-3 rounded-lg text-sm flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-start'}`}>
                                        <div className="flex-1">
                                          <p>{commentObj.message}</p>
                                          <p className="text-xs text-muted-foreground mt-1">{commentObj.date}</p>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                          <button
                                            className="px-2 py-1 sm:px-4 sm:py-2 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                                            onClick={() => {
                                              const originalIndex = comments[doc.id].findIndex(c => c.message === commentObj.message && c.date === commentObj.date);
                                              handleEditComment(doc.id, originalIndex);
                                            }}
                                            title="Edit"
                                          >
                                            <SquarePen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                                          </button>
                                          <button
                                            className="px-2 py-1 sm:px-4 sm:py-2 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                                            onClick={() => {
                                              const originalIndex = comments[doc.id].findIndex(c => c.message === commentObj.message && c.date === commentObj.date);
                                              handleUndoComment(doc.id, originalIndex);
                                            }}
                                            title="Undo"
                                          >
                                            <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {!comments[doc.id]?.length && (
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="text-sm font-medium">Your Comments</span>
                                </div>
                              )}

                              <div className="space-y-2">
                                <div className={`flex border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-colors bg-white ${isMobile ? 'flex-col' : 'items-start'}`}>
                                  <textarea
                                    className={`flex-1 min-h-[40px] p-3 border-0 resize-none text-base sm:text-sm focus:outline-none bg-white ${isMobile ? '' : 'rounded-l-lg'}`}
                                    placeholder="Add your comment..."
                                    rows={1}
                                    style={{ resize: 'none' }}
                                    value={commentInputs[doc.id] || ''}
                                    onChange={(e) => {
                                      const newInputs = { ...commentInputs, [doc.id]: e.target.value };
                                      setCommentInputs(newInputs);
                                      localStorage.setItem('comment-inputs', JSON.stringify(newInputs));
                                    }}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = target.scrollHeight + 'px';
                                    }}
                                  />
                                  <div className={`flex gap-1 m-2 ${isMobile ? 'self-end' : ''}`}>
                                    <button
                                      className={`${isMobile ? "px-1 py-1" : "px-3 py-2"} bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors`}
                                      title="Send comment"
                                      onClick={() => handleAddComment(doc.id)}
                                    >
                                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                                    </button>
                                    {(() => {
                                      const shareState = getShareCommentState(doc);
                                      if (!shareState.visible) return null;
                                      if (shareState.enabled) {
                                        return (
                                          <button
                                            className={`${isMobile ? "px-1 py-1" : "px-3 py-2"} bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors`}
                                            title="Share comment with next recipient(s)"
                                            onClick={() => handleShareComment(doc.id, doc)}
                                          >
                                            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                                          </button>
                                        );
                                      }
                                      return (
                                        <div
                                          className="flex flex-col gap-0.5 items-start"
                                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                        >
                                          <button
                                            disabled
                                            className={`${isMobile ? "px-1 py-1" : "px-3 py-2"} bg-gray-100 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed`}
                                            title={shareState.reason}
                                          >
                                            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                                          </button>
                                          <div className="text-xs text-gray-500 leading-tight max-w-[180px]">
                                            <p><span className="font-medium">Share Comments</span> <span className="text-gray-400">(Disabled)</span></p>
                                            <p className="mt-0.5 font-medium">Reason:</p>
                                            <p>The approval chain has ended due to rejection, and no further recipients are available.</p>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 w-full sm:w-auto min-w-[150px]">
                              <Button variant="outline" size="sm" onClick={() => handleViewDocument(doc)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-orange-500 text-orange-600 hover:bg-orange-50"
                                onClick={() => {
                                  setSelectedDocument({
                                    id: doc.id,
                                    type: doc.type.toLowerCase(),
                                    title: doc.title,
                                    // Collect workflow assignee IDs (excluding the current user)
                                    // so the modal scopes recipients to this card's approval chain.
                                    assigneeIds: (doc.workflow?.steps ?? [])
                                      .map((s: any) => s.assigneeId)
                                      .filter((id: string | undefined) => id && id !== user?.recipientId),
                                  });
                                  setShowLiveMeetingModal(true);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="relative w-4 h-4">
                                    <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full"></div>
                                    <div className="absolute inset-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                  </div>
                                  LiveMeet+
                                </div>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApproveSign(doc)}
                              >
                                <CircleCheckBig className="h-4 w-4 mr-2" />
                                Approve & Sign
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRejectDocument(doc.id)}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}



                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Approval History</CardTitle>
                <CardDescription>View your recent approval activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {approvalHistory
                    .filter((doc, index, self) =>
                      index === self.findIndex((d) => d.id === doc.id)
                    ).map((doc) => {
                      // Check if this is an emergency card (data-driven, no hardcoded titles)
                      const isEmergency = doc.isEmergency || doc.priority === 'emergency';

                      return (
                        <Card id={doc.id} key={doc.id} className={`relative hover:shadow-md transition-shadow ${isEmergency ? 'border-destructive bg-red-50' : ''}`}>
                          <CardContent className="p-6">

                            <div className="flex flex-col lg:flex-row gap-6">
                              <div className="flex-1 space-y-4">
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                  <div className="w-full sm:w-auto">
                                    <h3 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                                      {doc.title}
                                      {isEmergency && (
                                        <Badge variant="destructive" className="text-xs animate-pulse">
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          EMERGENCY
                                        </Badge>
                                      )}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        {doc.type}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <User className="h-4 w-4" />
                                        {doc.submitter}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        {formatDateTime(doc.submittedDate)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                    {doc.status === "approved" ? (
                                      <>
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <Badge variant="destructive">Rejected</Badge>
                                      </>
                                    )}
                                    <Badge variant="outline" className={
                                      doc.priority === "high" ? "text-orange-600 font-semibold" :
                                        doc.priority === "medium" ? "text-yellow-600" :
                                          doc.priority === "emergency" ? "text-red-600 font-semibold" :
                                            "text-blue-600"
                                    }>
                                      {(doc.priority || 'medium').charAt(0).toUpperCase() + (doc.priority || 'medium').slice(1) + ' Priority'}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    <span className="text-sm font-medium">Description</span>
                                  </div>
                                  <div className="bg-muted p-3 rounded text-sm">
                                    <p>{doc.description}</p>
                                  </div>
                                </div>

                                {/* Shared comments from previous recipients - loaded from Supabase approval_comments table */}
                                {sharedComments[doc.id] && sharedComments[doc.id].filter(sc => shouldSeeSharedComment(sc.sharedFor)).length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1">
                                      <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                                      <span className="text-sm font-medium text-blue-700">Comment Shared by Previous Recipient</span>
                                    </div>
                                    {sharedComments[doc.id].filter(sc => shouldSeeSharedComment(sc.sharedFor)).map(sc => (
                                      <div key={sc.id} className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm">
                                        <p className="text-blue-800">{sc.comment}</p>
                                        <p className="text-xs text-blue-600 mt-1">{sc.sharedBy}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    <span className="text-sm font-medium">Your Comments</span>
                                  </div>
                                  <div className="bg-muted p-3 rounded text-sm">
                                    <p>{doc.comment}</p>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-sm font-medium">Status Details</span>
                                  </div>
                                  <div className="bg-muted p-3 rounded text-sm">
                                    {doc.status === "approved" ? (
                                      <p>Approved by {doc.approvedBy} on {formatDateTime(doc.approvedDate)}</p>
                                    ) : (
                                      <p>Rejected by {doc.rejectedBy} on {formatDateTime(doc.rejectedDate)}</p>
                                    )}
                                  </div>
                                </div>


                              </div>
                              <div className="flex flex-col gap-2 w-full sm:w-auto min-w-[150px]">
                                {doc.status === "approved" ? (
                                  <Button variant="outline" size="sm" className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100">
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approved
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100">
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Rejected
                                  </Button>
                                )}

                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <LiveMeetingRequestModal
          isOpen={showLiveMeetingModal}
          onClose={() => setShowLiveMeetingModal(false)}
          documentId={selectedDocument.id}
          documentType={selectedDocument.type as 'letter' | 'circular' | 'report'}
          documentTitle={selectedDocument.title}
          assigneeIds={selectedDocument.assigneeIds}
        />

        {documensoDocument && (
          <DocumensoIntegration
            isOpen={showDocumenso}
            onClose={() => {
              setShowDocumenso(false);
              setDocumensoDocument(null);
            }}
            onComplete={() => handleDocumensoComplete(documensoDocument.id)}
            document={documensoDocument}
            user={{
              name: user?.name || 'User',
              email: user?.email || 'user@university.edu',
              role: user?.role || 'Employee'
            }}
            file={viewingFile || undefined}
            files={viewingFiles.length > 0 ? viewingFiles : undefined}
          />
        )}

        <FileViewer
          file={viewingFile}
          files={viewingFiles.length > 0 ? viewingFiles : undefined}
          open={showDocumentViewer}
          onOpenChange={setShowDocumentViewer}
        />
      </div>
    </ResponsiveLayout>
  );
};

export default Approvals;
