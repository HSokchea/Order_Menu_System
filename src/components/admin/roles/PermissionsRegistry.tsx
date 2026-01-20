import { useState, useEffect, useMemo, useCallback } from "react";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";

interface LocalPermission extends Permission {
  _isNew?: boolean;
  _isDeleted?: boolean;
  _isDirty?: boolean;
}

interface PermissionsRegistryProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

/**
 * PermissionsRegistry - Permissions Tab (Batch Save Model)
 * 
 * PURPOSE: Manage permission definitions (system registry)
 * 
 * ALLOWED:
 * - Create new permission definitions
 * - Edit permission key, name, description, resource, action, scope
 * - Delete unused permissions
 * - Batch save all changes with "Save Changes" button
 * 
 * FORBIDDEN:
 * - Assigning permissions to roles (use Role Permissions tab)
 * - Assigning permissions directly to users
 * - Editing permission conditions (disabled in v1)
 */
export function PermissionsRegistry({ onUnsavedChanges }: PermissionsRegistryProps) {
  const { permissions, refetch } = usePermissions();
  
  // Local state for editing
  const [localPermissions, setLocalPermissions] = useState<LocalPermission[]>([]);
  const [initialPermissions, setInitialPermissions] = useState<Permission[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Initialize local state from server data
  useEffect(() => {
    if (permissions.length > 0 || localPermissions.length === 0) {
      setLocalPermissions(permissions.map(p => ({ ...p })));
      setInitialPermissions(permissions.map(p => ({ ...p })));
    }
  }, [permissions]);

  // Calculate if there are unsaved changes
  const hasChanges = useMemo(() => {
    // Check for new permissions
    const newPerms = localPermissions.filter(p => p._isNew && !p._isDeleted);
    if (newPerms.length > 0) return true;
    
    // Check for deleted permissions
    const deletedPerms = localPermissions.filter(p => p._isDeleted && !p._isNew);
    if (deletedPerms.length > 0) return true;
    
    // Check for modified permissions
    for (const local of localPermissions) {
      if (local._isNew || local._isDeleted) continue;
      
      const initial = initialPermissions.find(p => p.id === local.id);
      if (!initial) continue;
      
      if (
        local.key !== initial.key ||
        local.name !== initial.name ||
        local.description !== initial.description ||
        local.resource !== initial.resource ||
        local.action !== initial.action ||
        local.scope !== initial.scope
      ) {
        return true;
      }
    }
    
    return false;
  }, [localPermissions, initialPermissions]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(hasChanges);
  }, [hasChanges, onUnsavedChanges]);

  // Add new permission
  const handleAddPermission = useCallback(() => {
    const newId = `new-${Date.now()}`;
    setLocalPermissions(prev => [
      ...prev,
      {
        id: newId,
        key: "",
        name: "",
        description: null,
        resource: "",
        action: "",
        scope: null,
        _isNew: true,
      },
    ]);
  }, []);

  // Update local permission field
  const handleUpdateField = useCallback((id: string, field: keyof Permission, value: string) => {
    setLocalPermissions(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, [field]: value || (field === 'description' || field === 'scope' ? null : value), _isDirty: true }
          : p
      )
    );
  }, []);

  // Mark permission for deletion
  const handleDeletePermission = useCallback((id: string) => {
    setLocalPermissions(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, _isDeleted: true }
          : p
      )
    );
    setDeleteConfirmId(null);
  }, []);

  // Undo delete
  const handleUndoDelete = useCallback((id: string) => {
    setLocalPermissions(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, _isDeleted: false }
          : p
      )
    );
  }, []);

  // Remove new unsaved permission
  const handleRemoveNew = useCallback((id: string) => {
    setLocalPermissions(prev => prev.filter(p => p.id !== id));
  }, []);

  // Discard all changes
  const handleDiscardChanges = useCallback(() => {
    setLocalPermissions(initialPermissions.map(p => ({ ...p })));
    toast.info("Changes discarded");
  }, [initialPermissions]);

  // Save all changes
  const handleSaveChanges = useCallback(async () => {
    setIsSaving(true);
    
    try {
      // Validate all permissions
      const validationErrors: string[] = [];
      const visiblePermissions = localPermissions.filter(p => !p._isDeleted);
      
      for (const perm of visiblePermissions) {
        if (!perm.key?.trim()) {
          validationErrors.push(`Permission key is required`);
        }
        if (!perm.name?.trim()) {
          validationErrors.push(`Permission name is required for "${perm.key || 'new permission'}"`);
        }
        if (!perm.resource?.trim()) {
          validationErrors.push(`Resource is required for "${perm.key || 'new permission'}"`);
        }
        if (!perm.action?.trim()) {
          validationErrors.push(`Action is required for "${perm.key || 'new permission'}"`);
        }
      }
      
      // Check for duplicate keys
      const keys = visiblePermissions.map(p => p.key);
      const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
      if (duplicates.length > 0) {
        validationErrors.push(`Duplicate permission keys: ${[...new Set(duplicates)].join(", ")}`);
      }
      
      if (validationErrors.length > 0) {
        validationErrors.forEach(err => toast.error(err));
        setIsSaving(false);
        return;
      }
      
      // Compute diff
      const creates = localPermissions
        .filter(p => p._isNew && !p._isDeleted)
        .map(p => ({
          key: p.key,
          name: p.name,
          description: p.description,
          resource: p.resource,
          action: p.action,
          scope: p.scope,
        }));
      
      const updates = localPermissions
        .filter(p => !p._isNew && !p._isDeleted)
        .filter(p => {
          const initial = initialPermissions.find(ip => ip.id === p.id);
          if (!initial) return false;
          return (
            p.key !== initial.key ||
            p.name !== initial.name ||
            p.description !== initial.description ||
            p.resource !== initial.resource ||
            p.action !== initial.action ||
            p.scope !== initial.scope
          );
        })
        .map(p => ({
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          resource: p.resource,
          action: p.action,
          scope: p.scope,
        }));
      
      const deletes = localPermissions
        .filter(p => p._isDeleted && !p._isNew)
        .map(p => p.id);
      
      // Call edge function
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error("Not authenticated");
        setIsSaving(false);
        return;
      }
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-permissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: "batch_save",
            creates,
            updates,
            deletes,
          }),
        }
      );
      
      const data = await res.json();
      
      if (!res.ok && res.status !== 207) {
        throw new Error(data.error || "Failed to save changes");
      }
      
      // Handle partial success
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((err: string) => toast.error(err));
      }
      
      if (data.results) {
        const { created, updated, deleted } = data.results;
        const messages = [];
        if (created > 0) messages.push(`${created} created`);
        if (updated > 0) messages.push(`${updated} updated`);
        if (deleted > 0) messages.push(`${deleted} deleted`);
        
        if (messages.length > 0) {
          toast.success(`Permissions saved: ${messages.join(", ")}`);
        }
      }
      
      // Refresh data from server
      await refetch();
      
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [localPermissions, initialPermissions, refetch]);

  // Group visible permissions by resource
  const groupedPermissions = useMemo(() => {
    const visible = localPermissions.filter(p => !p._isDeleted);
    const groups: Record<string, LocalPermission[]> = {};
    
    visible.forEach(perm => {
      const resource = perm.resource || "Uncategorized";
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(perm);
    });
    
    // Sort by resource name
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    return sorted;
  }, [localPermissions]);

  // Deleted permissions for review
  const pendingDeletes = useMemo(() => {
    return localPermissions.filter(p => p._isDeleted && !p._isNew);
  }, [localPermissions]);

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Permission Definitions</h3>
          <p className="text-sm text-muted-foreground">
            Define system permissions. Changes are saved together with the Save button.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleDiscardChanges} disabled={isSaving}>
              Discard
            </Button>
          )}
          <Button
            onClick={handleSaveChanges}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Indicator */}
      {hasChanges && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            You have unsaved changes. Click "Save Changes" to apply them.
          </span>
        </div>
      )}

      {/* Pending Deletions */}
      {pendingDeletes.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Pending Deletions</CardTitle>
            <CardDescription>
              These permissions will be deleted when you save. Click "Undo" to restore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingDeletes.map(perm => (
                <div key={perm.id} className="flex items-center justify-between p-2 bg-background rounded border">
                  <div>
                    <span className="font-medium text-sm">{perm.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({perm.key})</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleUndoDelete(perm.id)}>
                    Undo
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Permission Button */}
      <Button variant="outline" onClick={handleAddPermission}>
        <Plus className="h-4 w-4 mr-2" />
        Add Permission
      </Button>

      {/* Permissions List */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-6 pr-4">
          {groupedPermissions.map(([resource, perms]) => (
            <Card key={resource}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base capitalize flex items-center gap-2">
                  {resource}
                  <Badge variant="secondary">{perms.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {perms.map(perm => (
                    <PermissionEditor
                      key={perm.id}
                      permission={perm}
                      onUpdate={handleUpdateField}
                      onDelete={perm._isNew ? handleRemoveNew : setDeleteConfirmId}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {groupedPermissions.length === 0 && !hasChanges && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No permissions defined yet. Click "Add Permission" to create one.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Permission"
        description="This permission will be marked for deletion. You can undo this before saving. If this permission is assigned to any roles, deletion will fail."
        confirmLabel="Delete"
        onConfirm={() => deleteConfirmId && handleDeletePermission(deleteConfirmId)}
        variant="destructive"
      />
    </div>
  );
}

// Individual Permission Editor
function PermissionEditor({
  permission,
  onUpdate,
  onDelete,
}: {
  permission: LocalPermission;
  onUpdate: (id: string, field: keyof Permission, value: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`p-4 border rounded-lg space-y-4 ${permission._isNew ? 'border-primary/50 bg-primary/5' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-2 gap-4">
          {/* Key */}
          <div className="space-y-1.5">
            <Label htmlFor={`key-${permission.id}`} className="text-xs">
              Key <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`key-${permission.id}`}
              value={permission.key}
              onChange={(e) => onUpdate(permission.id, "key", e.target.value)}
              placeholder="e.g., orders.view"
              className="font-mono text-sm"
            />
          </div>
          
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor={`name-${permission.id}`} className="text-xs">
              Display Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`name-${permission.id}`}
              value={permission.name}
              onChange={(e) => onUpdate(permission.id, "name", e.target.value)}
              placeholder="e.g., View Orders"
            />
          </div>
          
          {/* Resource */}
          <div className="space-y-1.5">
            <Label htmlFor={`resource-${permission.id}`} className="text-xs">
              Resource <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`resource-${permission.id}`}
              value={permission.resource}
              onChange={(e) => onUpdate(permission.id, "resource", e.target.value)}
              placeholder="e.g., orders"
            />
          </div>
          
          {/* Action */}
          <div className="space-y-1.5">
            <Label htmlFor={`action-${permission.id}`} className="text-xs">
              Action <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`action-${permission.id}`}
              value={permission.action}
              onChange={(e) => onUpdate(permission.id, "action", e.target.value)}
              placeholder="e.g., view"
            />
          </div>
          
          {/* Scope */}
          <div className="space-y-1.5">
            <Label htmlFor={`scope-${permission.id}`} className="text-xs">
              Scope (optional)
            </Label>
            <Input
              id={`scope-${permission.id}`}
              value={permission.scope || ""}
              onChange={(e) => onUpdate(permission.id, "scope", e.target.value)}
              placeholder="e.g., own, all"
            />
          </div>
        </div>
        
        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(permission.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor={`desc-${permission.id}`} className="text-xs">
          Description
        </Label>
        <Textarea
          id={`desc-${permission.id}`}
          value={permission.description || ""}
          onChange={(e) => onUpdate(permission.id, "description", e.target.value)}
          placeholder="Describe what this permission allows..."
          rows={2}
        />
      </div>
      
      {permission._isNew && (
        <Badge variant="outline" className="text-xs">New</Badge>
      )}
    </div>
  );
}
