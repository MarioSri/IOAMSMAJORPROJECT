import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { AdvancedDigitalSignature } from "@/components/signature/AdvancedDigitalSignature";
import { useAuth } from "@/contexts/AuthContext";

export default function AdvancedSignature() {
  const { user } = useAuth();



  if (!user) return null;

  return (
    <ResponsiveLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Advanced Digital Signature
          </h1>
          <p className="text-muted-foreground">
            Multi-modal signature capture with quality validation and advanced tools
          </p>
        </div>

        <AdvancedDigitalSignature userRole={user.role} />
      </div>
    </ResponsiveLayout>
  );
}