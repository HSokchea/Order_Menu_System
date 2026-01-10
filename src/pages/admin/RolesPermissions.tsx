import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesManagement } from "@/components/admin/roles/RolesManagement";
import { PermissionsMatrix } from "@/components/admin/roles/PermissionsMatrix";
import { UserRolesManagement } from "@/components/admin/roles/UserRolesManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Shield, Users, Key } from "lucide-react";

export default function RolesPermissions() {
  const { loading, error } = usePermissions();
  const [activeTab, setActiveTab] = useState("roles");

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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <RolesManagement />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsMatrix />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserRolesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
