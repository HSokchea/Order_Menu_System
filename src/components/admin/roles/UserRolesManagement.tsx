import { useState, useMemo } from "react";
import { usePermissions, Role, Permission } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { User, Plus, X, Shield, Key, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantProfile } from "@/hooks/useRestaurantProfile";
import { useQuery } from "@tanstack/react-query";

interface StaffUser {
  id: string;
  email: string;
  full_name: string | null;
}

export function UserRolesManagement() {
  const { user } = useAuth();
  const { restaurant } = useRestaurantProfile();
  const {
    permissions,
    roles,
    userRoles,
    userPermissions,
    assignRoleToUser,
    removeRoleFromUser,
    assignPermissionToUser,
    removePermissionFromUser,
    getRoleEffectivePermissions
  } = usePermissions();

  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Fetch staff users (profiles with same restaurant)
  const { data: staffUsers = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-users', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('restaurant_id', restaurant.id);
      
      if (error) throw error;

      // Get user emails from auth (we only have access to current user's email)
      // For now, we'll show the profile info
      return data.map(profile => ({
        id: profile.user_id,
        email: profile.full_name || 'Staff Member',
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

  const getUserDirectPermissions = (userId: string) => {
    return userPermissions
      .filter(up => up.user_id === userId)
      .map(up => permissions.find(p => p.id === up.permission_id))
      .filter(Boolean) as Permission[];
  };

  const getAvailableRolesForUser = (userId: string) => {
    const currentRoleIds = userRoles
      .filter(ur => ur.user_id === userId)
      .map(ur => ur.role_id);
    
    return roles.filter(r => !currentRoleIds.includes(r.id));
  };

  const getAvailablePermissionsForUser = (userId: string) => {
    const currentPermIds = userPermissions
      .filter(up => up.user_id === userId)
      .map(up => up.permission_id);
    
    return permissions.filter(p => !currentPermIds.includes(p.id));
  };

  // Get all effective permissions for a user
  const getUserEffectivePermissions = (userId: string) => {
    const userRolesList = getUserRoles(userId);
    const directPerms = getUserDirectPermissions(userId);
    
    const allPerms: { permission: Permission; source: string; type: 'role' | 'direct' | 'inherited' }[] = [];

    // Add role permissions
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

    // Add direct permissions
    directPerms.forEach(perm => {
      if (!allPerms.find(ap => ap.permission.id === perm.id)) {
        allPerms.push({
          permission: perm,
          source: 'Direct Permission',
          type: 'direct'
        });
      }
    });

    return allPerms;
  };

  const handleAddRole = async (roleId: string) => {
    if (!selectedUser) return;
    
    try {
      await assignRoleToUser(selectedUser.id, roleId);
      toast.success("Role assigned successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to assign role");
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      await removeRoleFromUser(userId, roleId);
      toast.success("Role removed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove role");
    }
  };

  const handleAddPermission = async (permissionId: string) => {
    if (!selectedUser) return;
    
    try {
      await assignPermissionToUser(selectedUser.id, permissionId);
      toast.success("Permission assigned successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to assign permission");
    }
  };

  const handleRemovePermission = async (userId: string, permissionId: string) => {
    try {
      await removePermissionFromUser(userId, permissionId);
      toast.success("Permission removed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove permission");
    }
  };

  // Group available permissions by resource
  const groupedAvailablePermissions = useMemo(() => {
    if (!selectedUser) return {};
    
    const available = getAvailablePermissionsForUser(selectedUser.id);
    const groups: Record<string, Permission[]> = {};
    
    available.forEach(perm => {
      if (!groups[perm.resource]) {
        groups[perm.resource] = [];
      }
      groups[perm.resource].push(perm);
    });
    
    return groups;
  }, [selectedUser, permissions, userPermissions]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">User Access Management</h3>
        <p className="text-sm text-muted-foreground">
          Assign roles and direct permissions to staff members
        </p>
      </div>

      {/* Staff List */}
      <div className="space-y-4">
        {staffUsers.map(staffUser => {
          const userRolesList = getUserRoles(staffUser.id);
          const directPerms = getUserDirectPermissions(staffUser.id);
          const isExpanded = expandedUser === staffUser.id;
          const effectivePerms = getUserEffectivePermissions(staffUser.id);
          const isOwner = staffUser.id === user?.id;

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
                        {isOwner && (
                          <Badge variant="secondary">Owner</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{staffUser.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isOwner && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(staffUser);
                            setIsRoleDialogOpen(true);
                          }}
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Add Role
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(staffUser);
                            setIsPermissionDialogOpen(true);
                          }}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Add Permission
                        </Button>
                      </>
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
                    {isOwner ? (
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        <Shield className="h-3 w-3 mr-1" />
                        All Permissions (Owner)
                      </Badge>
                    ) : userRolesList.length > 0 ? (
                      userRolesList.map(role => (
                        <Badge 
                          key={role.id} 
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {role.name}
                          <button
                            onClick={() => handleRemoveRole(staffUser.id, role.id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No roles assigned</span>
                    )}
                  </div>
                </div>

                {/* Direct Permissions */}
                {!isOwner && directPerms.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-xs text-muted-foreground">Direct Permissions</Label>
                    <div className="flex flex-wrap gap-2">
                      {directPerms.map(perm => (
                        <Badge 
                          key={perm.id} 
                          variant="outline"
                          className="flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                        >
                          <Key className="h-3 w-3 mr-1" />
                          {perm.name}
                          <button
                            onClick={() => handleRemovePermission(staffUser.id, perm.id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded: Effective Permissions Summary */}
                {isExpanded && !isOwner && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-xs text-muted-foreground">
                      Effective Permissions Summary ({effectivePerms.length} permissions)
                    </Label>
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
                              className={`text-xs ${
                                type === 'direct' 
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                  : type === 'inherited'
                                  ? 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                  : ''
                              }`}
                            >
                              {source}
                            </Badge>
                          </div>
                        ))}
                        {effectivePerms.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No permissions assigned
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

        {staffUsers.length === 0 && !isLoadingStaff && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No staff members found. Add staff members to manage their access.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Select a role to assign to {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4 space-y-2">
              {getAvailableRolesForUser(selectedUser.id).length > 0 ? (
                getAvailableRolesForUser(selectedUser.id).map(role => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => {
                      handleAddRole(role.id);
                      setIsRoleDialogOpen(false);
                    }}
                  >
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <Badge variant="outline">{role.role_type}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All available roles are already assigned
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Permission Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Direct Permission</DialogTitle>
            <DialogDescription>
              Add a direct permission to {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 py-4">
              {Object.entries(groupedAvailablePermissions).map(([resource, perms]) => (
                <div key={resource} className="space-y-2">
                  <h4 className="font-medium text-sm capitalize border-b pb-1">
                    {resource}
                  </h4>
                  {perms.map(permission => (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between p-2 border rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => {
                        handleAddPermission(permission.id);
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium">{permission.name}</p>
                        <p className="text-xs text-muted-foreground">{permission.key}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
              {Object.keys(groupedAvailablePermissions).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All permissions are already assigned
                </p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
