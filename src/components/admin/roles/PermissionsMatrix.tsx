import { useState, useMemo, useCallback } from "react";
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
import { Lock, Info, Save, X, Plus, Minus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * PermissionsMatrix - Permissions Tab
 * 
 * PURPOSE: Manage role → permission mappings with batch saving
 * 
 * ALLOWED:
 * - View system permission definitions
 * - Select a role and assign/remove permissions to that role
 * - Batch save changes (not per-click)
 * 
 * FORBIDDEN:
 * - Creating/editing/deleting permission definitions (system-managed)
 * - Assigning permissions directly to users (use roles)
 * - Editing role definitions (use Roles tab)
 * 
 * NOTE: Permission conditions are disabled in v1. Binary permission checks only.
 */
export function PermissionsMatrix() {
  const {
    permissions,
    roles,
    assignPermissionToRole,
    removePermissionFromRole,
    getRoleEffectivePermissions
  } = usePermissions();

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, 'add' | 'remove'>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<string | null>(null);

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

  const hasPermission = useCallback((permissionId: string) => {
    return effectivePermissions.some(ep => ep.permissionId === permissionId);
  }, [effectivePermissions]);

  const isInheritedPermission = useCallback((permissionId: string) => {
    const ep = effectivePermissions.find(e => e.permissionId === permissionId);
    return ep?.isInherited || false;
  }, [effectivePermissions]);

  // Get effective state considering pending changes
  const getEffectiveState = useCallback((permissionId: string) => {
    const currentlyHas = hasPermission(permissionId);
    const pendingAction = pendingChanges.get(permissionId);
    
    if (pendingAction === 'add') return true;
    if (pendingAction === 'remove') return false;
    return currentlyHas;
  }, [hasPermission, pendingChanges]);

  // Check if there are any unsaved changes
  const hasUnsavedChanges = pendingChanges.size > 0;

  // Handle checkbox toggle - local state only
  const handleTogglePermission = (permissionId: string) => {
    if (!selectedRole) return;

    // Can't toggle inherited permissions
    if (isInheritedPermission(permissionId)) {
      toast.error("Cannot modify inherited permissions. Edit the parent role instead.");
      return;
    }

    const currentlyHas = hasPermission(permissionId);
    const pendingAction = pendingChanges.get(permissionId);

    setPendingChanges(prev => {
      const newChanges = new Map(prev);
      
      if (pendingAction) {
        // Already has pending change - remove it (revert to original)
        newChanges.delete(permissionId);
      } else {
        // No pending change - add one
        if (currentlyHas) {
          newChanges.set(permissionId, 'remove');
        } else {
          newChanges.set(permissionId, 'add');
        }
      }
      
      return newChanges;
    });
  };

  // Handle role selection with unsaved changes check
  const handleRoleChange = (newRoleId: string) => {
    if (hasUnsavedChanges) {
      setPendingRoleChange(newRoleId);
      setShowDiscardDialog(true);
    } else {
      setSelectedRole(newRoleId);
      setPendingChanges(new Map());
    }
  };

  // Confirm discard and switch role
  const handleConfirmDiscard = () => {
    if (pendingRoleChange) {
      setSelectedRole(pendingRoleChange);
      setPendingChanges(new Map());
      setPendingRoleChange(null);
    }
    setShowDiscardDialog(false);
  };

  // Cancel discard
  const handleCancelDiscard = () => {
    setPendingRoleChange(null);
    setShowDiscardDialog(false);
  };

  // Discard all changes
  const handleDiscard = () => {
    setPendingChanges(new Map());
  };

  // Save all pending changes
  const handleSave = async () => {
    if (!selectedRole || pendingChanges.size === 0) return;

    setIsSaving(true);
    try {
      const additions: string[] = [];
      const removals: string[] = [];

      pendingChanges.forEach((action, permissionId) => {
        if (action === 'add') {
          additions.push(permissionId);
        } else {
          removals.push(permissionId);
        }
      });

      // Execute all changes in parallel
      const promises: Promise<void>[] = [];
      
      additions.forEach(permissionId => {
        promises.push(assignPermissionToRole(selectedRole, permissionId));
      });
      
      removals.forEach(permissionId => {
        promises.push(removePermissionFromRole(selectedRole, permissionId));
      });

      await Promise.all(promises);

      toast.success(`Saved ${pendingChanges.size} permission change(s)`);
      setPendingChanges(new Map());
    } catch (err: any) {
      toast.error(err.message || "Failed to save permission changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Get pending change indicator for a permission
  const getPendingIndicator = (permissionId: string) => {
    const action = pendingChanges.get(permissionId);
    if (action === 'add') return <Plus className="h-3 w-3 text-green-600" />;
    if (action === 'remove') return <Minus className="h-3 w-3 text-destructive" />;
    return null;
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
          <Select value={selectedRole || ''} onValueChange={handleRoleChange}>
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
          <div className="flex items-center justify-between pb-3 pr-6">
            <CardHeader>
              <CardTitle className="text-base">
                Permissions for: {currentRole.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Locked permissions are inherited from parent roles
              </CardDescription>
            </CardHeader>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges || isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Discard
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : `Save${hasUnsavedChanges ? ` (${pendingChanges.size})` : ""}`}
              </Button>
            </div>
          </div>
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
                        const isChecked = getEffectiveState(permission.id);
                        const isInherited = isInheritedPermission(permission.id);
                        const hasPending = pendingChanges.has(permission.id);
                        const pendingIndicator = getPendingIndicator(permission.id);

                        return (
                          <div
                            key={permission.id}
                            className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                              isInherited 
                                ? 'bg-muted/50' 
                                : hasPending
                                  ? pendingChanges.get(permission.id) === 'add'
                                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
                                    : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
                                  : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isChecked}
                                disabled={isInherited || isSaving}
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
                                  {pendingIndicator}
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

      {/* Discard Confirmation Dialog */}
      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard unsaved changes?"
        description={`You have ${pendingChanges.size} unsaved permission change(s). Switching roles will discard these changes.`}
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />
    </div>
  );
}
