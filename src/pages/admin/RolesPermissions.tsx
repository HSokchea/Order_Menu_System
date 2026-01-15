import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesManagement } from "@/components/admin/roles/RolesManagement";
import { PermissionsMatrix } from "@/components/admin/roles/PermissionsMatrix";
import { UserRolesManagement } from "@/components/admin/roles/UserRolesManagement";
import { StaffManagement } from "@/components/admin/roles/StaffManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Shield, Users, Key, UserCog } from "lucide-react";

/**
 * RolesPermissions - Staff Management & RBAC Page
 * 
 * Tab Structure (STRICT):
 * 
 * 1️⃣ Staff Tab - Users ONLY
 *    - List users (name, email, assigned roles, status)
 *    - Add/invite staff
 *    - Assign roles when creating staff
 *    - Activate/deactivate users
 *    - Force password change
 *    ❌ NO role creation/editing
 *    ❌ NO permission editing
 * 
 * 2️⃣ Roles Tab - Roles ONLY
 *    - Create/edit roles (Manager, Cashier, etc.)
 *    - Manage role inheritance
 *    ❌ NO user listing
 *    ❌ NO assigning users to roles (use User Access tab)
 * 
 * 3️⃣ Permissions Tab - Role→Permission Mapping
 *    - View system permissions
 *    - Assign permissions TO ROLES
 *    - Add conditions to role permissions
 *    ❌ NO assigning permissions to users directly
 *    ❌ NO creating/editing permission definitions
 * 
 * 4️⃣ User Access Tab - View + Controlled Role Assignment
 *    - View users with their roles
 *    - View effective permissions (read-only)
 *    - Edit role assignments via modal
 *    ❌ NO direct permission assignment
 *    ❌ NO editing user profile data
 */
export default function RolesPermissions() {
  const { loading, error } = usePermissions();
  const [activeTab, setActiveTab] = useState("staff");

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
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">User Access</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-6">
          <StaffManagement />
        </TabsContent>

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
