import { useState, useMemo } from "react";
import { usePermissions, Permission, Role } from "@/hooks/usePermissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Settings2, X, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const CONDITION_OPERATORS = [
  { value: '=', label: 'Equals' },
  { value: '!=', label: 'Not equals' },
  { value: 'in', label: 'In list' },
  { value: 'not_in', label: 'Not in list' },
];

interface ConditionBuilderState {
  roleId: string;
  permissionId: string;
  permissionKey: string;
  field: string;
  operator: string;
  value: string;
}

/**
 * PermissionsMatrix - Permissions Tab
 * 
 * PURPOSE: Manage role → permission mappings
 * 
 * ALLOWED:
 * - View system permission definitions
 * - Select a role and assign/remove permissions to that role
 * - Add conditions to permissions
 * 
 * FORBIDDEN:
 * - Creating/editing/deleting permission definitions (system-managed)
 * - Assigning permissions directly to users (use roles)
 * - Editing role definitions (use Roles tab)
 */
export function PermissionsMatrix() {
  const { 
    permissions, 
    roles,
    rolePermissions,
    conditions,
    assignPermissionToRole,
    removePermissionFromRole,
    setPermissionCondition,
    removePermissionCondition,
    getRoleEffectivePermissions
  } = usePermissions();

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [conditionBuilder, setConditionBuilder] = useState<ConditionBuilderState | null>(null);

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

  const getConditionForPermission = (roleId: string, permissionId: string) => {
    return conditions.find(c => 
      c.owner_type === 'role' && 
      c.owner_id === roleId && 
      c.permission_id === permissionId
    );
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

  const handleSaveCondition = async () => {
    if (!conditionBuilder) return;

    try {
      let parsedValue: any = conditionBuilder.value;
      
      // Parse as array for 'in' and 'not_in' operators
      if (conditionBuilder.operator === 'in' || conditionBuilder.operator === 'not_in') {
        parsedValue = conditionBuilder.value.split(',').map(v => v.trim());
      }

      await setPermissionCondition(
        'role',
        conditionBuilder.roleId,
        conditionBuilder.permissionId,
        {
          field: conditionBuilder.field,
          operator: conditionBuilder.operator,
          value: parsedValue
        }
      );
      
      toast.success("Condition saved");
      setConditionBuilder(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save condition");
    }
  };

  const handleRemoveCondition = async (roleId: string, permissionId: string) => {
    try {
      await removePermissionCondition('role', roleId, permissionId);
      toast.success("Condition removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove condition");
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
                        const condition = getConditionForPermission(selectedRole, permission.id);
                        
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
                                  {condition && (
                                    <Badge variant="secondary" className="text-xs">
                                      Conditional
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {permission.key}
                                </p>
                              </div>
                            </div>
                            
                            {isChecked && !isInherited && (
                              <div className="flex items-center gap-2">
                                {condition && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveCondition(selectedRole, permission.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => setConditionBuilder({
                                    roleId: selectedRole,
                                    permissionId: permission.id,
                                    permissionKey: permission.key,
                                    field: condition?.condition_json?.field || '',
                                    operator: condition?.condition_json?.operator || '=',
                                    value: Array.isArray(condition?.condition_json?.value) 
                                      ? condition.condition_json.value.join(', ')
                                      : condition?.condition_json?.value || ''
                                  })}
                                >
                                  <Settings2 className="h-3 w-3 mr-1" />
                                  {condition ? 'Edit' : 'Add'} Condition
                                </Button>
                              </div>
                            )}
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

      {/* Condition Builder Dialog */}
      <Dialog 
        open={!!conditionBuilder} 
        onOpenChange={(open) => !open && setConditionBuilder(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permission Condition</DialogTitle>
            <DialogDescription>
              Add a condition to restrict when this permission applies
            </DialogDescription>
          </DialogHeader>
          {conditionBuilder && (
            <div className="space-y-4 py-4">
              <div className="p-2 bg-muted rounded-md">
                <p className="text-sm font-mono">{conditionBuilder.permissionKey}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="field">Field</Label>
                <Input
                  id="field"
                  value={conditionBuilder.field}
                  onChange={(e) => setConditionBuilder({
                    ...conditionBuilder,
                    field: e.target.value
                  })}
                  placeholder="e.g., order.status"
                />
                <p className="text-xs text-muted-foreground">
                  Use dot notation for nested fields (e.g., order.status)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operator">Operator</Label>
                <Select
                  value={conditionBuilder.operator}
                  onValueChange={(value) => setConditionBuilder({
                    ...conditionBuilder,
                    operator: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  value={conditionBuilder.value}
                  onChange={(e) => setConditionBuilder({
                    ...conditionBuilder,
                    value: e.target.value
                  })}
                  placeholder={
                    conditionBuilder.operator === 'in' || conditionBuilder.operator === 'not_in'
                      ? "value1, value2, value3"
                      : "value"
                  }
                />
                {(conditionBuilder.operator === 'in' || conditionBuilder.operator === 'not_in') && (
                  <p className="text-xs text-muted-foreground">
                    Separate multiple values with commas
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConditionBuilder(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCondition}
              disabled={!conditionBuilder?.field || !conditionBuilder?.value}
            >
              Save Condition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
