import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePreferredEmail } from '@/hooks/usePreferredEmail';
import { useAuth } from '@/contexts/AuthContext';
import { WebPushService } from '@/services/WebPushService';
import { useToast } from '@/hooks/use-toast';

export const NotificationPreferences: React.FC = () => {
  const { preferences, loading, saving, updatePreferences } = useNotificationPreferences();
  const { 
    preferredEmail, 
    saving: savingEmail, 
    updatePreferredEmail, 
    removePreferredEmail,
    setPreferredEmail 
  } = usePreferredEmail();
  const { toast } = useToast();
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [hasEmailChanged, setHasEmailChanged] = useState(false);

  const handleToggle = async (
    channel: 'email_enabled' | 'push_enabled' | 'sms_enabled' | 'whatsapp_enabled',
    checked: boolean
  ) => {
    if (channel === 'push_enabled' && checked) {
      const granted = await WebPushService.requestPermission();
      if (!granted) {
        toast({
          title: 'Push notifications unavailable',
          description: 'Allow browser notifications to enable push delivery.',
          variant: 'destructive',
        });
        return;
      }
    }

    const ok = await updatePreferences({ [channel]: checked });
    if (!ok) {
      toast({ title: 'Failed to save', description: 'Could not update notification preferences.', variant: 'destructive' });
      return;
    }

    if (channel === 'push_enabled' && user?.id) {
      if (checked) {
        const registered = await WebPushService.registerToken(user.id, { requestPermission: false });
        if (!registered) {
          toast({
            title: 'Push registration incomplete',
            description: 'Your preference was saved, but this browser could not be registered for push delivery.',
            variant: 'destructive',
          });
        }
      } else {
        await WebPushService.unregisterToken(user.id);
      }
    }
  };

  const handleSavePreferredEmail = async () => {
    const success = await updatePreferredEmail(preferredEmail);
    if (success) {
      setHasEmailChanged(false);
      toast({ 
        title: 'Saved', 
        description: preferredEmail.trim() 
          ? 'Preferred notification email updated.' 
          : 'Preferred notification email removed.'
      });
    } else {
      toast({ title: 'Error', description: 'Could not save preferred email.', variant: 'destructive' });
    }
  };

  const handleRemovePreferredEmail = async () => {
    const success = await removePreferredEmail();
    if (success) {
      setHasEmailChanged(false);
      toast({ title: 'Removed', description: 'Using default email for notifications.' });
    } else {
      toast({ title: 'Error', description: 'Could not remove preferred email.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Loading preferences…</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="email">Email Notifications</Label>
          <Switch
            id="email"
            checked={preferences.email_enabled}
            onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
            disabled={saving}
          />
        </div>

        {preferences.email_enabled && (
          <div className="space-y-2">
            <Label htmlFor="preferred_email">Preferred Email for Notifications</Label>
            <p className="text-xs text-muted-foreground">Leave blank to use your default email.</p>
            <div className="flex gap-2">
              <Input
                id="preferred_email"
                type="email"
                value={preferredEmail}
                onChange={(e) => {
                  setPreferredEmail(e.target.value);
                  setHasEmailChanged(true);
                }}
                placeholder="your@email.com"
              />
              <Button
                onClick={handleSavePreferredEmail}
                disabled={savingEmail || !hasEmailChanged}
                variant="outline"
                size="sm"
              >
                {savingEmail ? 'Saving…' : 'Save'}
              </Button>
              {preferredEmail && (
                <Button
                  onClick={handleRemovePreferredEmail}
                  disabled={savingEmail}
                  variant="ghost"
                  size="sm"
                  title="Remove preferred email"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="push">Push Notifications</Label>
          <Switch
            id="push"
            checked={preferences.push_enabled}
            onCheckedChange={(checked) => handleToggle('push_enabled', checked)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="sms">SMS Notifications</Label>
          <Switch
            id="sms"
            checked={preferences.sms_enabled}
            onCheckedChange={(checked) => handleToggle('sms_enabled', checked)}
            disabled={saving}
          />
        </div>

        {preferences.sms_enabled && (
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="whatsapp">WhatsApp Notifications</Label>
          <Switch
            id="whatsapp"
            checked={preferences.whatsapp_enabled}
            onCheckedChange={(checked) => handleToggle('whatsapp_enabled', checked)}
            disabled={saving}
          />
        </div>

        {preferences.whatsapp_enabled && (
          <div>
            <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
            <Input
              id="whatsapp_number"
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+1234567890"
            />
          </div>
        )}

        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </CardContent>
    </Card>
  );
};