import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { EmergencyWorkflowInterface } from "@/components/emergency/EmergencyWorkflowInterface";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabaseEmergency } from "@/hooks/useSupabaseEmergency";

export default function Emergency() {
  const { user } = useAuth();
  const emergencyService = useSupabaseEmergency();

  if (!user) return null;

  return (
    <ResponsiveLayout>
      <div className="container mx-auto p-4 sm:p-6">
        <EmergencyWorkflowInterface 
          userRole={user.role} 
          emergencyService={emergencyService}
        />
      </div>
    </ResponsiveLayout>
  );
}