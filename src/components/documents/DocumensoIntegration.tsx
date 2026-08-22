/**
 * DocumensoIntegration — Refactored Orchestrator
 * ════════════════════════════════════════════════
 * Architecture: Thin orchestrator pattern (Documenso-inspired).
 *
 * This file owns ONLY:
 *  - Modal shell + tab navigation
 *  - Supabase data loading / real-time subscription (unchanged)
 *  - WebAuthn / Passkey gate (unchanged — UNTOUCHED)
 *  - handleSign signing flow (unchanged)
 *  - FileViewer integration (unchanged)
 *
 * All heavy lifting delegated to:
 *  - useSignatureEngine  ← placement, drag, resize, rotate
 *  - useDocumentLoader   ← file parsing (PDF, Word, Excel, Image)
 *  - DocumentViewer      ← professional preview + overlays
 *  - SignatureCanvas      ← draw pad (Adobe ink extraction applied)
 *  - SignatureUpload      ← image upload (Adobe ink extraction applied)
 *  - FieldOverlay         ← reusable overlay (replaces ~500-line duplication)
 *  - FieldPalette         ← drag-and-drop field picker
 *  - AdobeRenderEngine   ← ink extraction, paper-blend, multiply
 *  - SignatureMerger      ← merge signatures into output files
 *  - DocumentFingerprint  ← SHA-256 tamper detection
 *  - AuditLogger          ← compliance event trail
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { authenticatePasskey, verifyBackupCode, listCredentials } from '@/services/WebAuthnService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, FileText, PenTool, User, Download, Upload, Eye,
  Signature, Lock, Mail, Loader2, ChevronLeft, ChevronRight,
  Fingerprint, LayoutGrid, ZoomIn, ZoomOut, RotateCw, ShieldCheck, X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FileViewer } from '@/components/documents/FileViewer';
import { supabase } from '@/lib/supabase';
import { PiSignatureFill } from "react-icons/pi";
import { LiaAddressCardSolid, LiaFileSignatureSolid } from 'react-icons/lia';

// ── Modular sub-systems ────────────────────────────────────────────────────────
import { useSignatureEngine } from './signature/useSignatureEngine';
import { useDocumentLoader } from './viewer/useDocumentLoader';
import { DocumentViewer } from './viewer/DocumentViewer';
import { SignatureCanvas } from './signature/SignatureCanvas';
import { SignatureUpload } from './signature/SignatureUpload';
import { FieldPalette } from './fields/FieldPalette';
import { TypedSignaturePanel } from './signature/TypedSignaturePanel';
import { mergeSignaturesWithDocument, batchMergeFiles } from './rendering/SignatureMerger';
import { logAuditEvent } from './security/AuditLogger';
import {
  completeProtectedSigning,
  createSigningIntent,
  recordSigningAuthProof,
  type SigningIntent,
} from '@/services/ProductionSigningService';
import { parsePDF, parseWord, parseExcel, parseImage, detectFileType, type FileContent } from './viewer/useDocumentLoader';

// ── Types (unchanged, API-compatible) ─────────────────────────────────────────

interface DocumensoIntegrationProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  document: {
    id: string;
    title: string;
    content: string;
    type: string;
  };
  user: {
    name: string;
    email: string;
    role: string;
  };
  file?: File;
  files?: File[];
}

interface SignedFile {
  name: string;
  type: string;
  size: number;
  data: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DocumensoIntegration: React.FC<DocumensoIntegrationProps> = ({
  isOpen,
  onClose,
  onComplete,
  document,
  user,
  file,
  files,
}) => {
  const { toast } = useToast();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('signature');
  const [signatureMethod, setSignatureMethod] = useState('draw');
  const [capturedSignature, setCapturedSignature] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(2);
  const [brushColor, setBrushColor] = useState('#000000');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);

  // ── Signing flow state (unchanged) ─────────────────────────────────────────
  const [signingProgress, setSigningProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [workflowAdvanced, setWorkflowAdvanced] = useState(false);
  const [finalSignedFiles, setFinalSignedFiles] = useState<SignedFile[]>([]);
  const [originalFileBytes, setOriginalFileBytes] = useState<ArrayBuffer | null>(null);
  const [batchStatus, setBatchStatus] = useState<{
    totalFiles: number;
    currentFileIndex: number;
    totalPages: number;
    currentPageIndex: number;
    fileName: string;
  } | null>(null);
  const [signingIntent, setSigningIntent] = useState<SigningIntent | null>(null);

  // ── WebAuthn gate state (UNTOUCHED) ─────────────────────────────────────────
  const [showWebAuthnGate, setShowWebAuthnGate] = useState(false);
  const [webAuthnStatus, setWebAuthnStatus] = useState('');
  const [showBackupEntry, setShowBackupEntry] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState('');

  // ── File navigation (unchanged) ────────────────────────────────────────────
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [fileZoom, setFileZoom] = useState(100);
  const [fileRotation, setFileRotation] = useState(0);
  const isMultiFile = !!(files && files.length > 1);
  const currentFile = isMultiFile ? files![currentFileIndex] : file;

  // ── Fields panel state ─────────────────────────────────────────────────────
  const [roles, setRoles] = useState<string[]>(['HOD', 'Principal', 'Registrar']);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [draggedFieldType, setDraggedFieldType] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // ── Modular engines ────────────────────────────────────────────────────────
  const {
    fileContent,
    fileLoading,
    fileError,
    actualDocDimensions,
    updateActualDocDimensions,
    loadFile,
  } = useDocumentLoader();

  const sigEngine = useSignatureEngine({
    currentUser: user.name,
    currentFileIndex,
    isMultiFile,
    signatureMethod,
  });

  // ── Reset on open/close ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setCurrentFileIndex(0);
      setCurrentPageNumber(1);
      setWorkflowAdvanced(false);
      setSigningIntent(null);
    }
  }, [isOpen, files]);

  // ── Load existing signatures from Supabase (unchanged) ─────────────────────
  useEffect(() => {
    if (!isOpen || !document.id) {
      sigEngine.setPlacedSignatures([]);
      return;
    }

    const loadSignatures = async () => {
      try {
        const isPersistedSignedArtifact = Boolean(
          (currentFile as (File & { __iaomsSignedArtifact?: boolean }) | null)?.__iaomsSignedArtifact,
        );
        if (isPersistedSignedArtifact) {
          sigEngine.setPlacedSignatures([]);
          return;
        }

        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', document.id)
          .single();

        if (error) {
          console.warn('⚠️ Supabase fetch warning:', error.message);
          return;
        }

        const metadata = (data as Record<string, unknown>)?.signature_metadata;
        if (metadata && Array.isArray(metadata) && metadata.length > 0) {
          sigEngine.setPlacedSignatures(metadata);
        } else {
          sigEngine.setPlacedSignatures([]);
        }
      } catch (error) {
        console.error('❌ Error loading signatures:', error);
      }
    };

    loadSignatures();

    // Audit: document opened
    logAuditEvent({
      event_type: 'document_opened',
      document_id: document.id,
      user_name: user.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document.id, currentFile]);

  // ── Real-time subscription (unchanged) ─────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !document.id) return;

    const channel = supabase
      .channel(`documenso-sigs-${document.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${document.id}` },
        (payload) => {
          const isPersistedSignedArtifact = Boolean(
            (currentFile as (File & { __iaomsSignedArtifact?: boolean }) | null)?.__iaomsSignedArtifact,
          );
          if (isPersistedSignedArtifact) return;

          const newMeta = (payload.new as Record<string, unknown>)?.signature_metadata;
          if (!newMeta || !Array.isArray(newMeta)) return;
          sigEngine.setPlacedSignatures((prev) => {
            const myUnsavedSigs = prev.filter(
              (s) => s.signedBy === user.name && !newMeta.find((m: Record<string, unknown>) => m.id === s.id),
            );
            return [...newMeta, ...myUnsavedSigs];
          });
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document.id, user.name, currentFile]);

  // ── Load file on change ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentFile || !isOpen) return;
    loadFile(currentFile);

    // Capture original bytes for lossless PDF output and unchanged-file
    // preservation when a multi-file Office batch contains other files.
    currentFile.arrayBuffer().then((bytes) => {
      setOriginalFileBytes(bytes);
    }).catch(() => {
      setOriginalFileBytes(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile, isOpen, currentFileIndex]);

  // ── Reset captured signature when switching tabs ───────────────────────────
  useEffect(() => {
    setCapturedSignature(null);
  }, [signatureMethod]);

  // ── File navigation ────────────────────────────────────────────────────────
  const handlePreviousFile = useCallback(() => {
    if (isMultiFile && currentFileIndex > 0) {
      setCurrentFileIndex((p) => p - 1);
      setFileZoom(100);
      setFileRotation(0);
      setCurrentPageNumber(1);
      sigEngine.setSelectedSignatureId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiFile, currentFileIndex]);

  const handleNextFile = useCallback(() => {
    if (isMultiFile && files && currentFileIndex < files.length - 1) {
      setCurrentFileIndex((p) => p + 1);
      setFileZoom(100);
      setFileRotation(0);
      setCurrentPageNumber(1);
      sigEngine.setSelectedSignatureId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiFile, files, currentFileIndex]);

  // ── Field drop handler ─────────────────────────────────────────────────────
  const handleFieldDrop = useCallback(
    (e: React.DragEvent, pageIndex?: number) => {
      e.preventDefault();
      if (!draggedFieldType) return;

      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();
      const xPercent = (e.clientX - rect.left) / rect.width;
      const yPercent = (e.clientY - rect.top) / rect.height;

      sigEngine.placeField({
        type: draggedFieldType,
        xPercent: Math.max(0, Math.min(0.85, xPercent)),
        yPercent: Math.max(0, Math.min(0.95, yPercent)),
        pageNumber: pageIndex !== undefined ? pageIndex + 1 : currentPageNumber,
        selectedRole,
        docWidth: actualDocDimensions.width,
        docHeight: actualDocDimensions.height,
      });

      setDraggedFieldType(null);
    },
    [draggedFieldType, currentPageNumber, selectedRole, actualDocDimensions, sigEngine],
  );

  // ── Place captured signature on document ───────────────────────────────────
  const placeSignatureOnDocument = useCallback(
    async (sigData: string) => {
      if (sigEngine.selectedSignatureId) {
        const selectedSig = sigEngine.placedSignatures.find(s => s.id === sigEngine.selectedSignatureId);
        const isImageType = !selectedSig?.type || ['signature', 'stamp', 'initials', 'image'].includes(selectedSig.type);

        if (isImageType) {
          sigEngine.updateSignatureData(sigEngine.selectedSignatureId, sigData);
          sigEngine.setSelectedSignatureId(null);
          return;
        }
        // If not an image type field, ignore selection and place as a new signature below
      }

      // ── Compute natural aspect-ratio from the captured PNG ─────────────────
      // Reads naturalWidth/naturalHeight so the placed box exactly matches the
      // ink proportions — no vertical stretching regardless of file type.
      let naturalW = 200;
      let naturalH = 80;
      try {
        await new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => {
            naturalW = img.naturalWidth || 200;
            naturalH = img.naturalHeight || 80;
            res();
          };
          img.onerror = () => res();
          img.src = sigData;
        });
      } catch { /* keep defaults */ }

      // ── Size the signature box ─────────────────────────────────────────────
      // Target width = 22% of document width.
      // Height follows the natural aspect ratio — capped at 15% of page height
      // so it never dominates a long document.
      const docW = actualDocDimensions.width || 800;
      const docH = actualDocDimensions.height || 1200;

      const TARGET_WIDTH_FRACTION = 0.22;           // 22% of page width
      const MAX_HEIGHT_FRACTION = 0.15;           // never taller than 15% of page

      const aspect = naturalH / naturalW;
      const boxW = docW * TARGET_WIDTH_FRACTION;
      const boxH = Math.min(boxW * aspect, docH * MAX_HEIGHT_FRACTION);

      // Horizontally centered; placed near the top (8% from top) so users
      // see it immediately without scrolling.
      const centeredX = (docW - boxW) / 2;
      const placementY = docH * 0.08;

      // ── Coordinate space: document pixels ─────────────────────────────────
      // Pass coordinates in document space (as if zoom is always 100%).
      // The placeSignature engine handles zoom conversion internally.
      const dynamicField = {
        x: centeredX,
        y: placementY,
        width: boxW,
        height: boxH,
        rotation: 0,
      };

      sigEngine.placeSignature(
        sigData,
        dynamicField,
        { width: docW, height: docH },
        currentPageNumber,
        fileContent ?? undefined,
        selectedRole,
      );
      toast({ title: 'Signature Placed', description: `Added to page ${currentPageNumber}` });
    },
    [sigEngine, actualDocDimensions, currentPageNumber, fileContent, fileZoom, toast, selectedRole],
  );

  const beginSigningAuthentication = useCallback(async () => {
    try {
      const intent = await createSigningIntent(document.id);
      setSigningIntent(intent);
      let credentials: unknown[] = [];
      try { credentials = await listCredentials(); } catch { /* the gate will offer backup verification */ }
      setShowWebAuthnGate(true);
      setWebAuthnStatus(credentials.length === 0 ? 'Verify with a passkey or backup code to continue.' : '');
      setShowBackupEntry(credentials.length === 0);
      setBackupCodeInput('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start signing';
      toast({ title: 'Signing Unavailable', description: message, variant: 'destructive' });
    }
  }, [document.id, toast]);

  // ── handleSign — merge locally, then commit through the protected backend ───
  const handleSign = useCallback(async (authRequestId: string) => {
    if (!signingIntent?.transactionId) {
      toast({ title: 'Signing Unavailable', description: 'The signing transaction has expired. Please start again.', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);

    try {
      const steps = [
        { message: 'Validating signing authorization...', progress: 20 },
        { message: 'Preparing document...', progress: 40 },
        { message: 'Rendering signed artifact...', progress: 60 },
        { message: 'Merging signatures...', progress: 75 },
        { message: 'Computing final artifact integrity hash...', progress: 90 },
        { message: 'Saving signed document...', progress: 100 },
      ];

      for (const step of steps) {
        await new Promise((r) => setTimeout(r, 300));
        setSigningProgress(step.progress);
      }

      let signedFiles: SignedFile[] = [];
      if (isMultiFile && files) {
        setSigningProgress(75);
        const batchResults = await batchMergeFiles({
          files: await Promise.all(
            files.map(async (f, idx) => {
              const kind = detectFileType(f);
              let content: FileContent;
              const fileBytes = await f.arrayBuffer();
              if (kind === 'pdf') {
                content = await parsePDF(new File([fileBytes], f.name, { type: f.type }));
              } else if (kind === 'word') content = await parseWord(f);
              else if (kind === 'excel') content = await parseExcel(f);
              else if (kind === 'image') content = parseImage(f);
              else content = { type: 'unsupported' };

              return {
                fileContent: content,
                fileName: f.name,
                fileIndex: idx,
                originalFileBytes: fileBytes,
              };
            }),
          ),
          signatures: sigEngine.placedSignatures,
          onFileProgress: (fileIdx, totalFiles, pageDone, totalPages) => {
            setBatchStatus({
              totalFiles,
              currentFileIndex: fileIdx,
              totalPages,
              currentPageIndex: pageDone,
              fileName: files[fileIdx].name,
            });
            const overallProgress = 75 + ((fileIdx + pageDone / (totalPages || 1)) / totalFiles) * 20;
            setSigningProgress(Math.min(95, Math.round(overallProgress)));
          },
        });
        signedFiles = batchResults.flat();
        setBatchStatus(null);
      } else {
        signedFiles = await mergeSignaturesWithDocument(
          fileContent!,
          sigEngine.placedSignatures,
          currentFile?.name || 'document',
          currentFileIndex,
          undefined,
          originalFileBytes ?? undefined,
        );
      }

      if (signedFiles.length === 0) throw new Error('No signed artifact was produced.');
      setFinalSignedFiles(signedFiles);

      const signatureMetadata = sigEngine.placedSignatures.map((sig) => ({
        id: sig.id,
        xPercent: sig.xPercent,
        yPercent: sig.yPercent,
        widthPercent: sig.widthPercent,
        heightPercent: sig.heightPercent,
        rotation: sig.rotation,
        data: sig.data,
        docWidth: sig.docWidth,
        docHeight: sig.docHeight,
        pageNumber: sig.pageNumber ?? 1,
        fileIndex: sig.fileIndex ?? currentFileIndex,
        location: {
          fileIndex: sig.fileIndex ?? currentFileIndex,
          pageNumber: sig.pageNumber ?? 1,
          xPercent: sig.xPercent,
          yPercent: sig.yPercent,
          widthPercent: sig.widthPercent,
          heightPercent: sig.heightPercent,
        },
        signedBy: sig.signedBy || user.name,
        signedAt: sig.signedAt || new Date().toISOString(),
      }));

      await completeProtectedSigning({
        documentId: document.id,
        transactionId: signingIntent?.transactionId ?? '',
        requestId: authRequestId,
        signatures: signatureMetadata,
        signedFiles,
      });

      // Dispatch events (unchanged)
      const { data: docData } = await supabase
        .from('documents').select('*').eq('id', document.id).single();
      const { data: workflowData } = await supabase
        .from('document_workflows')
        .select('*, workflow_steps(*)')
        .eq('document_id', document.id)
        .single();

      const totalRecipients =
        workflowData?.workflow_steps?.filter((s: { step_order: number }) => s.step_order > 0).length || 1;
      const currentSignedCount = docData?.signed_by?.length || 1;

      window.dispatchEvent(
        new CustomEvent('document-signed', {
          detail: {
            documentId: document.id,
            signedFiles,
            signerName: user.name,
            signatureCount: sigEngine.placedSignatures.length,
            totalSigned: currentSignedCount,
            totalRecipients,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent('documenso-signature-completed', {
          detail: {
            documentId: document.id,
            signerName: user.name,
            totalSigned: currentSignedCount,
            totalRecipients,
          },
        }),
      );

      setSigningIntent(null);
      setIsCompleted(true);
      setIsProcessing(false);

      toast({
        title: 'Document Signed Successfully',
        description: `✅ Signed • ${sigEngine.placedSignatures.length} Signature${sigEngine.placedSignatures.length !== 1 ? 's' : ''}`,
        duration: 5000,
      });

      // Trigger completion callback to advance workflow in background.
      // The modal remains open until the user manually closes it.
      onComplete();
      setWorkflowAdvanced(true);
    } catch (error) {
      console.error('❌ Signing failed:', error);
      setIsProcessing(false);
      toast({
        title: 'Signing Failed',
        description: 'Failed to apply digital signature. Please try again.',
        variant: 'destructive',
      });
    }
  }, [
    fileContent, sigEngine.placedSignatures, currentFile, currentFileIndex,
    document.id, user.name, toast, files, isMultiFile, originalFileBytes, onComplete,
    signingIntent,
  ]);

  // ── handleDownload (unchanged) ─────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (finalSignedFiles.length === 0) return;

    finalSignedFiles.forEach((signedFile) => {
      const link = window.document.createElement('a');
      link.href = signedFile.data;
      link.download = signedFile.name;
      link.click();
    });
  }, [finalSignedFiles]);

  // ── Mouse event wiring for drag/resize inside viewer ──────────────────────
  const handleViewerMouseMove = useCallback(
    (e: React.PointerEvent) => {
      // Find the actual page element being interacted with for accurate coordinates
      const pageEl = window.document.querySelector(`[data-page-number="${currentPageNumber}"]`) as HTMLElement;
      const rect = pageEl?.getBoundingClientRect() || previewContainerRef.current?.getBoundingClientRect();
      if (rect) sigEngine.handleMouseMove(e, rect);
    },
    [sigEngine, currentPageNumber],
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          if (isCompleted && !workflowAdvanced) {
            // Auto-trigger approval workflow when closing after signing (only if not already advanced)
            onComplete();
            setWorkflowAdvanced(true);
          } else {
            onClose();
          }
        }
      }} modal={!showWebAuthnGate}>
        <DialogContent
          className="max-w-[100vw] sm:max-w-[95vw] lg:max-w-[1200px] w-full h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[95vh] p-0 flex flex-col gap-0 overflow-hidden rounded-none sm:rounded-xl"
          onInteractOutside={(e) => { if (showWebAuthnGate) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (showWebAuthnGate) e.preventDefault(); }}
        >
          <DialogHeader className="px-3 sm:px-5 py-2 sm:py-3 border-b border-gray-100 flex-shrink-0 flex flex-row items-center justify-between">
            <div className="space-y-0.5 min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-bold truncate">
                <LiaFileSignatureSolid className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                <span className="truncate">{document.title}</span>
              </DialogTitle>
              <DialogDescription className="text-[9px] sm:text-[10px] text-gray-400 truncate hidden sm:block">
                E-Digital Signature — Powered by IAOMS Signing Engine
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 pr-6 sm:pr-8">
              <div className="flex items-center bg-gray-50/80 rounded-lg sm:rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 border border-gray-100 shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-md sm:rounded-lg hover:bg-white hover:shadow-sm transition-all"
                  onClick={() => setFileZoom(Math.max(30, fileZoom - 10))}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                </Button>

                <div className="px-1.5 sm:px-3 py-0.5 sm:py-1 bg-white rounded-md sm:rounded-lg shadow-sm text-[10px] sm:text-[11px] font-bold min-w-[40px] sm:min-w-[54px] text-center text-gray-700">
                  {fileZoom}%
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-md sm:rounded-lg hover:bg-white hover:shadow-sm transition-all"
                  onClick={() => setFileZoom(Math.min(300, fileZoom + 10))}
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                </Button>

                <div className="w-px h-4 sm:h-5 bg-gray-200 mx-0.5" />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-md sm:rounded-lg hover:bg-white hover:shadow-sm transition-all"
                  onClick={() => setFileRotation((fileRotation + 90) % 360)}
                  title="Rotate Document"
                >
                  <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Main layout */}
          <div className="flex flex-1 overflow-hidden relative flex-col lg:flex-row" style={{ minHeight: 0 }}>

            {/* ── Document Preview (full width on mobile, left on desktop) ── */}
            <div className="flex-1 flex flex-col gap-1.5 sm:gap-2 lg:overflow-hidden overflow-x-auto overflow-y-hidden p-2 sm:p-3 min-w-0 lg:flex-1">

              {/* Multi-file navigation bar */}
              {isMultiFile && files && (
                <div className="flex items-center gap-2 px-1 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousFile}
                    disabled={currentFileIndex === 0}
                    className="h-8 rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-medium text-gray-600 flex-1 text-center truncate">
                    {currentFile?.name || 'Document'}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {currentFileIndex + 1} / {files.length}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextFile}
                    disabled={currentFileIndex >= files.length - 1}
                    className="h-8 rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFileViewer(true)}
                    className="h-8 rounded-lg"
                    title="Open in FileViewer"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Document Viewer */}
              <DocumentViewer
                fileContent={fileContent}
                fileLoading={fileLoading}
                fileError={fileError}
                currentFile={currentFile ?? null}
                currentFileIndex={currentFileIndex}
                currentPageNumber={currentPageNumber}
                fileZoom={fileZoom}
                fileRotation={fileRotation}
                placedSignatures={sigEngine.placedSignatures}
                selectedSignatureId={sigEngine.selectedSignatureId}
                isDragging={sigEngine.isDragging}
                isResizing={sigEngine.isResizing}
                currentUser={user.name}
                signatureMethod={signatureMethod}
                onZoomChange={setFileZoom}
                onRotationChange={setFileRotation}
                onPageChange={setCurrentPageNumber}
                onFieldDrop={handleFieldDrop}
                onSelectSignature={sigEngine.setSelectedSignatureId}
                onSignatureMouseDown={(e, id) => {
                  const rect = previewContainerRef.current?.getBoundingClientRect();
                  if (rect) sigEngine.handleSignatureMouseDown(e, id, rect);
                }}
                onRotateSignature={sigEngine.rotateSignature}
                onDeleteSignature={sigEngine.deleteSignature}
                onResizeMouseDown={sigEngine.handleResizeMouseDown}
                onClearSelection={() => sigEngine.setSelectedSignatureId(null)}
                onMouseMove={handleViewerMouseMove}
                onMouseUp={sigEngine.handleMouseUp}
                onDocumentDimensionsChange={updateActualDocDimensions}
                onFieldDataChange={sigEngine.updateSignatureData}
                containerRef={previewContainerRef}
              />
            </div>

            {/* ── Right Sidebar — hidden on mobile, always visible on lg+ ── */}
            <div
              className={[
                // Desktop: always visible as right column
                'hidden lg:flex lg:relative lg:right-auto lg:top-auto lg:bottom-auto',
                'w-[320px] flex-shrink-0 border-l border-gray-100 bg-white overflow-auto flex-col',
              ].join(' ')}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                <TabsList className="mx-3 mt-3 mb-0 grid grid-cols-3 rounded-xl bg-gray-100 p-1 gap-1 flex-shrink-0">
                  <TabsTrigger value="signature" className="rounded-lg text-xs font-semibold">
                    <Signature className="w-3 h-3 mr-1" />
                    Sign
                  </TabsTrigger>
                  <TabsTrigger value="fields" className="rounded-lg text-xs font-semibold">
                    <PiSignatureFill className="w-3 h-3 mr-1" />
                    Fields
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-lg text-xs font-semibold">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Verify
                  </TabsTrigger>
                </TabsList>

                {/* ── Signature Tab ──────────────────────────────────────── */}
                <TabsContent value="signature" className="flex-1 overflow-auto p-3 space-y-4">
                  {/* Method picker */}
                  <div className="flex rounded-xl overflow-hidden border border-gray-200">
                    {(['draw', 'upload', 'type'] as const).map((method) => (
                      <button
                        key={method}
                        className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors
                          ${signatureMethod === method
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        onClick={() => setSignatureMethod(method)}
                      >
                        {method}
                      </button>
                    ))}
                  </div>

                  {/* Draw */}
                  {signatureMethod === 'draw' && (
                    <SignatureCanvas
                      brushSize={brushSize}
                      brushColor={brushColor}
                      onBrushSizeChange={setBrushSize}
                      onBrushColorChange={setBrushColor}
                      onCapture={(dataUrl) => {
                        setCapturedSignature(dataUrl);
                        placeSignatureOnDocument(dataUrl);
                      }}
                    />
                  )}

                  {/* Upload */}
                  {signatureMethod === 'upload' && (
                    <SignatureUpload
                      inkColor={brushColor}
                      onCapture={(dataUrl) => {
                        setCapturedSignature(dataUrl);
                        placeSignatureOnDocument(dataUrl);
                      }}
                    />
                  )}

                  {/* Type */}
                  {signatureMethod === 'type' && (
                    <TypedSignaturePanel
                      userName={user.name}
                      brushColor={brushColor}
                      onBrushColorChange={setBrushColor}
                      onCapture={(dataUrl) => {
                        setCapturedSignature(dataUrl);
                      }}
                      onPlace={() => {
                        if (capturedSignature) placeSignatureOnDocument(capturedSignature);
                      }}
                      hasCapture={!!capturedSignature}
                    />
                  )}

                  {/* Placed signatures summary */}
                  {sigEngine.placedSignatures.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Placed ({sigEngine.placedSignatures.length})
                      </p>
                      {sigEngine.placedSignatures.slice(0, 4).map((sig) => (
                        <div
                          key={sig.id}
                          className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border
                            ${sigEngine.selectedSignatureId === sig.id
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                            }`}
                          onClick={() => sigEngine.setSelectedSignatureId(sig.id)}
                        >
                          {sig.data ? (
                            <img src={sig.data} className="w-10 h-6 object-contain rounded" alt="" />
                          ) : (
                            <div className="w-10 h-6 rounded border-2 border-dashed border-blue-300 flex items-center justify-center">
                              <span className="text-[7px] text-blue-500 font-bold uppercase">{sig.type ?? 'SIG'}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-700 truncate">{sig.signedBy || user.name}</p>
                            <p className="text-[9px] text-gray-400">{sig.pageNumber ? `Page ${sig.pageNumber}` : 'All pages'}</p>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sigEngine.deleteSignature(sig.id);
                            }}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-all shrink-0"
                            title="Remove element"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Fields Tab ───────────────────────────────────────────── */}
                <TabsContent value="fields" className="flex-1 overflow-auto p-3 space-y-4">
                  {/* Role management */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Signee Role</Label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSelectedRole(null)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                          ${selectedRole === null
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        None
                      </button>
                      {roles.map((r) => (
                        <button
                          key={r}
                          onClick={() => setSelectedRole(r)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                            ${selectedRole === r
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    {/* Add role */}
                    {isAddingRole ? (
                      <div className="flex gap-1.5">
                        <Input
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="Role name…"
                          className="h-8 text-xs rounded-lg"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newRoleName.trim()) {
                              setRoles((prev) => [...prev, newRoleName.trim()]);
                              setNewRoleName('');
                              setIsAddingRole(false);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs"
                          onClick={() => setIsAddingRole(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            if (newRoleName.trim()) {
                              setRoles((prev) => [...prev, newRoleName.trim()]);
                              setNewRoleName('');
                              setIsAddingRole(false);
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-gray-500"
                        onClick={() => setIsAddingRole(true)}
                      >
                        + Add Role
                      </Button>
                    )}
                  </div>

                  <FieldPalette
                    selectedRole={selectedRole}
                    onDragStart={(e, fieldType) => {
                      setDraggedFieldType(fieldType);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => setDraggedFieldType(null)}
                  />
                </TabsContent>

                {/* ── Review Tab ───────────────────────────────────────────── */}
                <TabsContent value="review" className="flex-1 overflow-auto p-3 space-y-4">
                  {/* Signer info */}
                  <Card className="border-gray-100 shadow-none">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{user.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Processing / Completed states */}
                  {isProcessing && (
                    <Card className="border-gray-100 shadow-sm bg-white/50 backdrop-blur-sm">
                      <CardContent className="p-6 text-center space-y-4">
                        <div className="relative w-16 h-16 mx-auto">
                          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20" />
                          <div className="relative w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                            <PenTool className="w-8 h-8 text-blue-600 animate-pulse" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-gray-800">
                            {batchStatus ? 'Processing Batch' : 'APPLYING SIGNATURE'}
                          </h3>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">E-DIGITAL SIGNATURE — POWERED BY IAOMS SIGNING ENGINE</p>
                        </div>
                        <Progress value={signingProgress} className="h-2 w-full bg-gray-100" />
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-blue-600">{signingProgress}% COMPLETED</p>
                          {batchStatus && (
                            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                              <p className="text-[10px] text-gray-500 font-medium truncate px-2">
                                Current: <span className="text-gray-800 font-bold">{batchStatus.fileName}</span>
                              </p>
                              <div className="flex justify-between items-center px-1">
                                <Badge variant="secondary" className="text-[9px] font-mono h-4 bg-white border-gray-200">
                                  File {batchStatus.currentFileIndex + 1}/{batchStatus.totalFiles}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-mono h-4 bg-white border-blue-100 text-blue-600">
                                  Page {batchStatus.currentPageIndex + 1}/{batchStatus.totalPages}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {isCompleted && (
                    <Card className="border-green-100 bg-green-50">
                      <CardContent className="p-6 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-7 h-7 text-green-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-green-800">DOCUMENT SIGNED</h3>
                        <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-lg">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Complete Signing button */}
                  {!isProcessing && !isCompleted && (
                    <div className="pt-2">
                      <Button
                        className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-sm"
                        onClick={beginSigningAuthentication}
                      >
                        ✓ Complete & Verify
                      </Button>
                    </div>
                  )}

                </TabsContent>
              </Tabs>
            </div>

            {/* ── Mobile Sidebar Overlay — backdrop (lg: hidden) ────────── */}
            {isSidebarOpen && (
              <div
                className="lg:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* ── Mobile Slide-in Sidebar Panel (lg: hidden) ────────────── */}
            <div
              className={[
                'lg:hidden fixed top-0 right-0 bottom-0 z-40',
                'w-[82vw] max-w-[340px] bg-white shadow-2xl',
                'flex flex-col',
                'transition-transform duration-300 ease-in-out',
                isSidebarOpen ? 'translate-x-0' : 'translate-x-full',
              ].join(' ')}
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tools</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sidebar nav items */}
              <div className="flex flex-col gap-0.5 px-2 py-2 border-b border-gray-100 flex-shrink-0">
                {(
                  [
                    { tab: 'signature', icon: <Signature className="w-4 h-4" />, label: 'Sign' },
                    { tab: 'fields', icon: <PiSignatureFill className="w-4 h-4" />, label: 'Fields' },
                    { tab: 'review', icon: <ShieldCheck className="w-4 h-4" />, label: 'Verify' },
                  ] as const
                ).map(({ tab, icon, label }) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                      }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {/* Sidebar content — scrollable */}
              <div className="flex-1 overflow-y-auto">
                {/* Sign content */}
                {activeTab === 'signature' && (
                  <div className="px-3 py-3 space-y-3">
                    <div className="flex rounded-xl overflow-hidden border border-gray-200">
                      {(['draw', 'upload', 'type'] as const).map((method) => (
                        <button
                          key={method}
                          className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors
                            ${signatureMethod === method
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          onClick={() => setSignatureMethod(method)}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                    {signatureMethod === 'draw' && (
                      <SignatureCanvas
                        brushSize={brushSize}
                        brushColor={brushColor}
                        onBrushSizeChange={setBrushSize}
                        onBrushColorChange={setBrushColor}
                        onCapture={(dataUrl) => {
                          setCapturedSignature(dataUrl);
                          placeSignatureOnDocument(dataUrl);
                          setIsSidebarOpen(false);
                        }}
                      />
                    )}
                    {signatureMethod === 'upload' && (
                      <SignatureUpload
                        inkColor={brushColor}
                        onCapture={(dataUrl) => {
                          setCapturedSignature(dataUrl);
                          placeSignatureOnDocument(dataUrl);
                          setIsSidebarOpen(false);
                        }}
                      />
                    )}
                    {signatureMethod === 'type' && (
                      <TypedSignaturePanel
                        userName={user.name}
                        brushColor={brushColor}
                        onBrushColorChange={setBrushColor}
                        onCapture={(dataUrl) => { setCapturedSignature(dataUrl); }}
                        onPlace={() => {
                          if (capturedSignature) {
                            placeSignatureOnDocument(capturedSignature);
                            setIsSidebarOpen(false);
                          }
                        }}
                        hasCapture={!!capturedSignature}
                      />
                    )}
                  </div>
                )}

                {/* Fields content */}
                {activeTab === 'fields' && (
                  <div className="px-3 py-3">
                    <FieldPalette
                      onDragStart={(e, fieldType) => {
                        setDraggedFieldType(fieldType);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragEnd={() => setDraggedFieldType(null)}
                      selectedRole={selectedRole}
                    />
                  </div>
                )}

                {/* Verify content */}
                {activeTab === 'review' && (
                  <div className="px-3 py-3 space-y-4">
                    <Card className="border-gray-100 shadow-none">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">{user.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-gray-500 truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{user.role}</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {sigEngine.placedSignatures.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-700">
                          {sigEngine.placedSignatures.length} Signature{sigEngine.placedSignatures.length !== 1 ? 's' : ''} Placed
                        </p>
                        <p className="text-[10px] text-blue-500 mt-0.5">Ready to complete signing</p>
                      </div>
                    )}

                    {isProcessing && (
                      <Card className="border-gray-100 shadow-sm bg-white/50">
                        <CardContent className="p-4 text-center space-y-3">
                          <div className="relative w-12 h-12 mx-auto">
                            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20" />
                            <div className="relative w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                              <PenTool className="w-6 h-6 text-blue-600 animate-pulse" />
                            </div>
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">APPLYING SIGNATURE</h3>
                          <Progress value={signingProgress} className="h-2 w-full bg-gray-100" />
                          <p className="text-xs font-bold text-blue-600">{signingProgress}% COMPLETED</p>
                        </CardContent>
                      </Card>
                    )}

                    {isCompleted && (
                      <Card className="border-green-100 bg-green-50">
                        <CardContent className="p-4 text-center space-y-3">
                          <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          </div>
                          <h3 className="text-sm font-semibold text-green-800">Document Signed!</h3>
                          <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-lg">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {!isProcessing && !isCompleted && (
                      <div className="pt-1 pb-2">
                        <Button
                          className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-sm"
                          onClick={beginSigningAuthentication}
                        >
                          ✓ Complete &amp; Verify
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile floating sidebar toggle (lg: hidden) ───────────── */}
            <button
              className="lg:hidden fixed bottom-5 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95 hover:bg-blue-700"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label="Toggle tools sidebar"
            >
              {isSidebarOpen
                ? <X className="w-5 h-5" />
                : <Signature className="w-5 h-5" />
              }
            </button>

          </div>
        </DialogContent>
      </Dialog>

      {/* ─── WebAuthn Identity Gate — rendered at top-level so it works on mobile AND desktop ─── */}
      {showWebAuthnGate && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-[360px] flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header section with logo */}
            <div className="bg-[#f8fafc] h-48 flex items-center justify-center relative overflow-hidden border-b border-gray-100">
              <div className="absolute inset-0 opacity-[0.4]"
                style={{
                  backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`,
                  backgroundSize: '30px 30px',
                  backgroundPosition: 'center center',
                }}
              />
              <div className="relative z-10 w-32 h-32 bg-[#2563eb] rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                <div className="absolute inset-0 bg-white opacity-10 rounded-[1.75rem]" />
                <img src="/custom-security-logo.png" alt="Security Logo" className="w-24 h-24 object-contain relative z-20" />
              </div>
              <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gray-200/50" />
              <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gray-200/50" />
            </div>

            <div className="p-7 space-y-7 flex flex-col items-center text-center">
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-[#0f172a] tracking-tight leading-tight">Verify Your Identity</h3>
                <p className="text-[#64748b] text-[15px] leading-relaxed max-w-[280px] mx-auto">
                  Biometric verification is required before completing this digital signature.
                </p>
              </div>

              {webAuthnStatus && (
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full text-[13px] font-semibold animate-in fade-in slide-in-from-top-2 duration-300 border border-blue-100 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {webAuthnStatus}
                </div>
              )}

              {!showBackupEntry ? (
                <div className="w-full space-y-4">
                  <Button
                    className="w-full h-14 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[16px] font-bold shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2.5"
                    onClick={async () => {
                      setWebAuthnStatus('Waiting for biometric…');
                      try {
                        if (!signingIntent) throw new Error('Signing transaction is missing or expired');
                        const result = await authenticatePasskey('document_signing', document.id, signingIntent.transactionId);
                        if (!result.requestId) throw new Error('No authentication proof was returned');
                        await recordSigningAuthProof({
                          transactionId: signingIntent.transactionId,
                          documentId: document.id,
                          requestId: result.requestId,
                          authMethod: 'passkey',
                        });
                        setShowWebAuthnGate(false);
                        setWebAuthnStatus('');
                        await handleSign(result.requestId);
                      } catch {
                        setWebAuthnStatus('');
                        setShowBackupEntry(true);
                      }
                    }}
                  >
                    <Fingerprint className="w-5 h-5" />
                    Verify with Biometrics
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-14 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-[#334155] text-[16px] font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] gap-2.5"
                    onClick={() => { setShowBackupEntry(true); setWebAuthnStatus(''); }}
                  >
                    <LayoutGrid className="w-5 h-5 text-gray-400" />
                    Use Backup Code
                  </Button>

                  <button
                    className="text-[#94a3b8] font-semibold hover:text-[#64748b] transition-colors py-1 text-[14px]"
                    onClick={() => { setShowWebAuthnGate(false); setWebAuthnStatus(''); }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-5">
                  <div className="space-y-3 w-full">
                    <label className="text-[13px] font-bold text-gray-400 uppercase tracking-widest text-center block">Enter backup code</label>
                    <input
                      type="text"
                      placeholder="IAOMS-XXXX-XXXX"
                      value={backupCodeInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        let fmt = raw;
                        if (raw.length > 5) fmt = raw.slice(0, 5) + '-' + raw.slice(5);
                        if (raw.length > 9) fmt = raw.slice(0, 5) + '-' + raw.slice(5, 9) + '-' + raw.slice(9);
                        setBackupCodeInput(fmt.slice(0, 16));
                      }}
                      className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 text-lg font-mono tracking-widest text-center bg-gray-50/50 focus:border-blue-500 focus:bg-white transition-all outline-none"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    className="w-full h-16 rounded-[1.25rem] bg-slate-900 hover:bg-black text-white text-[17px] font-bold shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    disabled={backupCodeInput.replace(/-/g, '').length < 13}
                    onClick={async () => {
                      setWebAuthnStatus('Verifying backup code…');
                      try {
                        if (!signingIntent) throw new Error('Signing transaction is missing or expired');
                        const result = await verifyBackupCode(
                          backupCodeInput,
                          'document_signing',
                          document.id,
                          signingIntent.transactionId,
                        );
                        if (!result.requestId) throw new Error('No authentication proof was returned');
                        await recordSigningAuthProof({
                          transactionId: signingIntent.transactionId,
                          documentId: document.id,
                          requestId: result.requestId,
                          authMethod: 'backup_code',
                        });
                        setShowWebAuthnGate(false);
                        setWebAuthnStatus('');
                        setShowBackupEntry(false);
                        setBackupCodeInput('');
                        await handleSign(result.requestId);
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : 'Unknown error';
                        setWebAuthnStatus(`Invalid code: ${msg}`);
                      }
                    }}
                  >
                    Verify Backup Code
                  </Button>
                  <div className="flex gap-4 w-full">
                    <Button
                      variant="outline"
                      className="flex-1 h-12 rounded-xl text-sm font-bold border-gray-100 hover:bg-gray-50"
                      onClick={() => { setShowBackupEntry(false); setWebAuthnStatus(''); }}
                    >
                      ← Try Biometric
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 h-12 rounded-xl text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { setShowWebAuthnGate(false); setWebAuthnStatus(''); setShowBackupEntry(false); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        window.document.body
      )}

      {/* FileViewer Modal (unchanged) */}
      {(file || (files && files.length > 0)) && (
        <FileViewer
          file={file || undefined}
          files={files && files.length > 0 ? files : undefined}
          open={showFileViewer}
          onOpenChange={setShowFileViewer}
        />
      )}
    </>
  );
};