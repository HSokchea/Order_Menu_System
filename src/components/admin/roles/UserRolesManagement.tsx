import { useState, useMemo } from "react";
import { usePermissions, Role, Permission } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { User, Shield, ChevronDown, ChevronUp, Loader2, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantProfile } from "@/hooks/useRestaurantProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface StaffUser {
  id: string;
  email: string;
  full_name: string | null;
}

/**
 * UserRolesManagement - User Access Tab
 * 
 * PURPOSE: View users + controlled role assignment ONLY
 * 
 * ALLOWED:
 * - View users with their assigned roles
 * - View effective permissions (read-only)
 * - Edit role assignments via modal
 * 
 * FORBIDDEN:
 * - Creating/editing roles (use Roles tab)
 * - Creating/editing permissions (use Permissions tab)
 * - Assigning permissions directly to users (RBAC: permissions come from roles)
 * - Editing user profile data (use Staff tab)
 */
export function UserRolesManagement() {
  const { user } = useAuth();
  const { isOwner } = useUserProfile();
  const { restaurant } = useRestaurantProfile();
  const queryClient = useQueryClient();
  const {
    permissions,
    roles,
    userRoles,
    assignRoleToUser,
    removeRoleFromUser,
    getRoleEffectivePermissions
  } = usePermissions();

  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Filter out owner role - only owners can assign owner role
  const assignableRoles = useMemo(() => {
    return roles.filter(role => {
      // Owner role can only be assigned by owners and is generally protected
      if (role.role_type === 'owner') return false;
      return true;
    });
  }, [roles]);

  // Fetch staff users (profiles with same restaurant)
  const { data: staffUsers = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-users', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('restaurant_id', restaurant.id);

      if (error) throw error;

      return data.map(profile => ({
        id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name
      })) as StaffUser[];
    },
    enabled: !!restaurant
  });

  const getUserRoles = (userId: string) => {
    return userRoles
      .filter(ur => ur.user_id === userId)
      .map(ur => roles.find(r => r.id === ur.role_id))
      .filter(Boolean) as Role[];
  };

  const getUserCurrentRoleIds = (userId: string): Set<string> => {
    return new Set(
      userRoles
        .filter(ur => ur.user_id === userId)
        .map(ur => ur.role_id)
    );
  };

  // Get all effective permissions for a user (derived from roles)
  const getUserEffectivePermissions = (userId: string) => {
    const userRolesList = getUserRoles(userId);
    const allPerms: { permission: Permission; source: string; type: 'role' | 'inherited' }[] = [];

    // Permissions come from roles ONLY (RBAC model)
    userRolesList.forEach(role => {
      const effectivePerms = getRoleEffectivePermissions(role.id);
      effectivePerms.forEach(ep => {
        const perm = permissions.find(p => p.id === ep.permissionId);
        if (perm && !allPerms.find(ap => ap.permission.id === perm.id)) {
          allPerms.push({
            permission: perm,
            source: roles.find(r => r.id === ep.sourceRoleId)?.name || role.name,
            type: ep.isInherited ? 'inherited' : 'role'
          });
        }
      });
    });

    return allPerms;
  };

  const openRoleEditor = (staffUser: StaffUser) => {
    setSelectedUser(staffUser);
    setPendingRoleChanges(getUserCurrentRoleIds(staffUser.id));
    setIsRoleDialogOpen(true);
  };

  const handleRoleToggle = (roleId: string) => {
    setPendingRoleChanges(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  // Check if role assignments have changed from original
  const hasRoleChanges = (): boolean => {
    if (!selectedUser) return false;

    const originalRoleIds = getUserCurrentRoleIds(selectedUser.id);

    if (originalRoleIds.size !== pendingRoleChanges.size) return true;

    for (const roleId of originalRoleIds) {
      if (!pendingRoleChanges.has(roleId)) return true;
    }

    return false;
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      const currentRoleIds = getUserCurrentRoleIds(selectedUser.id);

      // Roles to add
      const toAdd = [...pendingRoleChanges].filter(id => !currentRoleIds.has(id));
      // Roles to remove  
      const toRemove = [...currentRoleIds].filter(id => !pendingRoleChanges.has(id));

      // Prevent removing all roles
      if (pendingRoleChanges.size === 0) {
        toast.error("Users must have at least one role assigned");
        setIsSaving(false);
        return;
      }

      // Process removals first
      for (const roleId of toRemove) {
        await removeRoleFromUser(selectedUser.id, roleId);
      }

      // Then additions
      for (const roleId of toAdd) {
        await assignRoleToUser(selectedUser.id, roleId);
      }

      toast.success("Roles updated successfully");
      setIsRoleDialogOpen(false);
      setSelectedUser(null);

      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update roles");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingStaff) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">User Access Management</h3>
        <p className="text-sm text-muted-foreground">
          View users and manage their role assignments. Permissions are derived from assigned roles.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Role-Based Access Control (RBAC)</p>
          <p className="text-muted-foreground">
            Permissions are granted through roles only. To change a user's permissions,
            update their assigned roles or modify role permissions in the Roles/Permissions tabs.
          </p>
        </div>
      </div>

      {/* Staff List */}
      <div className="space-y-4">
        {staffUsers.map(staffUser => {
          const userRolesList = getUserRoles(staffUser.id);
          const isExpanded = expandedUser === staffUser.id;
          const effectivePerms = getUserEffectivePermissions(staffUser.id);
          const isUserOwner = staffUser.id === user?.id && isOwner;

          return (
            <Card key={staffUser.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {staffUser.full_name || staffUser.email}
                        {isUserOwner && (
                          <Badge variant="secondary">Owner</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{staffUser.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isUserOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoleEditor(staffUser)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Edit Roles
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedUser(isExpanded ? null : staffUser.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Assigned Roles */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Assigned Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {isUserOwner ? (
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        <Shield className="h-3 w-3 mr-1" />
                        All Permissions (Owner)
                      </Badge>
                    ) : userRolesList.length > 0 ? (
                      userRolesList.map(role => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                        >
                          {role.name}
                        </Badge>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>No roles assigned - user has no permissions</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded: Effective Permissions Summary (Read-Only) */}
                {isExpanded && !isUserOwner && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-xs text-muted-foreground">
                      Effective Permissions ({effectivePerms.length} permissions)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      These permissions are derived from the user's assigned roles
                    </p>
                    <ScrollArea className="h-[200px] mt-2">
                      <div className="space-y-1">
                        {effectivePerms.map(({ permission, source, type }) => (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-muted"
                          >
                            <span>{permission.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${type === 'inherited'
                                  ? 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                  : ''
                                }`}
                            >
                              via {source}
                            </Badge>
                          </div>
                        ))}
                        {effectivePerms.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No permissions - assign roles to grant access
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {staffUsers.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No staff members found. Add staff members in the Staff tab.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Roles Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-md" hideCloseButton>
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex flex-col gap-2">
              <DialogTitle>Edit User Roles</DialogTitle>
              <DialogDescription>
                Select roles for {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </div>

            <Button variant="custom" size="custom" className='pb-8' aria-label="Close dialog" onClick={() => setIsRoleDialogOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>
          {selectedUser && (
            <div className="">
              <p className="text-sm text-muted-foreground mb-4">
                Permissions are determined by the roles assigned below.
                Users must have at least one role.
              </p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {assignableRoles.length > 0 ? (
                  assignableRoles.map(role => (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={pendingRoleChanges.has(role.id)}
                        onCheckedChange={() => handleRoleToggle(role.id)}
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {role.role_type}
                          </Badge>
                        </div>
                        {role.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {role.description}
                          </p>
                        )}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No roles available. Create roles in the Roles tab first.
                  </p>
                )}
              </div>

              {pendingRoleChanges.size === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  At least one role must be selected
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleSaveRoles}
              disabled={isSaving || pendingRoleChanges.size === 0 || !hasRoleChanges()}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
