import { useState } from "react";
import { usePermissions, Role } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GitBranch, Lock, X } from "lucide-react";
import { RoleInheritanceTree } from "./RoleInheritanceTree";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const ROLE_TYPES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'waiter', label: 'Waiter' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'custom', label: 'Custom' },
];

export function RolesManagement() {
  const {
    roles,
    roleInheritance,
    createRole,
    updateRole,
    deleteRole,
    addRoleInheritance,
    removeRoleInheritance,
    wouldCreateCycle,
    getRoleInheritanceTree
  } = usePermissions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [inheritanceDialogRole, setInheritanceDialogRole] = useState<Role | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role_type: 'custom'
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({ name: '', description: '', role_type: 'custom' });
    setFormErrors({});
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setFormErrors(prev => ({ ...prev, name: "Role name is required" }));
      return;
    }

    try {
      await createRole(formData.name, formData.description || null, formData.role_type);
      toast.success("Role created successfully");
      setIsCreateOpen(false);
      resetForm();
    } catch (err: any) {
      const message = err.message || "Failed to create role";
      if (message.includes("roles_restaurant_id_name_key") || message.includes("duplicate key")) {
        toast.error("This role name already exists.");
      } else {
        toast.error(message);
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingRole || !formData.name.trim()) return;

    try {
      await updateRole(editingRole.id, {
        name: formData.name,
        description: formData.description || null
      });
      toast.success("Role updated successfully");
      setEditingRole(null);
      resetForm();
    } catch (err: any) {
      const message = err.message || "Failed to update role";
      if (message.includes("roles_restaurant_id_name_key") || message.includes("duplicate key")) {
        toast.error("This role name already exists.");
      } else {
        toast.error(message);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmRole) return;

    try {
      await deleteRole(deleteConfirmRole.id);
      toast.success("Role deleted successfully");
      setDeleteConfirmRole(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    }
  };

  const handleAddInheritance = async (childRoleId: string) => {
    if (!inheritanceDialogRole) return;

    if (wouldCreateCycle(inheritanceDialogRole.id, childRoleId)) {
      toast.error("Cannot add inheritance: would create a circular dependency");
      return;
    }

    try {
      await addRoleInheritance(inheritanceDialogRole.id, childRoleId);
      toast.success("Inheritance added successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to add inheritance");
    }
  };

  const handleRemoveInheritance = async (childRoleId: string) => {
    if (!inheritanceDialogRole) return;

    try {
      await removeRoleInheritance(inheritanceDialogRole.id, childRoleId);
      toast.success("Inheritance removed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove inheritance");
    }
  };

  const getInheritedRoles = (roleId: string) => {
    return roleInheritance
      .filter(ri => ri.parent_role_id === roleId)
      .map(ri => roles.find(r => r.id === ri.child_role_id))
      .filter(Boolean) as Role[];
  };

  const getAvailableRolesForInheritance = (parentRoleId: string) => {
    const currentChildren = roleInheritance
      .filter(ri => ri.parent_role_id === parentRoleId)
      .map(ri => ri.child_role_id);

    return roles.filter(r =>
      r.id !== parentRoleId &&
      !currentChildren.includes(r.id) &&
      !wouldCreateCycle(parentRoleId, r.id)
    );
  };

  const inheritanceTree = getRoleInheritanceTree();

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Role Definitions</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage roles. Assign permissions in the Permissions tab.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" hideCloseButton>
            <DialogHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex flex-col gap-2">
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Create a new role to group permissions together
                </DialogDescription>
              </div>

              <Button variant="custom" size="custom" className='pb-8' aria-label="Close dialog" onClick={() => setIsCreateOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter role name"
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Role Type</Label>
                <Select
                  value={formData.role_type}
                  onValueChange={(value) => setFormData({ ...formData, role_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this role is for..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate}>Create Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inheritance Tree Visualization */}
      {inheritanceTree.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Inheritance Tree
            </CardTitle>
            <CardDescription>
              Visual representation of role hierarchy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleInheritanceTree tree={inheritanceTree} />
          </CardContent>
        </Card>
      )}

      {/* Roles List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const inheritedRoles = getInheritedRoles(role.id);

          return (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {role.name}
                      {role.is_system_role && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {role.role_type}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setInheritanceDialogRole(role)}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingRole(role);
                        setFormData({
                          name: role.name,
                          description: role.description || '',
                          role_type: role.role_type
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.is_system_role && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmRole(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {role.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {role.description}
                  </p>
                )}
                {inheritedRoles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Inherits from:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {inheritedRoles.map(ir => (
                        <Badge key={ir.id} variant="secondary" className="text-xs">
                          {ir.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {roles.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No roles created yet. Create your first role to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Role Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inheritance Management Dialog */}
      <Dialog
        open={!!inheritanceDialogRole}
        onOpenChange={(open) => !open && setInheritanceDialogRole(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Manage Inheritance: {inheritanceDialogRole?.name}
            </DialogTitle>
            <DialogDescription>
              Configure which roles this role inherits permissions from
            </DialogDescription>
          </DialogHeader>
          {inheritanceDialogRole && (
            <div className="space-y-4 py-4">
              {/* Current inherited roles */}
              <div className="space-y-2">
                <Label>Currently Inherits From</Label>
                {getInheritedRoles(inheritanceDialogRole.id).length > 0 ? (
                  <div className="space-y-2">
                    {getInheritedRoles(inheritanceDialogRole.id).map(role => (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-md"
                      >
                        <span className="text-sm">{role.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveInheritance(role.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This role doesn't inherit from any other roles
                  </p>
                )}
              </div>

              {/* Add new inheritance */}
              <div className="space-y-2">
                <Label>Add Inheritance</Label>
                {getAvailableRolesForInheritance(inheritanceDialogRole.id).length > 0 ? (
                  <div className="space-y-2">
                    {getAvailableRolesForInheritance(inheritanceDialogRole.id).map(role => (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-2 border rounded-md"
                      >
                        <div>
                          <span className="text-sm font-medium">{role.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {role.role_type}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => handleAddInheritance(role.id)}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No other roles available for inheritance
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setInheritanceDialogRole(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmRole}
        onOpenChange={(open) => !open && setDeleteConfirmRole(null)}
        title="Delete Role"
        description={`Are you sure you want to delete "${deleteConfirmRole?.name}"? This action cannot be undone and will remove this role from all users.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
