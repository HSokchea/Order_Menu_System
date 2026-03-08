import { StaffManagement } from "@/components/admin/roles/StaffManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

export default function StaffPage() {
  const { loading, error } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading permissions: {error}</p>
      </div>
    );
  }

  return <StaffManagement />;
}
