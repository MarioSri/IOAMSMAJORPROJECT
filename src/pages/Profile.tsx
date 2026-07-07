import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Bell,
  Camera,
  Edit,
  Shield,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";
import { PersonalInformationForm, PersonalInfoData } from "@/components/shared/PersonalInformationForm";
import { userProfileService } from "@/services/UserProfileService";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePreferredEmail } from "@/hooks/usePreferredEmail";
import { WebAuthnSettings } from "@/components/security/WebAuthnSettings";
import { prefetchPasskeyCredentials } from "@/hooks/usePasskeyCredentials";

export default function Profile() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<PersonalInfoData>({
    name: "",
    email: "",
    phone: "",
    department: "",
    employeeId: "",
    designation: "",
    bio: "",
    avatar: ""
  });

  const { preferences: notifPrefs, saving: savingNotifPrefs, updatePreferences: updateNotifPrefs } = useNotificationPreferences();
  const { 
    preferredEmail, 
    saving: savingPreferredEmail, 
    updatePreferredEmail, 
    removePreferredEmail,
    setPreferredEmail 
  } = usePreferredEmail();
  const [hasPreferredEmailChanged, setHasPreferredEmailChanged] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      // Kick off passkey prefetch in parallel — data will be cached before
      // the user clicks the Security tab, eliminating the loading spinner.
      prefetchPasskeyCredentials(user.id).catch(() => { /* non-critical */ });

      try {
        const emailKey = user.email;
        const profile = emailKey
          ? await userProfileService.fetchProfileByEmail(emailKey)
          : await userProfileService.fetchProfile(user.id);

        if (profile) {
          const preferredNotifEmail = (profile as any).preferred_notification_email || '';
          setProfileData({
            name: profile.name,
            email: profile.email,
            phone: profile.phone || "",
            department: profile.department || "",
            employeeId: profile.employee_id || profile.id,
            designation: profile.designation || profile.role,
            bio: profile.bio || "",
            avatar: profile.avatar || ""
          });
          if (preferredNotifEmail) {
            setPreferredEmail(preferredNotifEmail);
          }
          setHasPreferredEmailChanged(false);
        } else {
          setProfileData({
            name: "",
            email: "",
            phone: "",
            department: "",
            employeeId: "",
            designation: "",
            bio: "",
            avatar: ""
          });
        }
      } catch (error) {
        console.error('[Profile] Error loading profile data:', error);
        setError('Failed to load profile data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [user]);

  const handleSaveProfile = async (data: PersonalInfoData) => {
    try {
      setProfileData(data);
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error Saving Profile",
        description: "Failed to save profile.",
        variant: "destructive"
      });
    }
  };

  const handleNotifToggle = async (
    channel: 'email_enabled' | 'push_enabled',
    checked: boolean
  ) => {
    const ok = await updateNotifPrefs({ [channel]: checked });
    if (!ok) {
      toast({ title: 'Failed to save', description: 'Could not update notification preferences.', variant: 'destructive' });
    }
  };

  const handleSavePreferredEmail = async () => {
    const success = await updatePreferredEmail(preferredEmail);
    if (success) {
      setHasPreferredEmailChanged(false);
      toast({ 
        title: 'Saved', 
        description: preferredEmail.trim() 
          ? 'Preferred notification email updated.' 
          : 'Preferred notification email removed. Using default email.'
      });
    } else {
      toast({ title: 'Error', description: 'Could not save preferred email.', variant: 'destructive' });
    }
  };

  const handleRemovePreferredEmail = async () => {
    const success = await removePreferredEmail();
    if (success) {
      setHasPreferredEmailChanged(false);
      toast({ 
        title: 'Removed', 
        description: 'Preferred notification email removed. Using default email.'
      });
    } else {
      toast({ title: 'Error', description: 'Could not remove preferred email.', variant: 'destructive' });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfileData(prev => ({ ...prev, avatar: result }));
        toast({
          title: "Profile Picture Updated",
          description: "Your profile picture has been updated successfully.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
          <div className="mb-6 h-8 w-48 bg-muted animate-pulse rounded"></div>
          <div className="space-y-4">
            <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
            <div className="h-64 bg-muted animate-pulse rounded-lg"></div>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information and preferences</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive font-medium">Profile Data Temporarily Unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-3", isMobile ? "h-auto p-1" : "h-12")}>
            <TabsTrigger value="profile" className="h-9 md:h-10">Profile</TabsTrigger>
            <TabsTrigger value="preferences" className="h-9 md:h-10">Preferences</TabsTrigger>
            <TabsTrigger value="security" className="h-9 md:h-10 gap-1.5">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24 md:w-32 md:h-32">
                      <AvatarImage src={profileData.avatar} />
                      <AvatarFallback>
                        {profileData.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-center md:text-left flex-1">
                    <h2 className="text-xl md:text-2xl font-bold">{profileData.name || 'Not Set'}</h2>
                    <p className="text-muted-foreground">{profileData.designation || 'No designation'}</p>
                    <Badge variant="outline" className="mt-2">
                      ID: {profileData.employeeId || 'N/A'}
                    </Badge>
                  </div>

                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    variant={isEditing ? "default" : "outline"}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {isEditing ? (
              <PersonalInformationForm
                onSave={handleSaveProfile}
                initialData={profileData}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{profileData.name || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{profileData.email || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{profileData.phone || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="font-medium">{profileData.department || 'Not provided'}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 mt-2">
                <div className="flex items-center justify-between p-1 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch
                    checked={notifPrefs.email_enabled}
                    onCheckedChange={(checked) => handleNotifToggle('email_enabled', checked)}
                    disabled={savingNotifPrefs}
                  />
                </div>
                <div className="flex items-center justify-between p-1 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Browser and mobile notifications</p>
                  </div>
                  <Switch
                    checked={notifPrefs.push_enabled}
                    onCheckedChange={(checked) => handleNotifToggle('push_enabled', checked)}
                    disabled={savingNotifPrefs}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="preferred_email" className="font-medium">Preferred Email for Notifications</Label>
                  <p className="text-sm text-muted-foreground">Leave blank to use your default Google account email.</p>
                  <div className="flex gap-2">
                    <Input
                      id="preferred_email"
                      type="email"
                      value={preferredEmail}
                      onChange={(e) => {
                        setPreferredEmail(e.target.value);
                        setHasPreferredEmailChanged(true);
                      }}
                      placeholder={profileData.email || 'your@email.com'}
                    />
                    <Button
                      onClick={handleSavePreferredEmail}
                      disabled={savingPreferredEmail || !hasPreferredEmailChanged}
                      variant="outline"
                    >
                      {savingPreferredEmail ? 'Saving…' : 'Save'}
                    </Button>
                    {preferredEmail && (
                      <Button
                        onClick={handleRemovePreferredEmail}
                        disabled={savingPreferredEmail}
                        variant="ghost"
                        size="sm"
                        title="Remove preferred email"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <WebAuthnSettings />
          </TabsContent>

        </Tabs>
      </div>
    </ResponsiveLayout>
  );
}