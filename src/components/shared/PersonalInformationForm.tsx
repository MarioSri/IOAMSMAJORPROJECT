import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Camera, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PersonalInformationFormProps {
  onSave: (data: PersonalInfoData) => void;
  initialData?: PersonalInfoData;
  isStandalone?: boolean;
}

export interface PersonalInfoData {
  name: string;
  email: string;
  phone: string;
  department: string;
  employeeId: string;
  designation: string;
  bio: string;
  avatar: string;
}

export const PersonalInformationForm: React.FC<PersonalInformationFormProps> = ({ 
  onSave, 
  initialData,
  isStandalone = false 
}) => {
  const [profileData, setProfileData] = useState<PersonalInfoData>(
    initialData || {
      name: "",
      email: "",
      phone: "",
      department: "",
      employeeId: "",
      designation: "",
      bio: "",
      avatar: ""
    }
  );

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!profileData.name || !profileData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in at least your name and email.",
        variant: "destructive"
      });
      return;
    }

    onSave(profileData);
    toast({
      title: "Information Saved",
      description: "Your personal information has been saved successfully.",
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfileData(prev => ({ ...prev, avatar: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="w-5 h-5" />
          Personal Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStandalone && (
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profileData.avatar} />
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {profileData.name ? profileData.name.split(' ').map(n => n[0]).join('') : 'U'}
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
                className="absolute -bottom-1 -right-1 rounded-full w-8 h-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">Full Name *</Label>
            <Input
              id="name"
              value={profileData.name}
              onChange={(e) => setProfileData({...profileData, name: e.target.value})}
              className="h-10"
              placeholder="Enter your full name"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({...profileData, email: e.target.value})}
              className="h-10"
              placeholder="Enter your email"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
              className="h-10"
              placeholder="Enter your phone number"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="department" className="text-sm">Department</Label>
            <Input
              id="department"
              value={profileData.department}
              onChange={(e) => setProfileData({...profileData, department: e.target.value})}
              className="h-10"
              placeholder="Enter your department"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="employeeId" className="text-sm">Employee ID</Label>
            <Input
              id="employeeId"
              value={profileData.employeeId}
              onChange={(e) => setProfileData({...profileData, employeeId: e.target.value})}
              className="h-10"
              placeholder="Enter your employee ID"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="designation" className="text-sm">Designation</Label>
            <Input
              id="designation"
              value={profileData.designation}
              onChange={(e) => setProfileData({...profileData, designation: e.target.value})}
              className="h-10"
              placeholder="Enter your designation"
            />
          </div>
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="bio" className="text-sm">Bio</Label>
          <Textarea
            id="bio"
            value={profileData.bio}
            onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
            rows={3}
            placeholder="Tell us about yourself"
          />
        </div>
        
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} className="h-10 px-6">
            <Save className="w-4 h-4 mr-2" />
            Save Information
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};