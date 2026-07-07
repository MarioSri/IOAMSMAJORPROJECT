// src/components/security/BackupCodeEntry.tsx
// Fallback UI shown when biometric verification fails.
// Used in both the approval flow and the Documenso signing gate.
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Fingerprint, KeyRound, Loader2 } from 'lucide-react';
import { verifyBackupCode } from '@/services/WebAuthnService';

interface BackupCodeEntryProps {
  onSuccess: () => void;
  onRetryBiometric: () => void;
  onCancel?: () => void;
  errorMessage?: string;
}

export function BackupCodeEntry({
  onSuccess,
  onRetryBiometric,
  onCancel,
  errorMessage,
}: BackupCodeEntryProps) {
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    try {
      const result = await verifyBackupCode(code.trim());
      if (result.verified) {
        setRemaining(result.codesRemaining);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message ?? 'Invalid or already-used backup code');
    } finally {
      setLoading(false);
    }
  };

  // Auto-format input: uppercase and insert hyphens (IAOMS-XXXX-XXXX)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw   = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let formatted = raw;
    if (raw.length > 5)  formatted = raw.slice(0, 5) + '-' + raw.slice(5);
    if (raw.length > 9)  formatted = raw.slice(0, 5) + '-' + raw.slice(5, 9) + '-' + raw.slice(9);
    if (raw.length > 13) formatted = formatted.slice(0, 16);
    setCode(formatted);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      {/* Biometric failed banner */}
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <p className="text-sm font-medium">
          {errorMessage ?? 'Biometric verification failed'}
        </p>
      </div>

      <div className="h-px bg-border" />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="backup-code" className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Enter a backup code
          </Label>
          <Input
            id="backup-code"
            placeholder="IAOMS-XXXX-XXXX"
            value={code}
            onChange={handleCodeChange}
            className="font-mono tracking-wider text-center"
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          {remaining !== null && remaining <= 3 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ Only {remaining} backup code{remaining !== 1 ? 's' : ''} remaining. Register a new passkey to regenerate.
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!code.trim() || loading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
          ) : (
            'Verify Backup Code'
          )}
        </Button>
      </form>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={onRetryBiometric}
          disabled={loading}
        >
          <Fingerprint className="w-4 h-4" />
          Try Biometric Again
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
