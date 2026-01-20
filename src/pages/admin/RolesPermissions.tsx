import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesManagement } from "@/components/admin/roles/RolesManagement";
import { RolePermissionsMatrix } from "@/components/admin/roles/RolePermissionsMatrix";
import { PermissionsRegistry } from "@/components/admin/roles/PermissionsRegistry";
import { UserRolesManagement } from "@/components/admin/roles/UserRolesManagement";
import { StaffManagement } from "@/components/admin/roles/StaffManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Shield, Users, Key, UserCog, ListChecks } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

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
 * 3️⃣ Permissions Tab - Permission Registry (Batch Save)
 *    - Create/edit/delete permission definitions
 *    - Batch save changes with "Save Changes" button
 *    ❌ NO assigning permissions to roles (use Role Permissions tab)
 *    ❌ NO assigning permissions to users
 * 
 * 4️⃣ Role Permissions Tab - Role→Permission Mapping
 *    - View system permissions
 *    - Assign permissions TO ROLES
 *    ❌ NO creating/editing permission definitions
 *    ❌ NO assigning permissions to users directly
 * 
 * 5️⃣ User Access Tab - View + Controlled Role Assignment
 *    - View users with their roles
 *    - View effective permissions (read-only)
 *    - Edit role assignments via modal
 *    ❌ NO direct permission assignment
 *    ❌ NO editing user profile data
 */
export default function RolesPermissions() {
  const { loading, error } = usePermissions();
  const [activeTab, setActiveTab] = useState("staff");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Browser-level guard for page navigation/close
  useUnsavedChangesGuard(hasUnsavedChanges);

  // Handle tab change with unsaved changes guard
  const handleTabChange = (newTab: string) => {
    if (hasUnsavedChanges && activeTab === "permissions") {
      setPendingTab(newTab);
    } else {
      setActiveTab(newTab);
    }
  };

  const confirmTabChange = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
      setHasUnsavedChanges(false);
    }
  };

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
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
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
          <TabsTrigger value="role-permissions" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Role Perms</span>
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
          <PermissionsRegistry onUnsavedChanges={setHasUnsavedChanges} />
        </TabsContent>

        <TabsContent value="role-permissions" className="mt-6">
          <RolePermissionsMatrix />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserRolesManagement />
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        open={!!pendingTab}
        onOpenChange={(open) => !open && setPendingTab(null)}
        title="Unsaved Changes"
        description="You have unsaved changes in the Permissions tab. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave Without Saving"
        onConfirm={confirmTabChange}
        variant="destructive"
      />
    </div>
  );
}
