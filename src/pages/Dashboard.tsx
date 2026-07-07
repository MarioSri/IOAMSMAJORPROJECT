import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function Dashboard() {
  return (
    <ResponsiveLayout>
      <RoleDashboard />
    </ResponsiveLayout>
  );
}