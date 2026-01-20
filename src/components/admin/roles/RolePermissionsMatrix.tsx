import { useState, useMemo } from "react";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Lock, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * RolePermissionsMatrix - Role Permissions Tab
 * 
 * PURPOSE: Manage role → permission mappings
 * 
 * ALLOWED:
 * - View system permission definitions
 * - Select a role and assign/remove permissions to that role
 * 
 * FORBIDDEN:
 * - Creating/editing/deleting permission definitions (use Permissions Registry)
 * - Assigning permissions directly to users (use roles)
 * - Editing role definitions (use Roles tab)
 * 
 * NOTE: Permission conditions are disabled in v1. Binary permission checks only.
 */
export function RolePermissionsMatrix() {
  const { 
    permissions, 
    roles,
    assignPermissionToRole,
    removePermissionFromRole,
    getRoleEffectivePermissions
  } = usePermissions();

  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Filter out owner role for permission assignment
  // Owner has all permissions implicitly
  const assignableRoles = useMemo(() => {
    return roles.filter(role => role.role_type !== 'owner');
  }, [roles]);

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach(perm => {
      if (!groups[perm.resource]) {
        groups[perm.resource] = [];
      }
      groups[perm.resource].push(perm);
    });
    return groups;
  }, [permissions]);

  const currentRole = roles.find(r => r.id === selectedRole);
  
  // Get effective permissions for current role (including inherited)
  const effectivePermissions = useMemo(() => {
    if (!selectedRole) return [];
    return getRoleEffectivePermissions(selectedRole);
  }, [selectedRole, getRoleEffectivePermissions]);

  const hasPermission = (permissionId: string) => {
    return effectivePermissions.some(ep => ep.permissionId === permissionId);
  };

  const isInheritedPermission = (permissionId: string) => {
    const ep = effectivePermissions.find(e => e.permissionId === permissionId);
    return ep?.isInherited || false;
  };

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedRole) return;
    
    // Can't toggle inherited permissions
    if (isInheritedPermission(permissionId)) {
      toast.error("Cannot modify inherited permissions. Edit the parent role instead.");
      return;
    }

    try {
      if (hasPermission(permissionId)) {
        await removePermissionFromRole(selectedRole, permissionId);
        toast.success("Permission removed from role");
      } else {
        await assignPermissionToRole(selectedRole, permissionId);
        toast.success("Permission added to role");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update permission");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Role Permissions</h3>
        <p className="text-sm text-muted-foreground">
          Assign permissions to roles. Users inherit permissions from their assigned roles.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-primary mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Permission → Role → User</p>
          <p className="text-muted-foreground">
            Select a role below to manage its permissions. These permissions will apply 
            to all users with that role. Owner role has all permissions by default.
          </p>
        </div>
      </div>

      {/* Role Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Role</CardTitle>
          <CardDescription>
            Choose a role to view and manage its permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedRole || ''} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select a role..." />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map(role => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    {role.name}
                    <Badge variant="outline" className="text-xs ml-2">
                      {role.role_type}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignableRoles.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No roles available. Create roles in the Roles tab first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Permissions Grid */}
      {selectedRole && currentRole && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Permissions for: {currentRole.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Locked permissions are inherited from parent roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] hidden:scrollbar">
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource} className="space-y-3">
                    <h4 className="font-medium text-sm capitalize">
                      {resource}
                    </h4>
                    <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-2">
                      {perms.map(permission => {
                        const isChecked = hasPermission(permission.id);
                        const isInherited = isInheritedPermission(permission.id);
                        
                        return (
                          <div
                            key={permission.id}
                            className={`flex items-center justify-between p-2 rounded-md border ${
                              isInherited ? 'bg-muted/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isChecked}
                                disabled={isInherited}
                                onCheckedChange={() => handleTogglePermission(permission.id)}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {permission.name}
                                  </span>
                                  {isInherited && (
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {permission.key}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!selectedRole && (
        <Card className="border-none bg-transparent shadow-none">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Select a role above to manage its permissions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
