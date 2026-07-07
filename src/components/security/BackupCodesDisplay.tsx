// src/components/security/BackupCodesDisplay.tsx
// One-time modal shown after first passkey registration.
// User cannot dismiss without confirming they saved the codes.
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Copy, Download, Printer, Shield, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BackupCodesDisplayProps {
  codes: string[];
  onDismiss: () => void;
}

export function BackupCodesDisplay({ codes, onDismiss }: BackupCodesDisplayProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyAll = async () => {
    const text = codes.join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: 'Codes copied to clipboard' });
  };

  const handleDownload = () => {
    const content = [
      'IAOMS Backup Recovery Codes',
      '='.repeat(35),
      'Generated: ' + new Date().toLocaleString(),
      '',
      'Each code can only be used ONCE.',
      'Store these in a safe place.',
      '',
      ...codes,
      '',
      '='.repeat(35),
      'If all codes are used, register a new passkey to generate fresh codes.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'iaoms-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup codes downloaded' });
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>IAOMS Backup Codes</title>
      <style>
        body { font-family: monospace; padding: 2rem; }
        h1 { font-size: 1.2rem; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 1rem 0; }
        .code { background: #f5f5f5; padding: 0.5rem; border-radius: 4px; font-size: 1rem; }
        p { font-size: 0.85rem; color: #555; }
      </style></head><body>
      <h1>IAOMS Backup Recovery Codes</h1>
      <p>Generated: ${new Date().toLocaleString()} — Each code can only be used ONCE.</p>
      <div class="grid">${codes.map(c => `<div class="code">${c}</div>`).join('')}</div>
      <p>Store these securely. If lost, register a new passkey to regenerate.</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open onOpenChange={() => { /* block close unless confirmed */ }}>
      <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <DialogTitle>Save Your Backup Codes</DialogTitle>
          </div>
          <DialogDescription>
            These 10 codes let you sign in if your biometric fails. Each can only be used <strong>once</strong>.
            They will <strong>not</strong> be shown again.
          </DialogDescription>
        </DialogHeader>

        {/* Code Grid */}
        <div className="grid grid-cols-2 gap-2 my-4">
          {codes.map((code, i) => (
            <div
              key={i}
              className="font-mono text-[13px] md:text-sm bg-muted px-2 md:px-3 py-2 rounded-md border text-center tracking-tight md:tracking-wider truncate"
            >
              {code}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center mb-4">
          <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-1.5 w-full sm:w-auto">
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 w-full sm:w-auto">
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 w-full sm:w-auto">
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>

        {/* Warning badge */}
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Store these in a password manager, printed copy, or secure cloud note. Once you close this dialog, they cannot be retrieved.
          </p>
        </div>

        {/* Confirmation */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="codes-saved"
            checked={confirmed}
            onCheckedChange={v => setConfirmed(!!v)}
          />
          <label htmlFor="codes-saved" className="text-sm cursor-pointer leading-snug">
            I have saved my backup codes securely and understand they cannot be shown again.
          </label>
        </div>

        <Button
          className="w-full mt-4"
          disabled={!confirmed}
          onClick={onDismiss}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Done — I&apos;ve Saved My Codes
        </Button>
      </DialogContent>
    </Dialog>
  );
}
