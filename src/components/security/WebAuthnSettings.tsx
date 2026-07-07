// src/components/security/WebAuthnSettings.tsx
// Passkey management card — register, list, and revoke passkeys.

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
//
// Performance notes:
//   - Credentials are loaded via usePasskeyCredentials() which maintains a
//     module-level cache, so switching to the Security tab after the Profile
//     page has pre-fetched the data shows passkeys instantly (zero loading flash).
//   - A Supabase Realtime subscription keeps the list live without polling.
//   - The local loading state starts as FALSE if cached data is already present.

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  Fingerprint,
  Smartphone,
  Laptop,
  Trash2,
  Plus,
  Cloud,
  AlertTriangle,
  Loader2,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import {
  registerPasskey,
  revokeCredential,
} from '@/services/WebAuthnService';
import {
  usePasskeyCredentials,
  invalidatePasskeyCache,
} from '@/hooks/usePasskeyCredentials';
import { BackupCodesDisplay } from './BackupCodesDisplay';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function WebAuthnSettings() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  // credentials & loading come from the shared cache — no spinner on first render
  // if Profile.tsx has already prefetched the data.
  const { credentials, loading, refresh } = usePasskeyCredentials(userId);

  const [registering, setRegistering] = useState(false);
  const [revoking, setRevoking]       = useState<string | null>(null);
  const [deviceName, setDeviceName]   = useState('');
  const [status, setStatus]           = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const { toast } = useToast();

  const handleRegister = useCallback(async () => {
    setRegistering(true);
    setStatus('Preparing passkey — follow your device prompt…');
    try {
      const result = await registerPasskey(deviceName || 'My Device');

      if (result.backupCodes && result.backupCodes.length > 0) {
        setBackupCodes(result.backupCodes);
      } else {
        toast({ title: 'Passkey registered', description: 'Your new passkey is active.' });
      }

      setDeviceName('');
      setStatus('');
      invalidatePasskeyCache();
      await refresh();
    } catch (err: unknown) {
      const isNotAllowed = err instanceof DOMException && err.name === 'NotAllowedError';
      if (isNotAllowed) {
        setStatus('Cancelled — no passkey was registered.');
      } else {
        setStatus(`Failed: ${errMsg(err)}`);
      }
    } finally {
      setRegistering(false);
    }
  }, [deviceName, refresh, toast]);

  const handleRevoke = useCallback(async (cred: { id: string; device_name: string }) => {
    if (!window.confirm(`Revoke passkey "${cred.device_name}"? This cannot be undone.`)) return;
    setRevoking(cred.id);
    try {
      await revokeCredential(cred.id);
      toast({ title: 'Passkey revoked', description: `"${cred.device_name}" has been removed.` });
      invalidatePasskeyCache();
      await refresh();
    } catch (err: unknown) {
      toast({ title: 'Failed to revoke', description: errMsg(err), variant: 'destructive' });
    } finally {
      setRevoking(null);
    }
  }, [refresh, toast]);

  const deviceIcon = (deviceType?: string) => {
    if (deviceType === 'multiDevice') return <Cloud className="w-4 h-4 text-blue-500" />;
    if (deviceType === 'singleDevice') return <Smartphone className="w-4 h-4 text-slate-500" />;
    return <Laptop className="w-4 h-4 text-slate-500" />;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* One-time backup codes modal */}
      {backupCodes && (
        <BackupCodesDisplay
          codes={backupCodes}
          onDismiss={() => {
            setBackupCodes(null);
            toast({ title: 'Passkey activated', description: 'Your passkey and backup codes are ready.' });
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-primary" />
            Passkeys Authentication
          </CardTitle>
          <CardDescription>
            Use Your Device Biometric (Face ID, Windows Hello, Fingerprint) To Securely Approve Documents
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Registered passkeys */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Registered Passkeys</Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading ? (
              // Only shown on the very first load when no cache exists
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading passkeys…</span>
              </div>
            ) : credentials.length === 0 ? (
              <div className="flex items-center gap-3 p-4 border border-dashed rounded-lg text-muted-foreground">
                <Shield className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">No passkeys registered</p>
                  <p className="text-xs">Add a passkey below to enable biometric authentication.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {credentials.map(cred => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="shrink-0">{deviceIcon(cred.device_type)}</div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{cred.device_name}</p>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                          Last used: {formatDate(cred.last_used_at)}
                          <span className="hidden md:inline"> · Added: {formatDate(cred.created_at)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                      {cred.backup_state && (
                        <Badge variant="secondary" className="gap-1 text-[10px] md:text-xs h-6 px-1.5 md:px-2">
                          <Cloud className="w-3 h-3" />
                          <span className="hidden sm:inline">Synced</span>
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevoke(cred)}
                        disabled={revoking === cred.id}
                      >
                        {revoking === cred.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-medium">ADD A DEVICE</Label>
            <div className="flex flex-col md:flex-row gap-3 md:gap-2">
              <Input
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder='Device Name (Eg: "Apple iPhone 15 Pro Max")'
                disabled={registering}
                onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
                className="w-full"
              />
              <Button
                onClick={handleRegister}
                disabled={registering}
                className="gap-1.5 shrink-0 w-full md:w-auto"
              >
                {registering
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
                  : <><Plus className="w-4 h-4" /> ADD PASSKEYS</>
                }
              </Button>
            </div>

            {status && (
              <div className={`flex items-center gap-2 text-sm p-2 rounded-md ${
                status.toLowerCase().startsWith('failed') || status.toLowerCase().startsWith('cancelled')
                  ? 'text-destructive bg-destructive/10'
                  : 'text-muted-foreground'
              }`}>
                {(status.startsWith('Failed') || status.startsWith('Cancelled'))
                  ? <AlertTriangle className="w-4 h-4 shrink-0" />
                  : <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                }
                {status}
              </div>
            )}
          </div>

          {/* Backup codes info */}
          {credentials.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                10 Backup Codes Were Generated When You Registered Your First Passkey. Store Them Securely.
                If You No Longer Have Them, Revoke All Passkeys And Re-Register To Generate New Ones.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
