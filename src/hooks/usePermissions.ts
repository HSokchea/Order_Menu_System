import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantProfile } from '@/hooks/useRestaurantProfile';

export interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  scope: string | null;
}

export interface Role {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  role_type: string;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
}

export interface RoleInheritance {
  id: string;
  parent_role_id: string;
  child_role_id: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  restaurant_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_id: string;
  restaurant_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface PermissionCondition {
  id: string;
  owner_type: 'role' | 'user';
  owner_id: string;
  permission_id: string;
  condition_json: {
    field: string;
    operator: '=' | '!=' | 'in' | 'not_in';
    value: any;
  };
}

export interface EffectivePermission {
  permission_id: string;
  permission_key: string;
  permission_name: string;
  source_type: 'role' | 'inherited' | 'direct';
  source_name: string;
  condition_json: any;
}

export interface RoleTreeNode {
  role_id: string;
  role_name: string;
  role_type: string;
  parent_role_id: string | null;
  parent_role_name: string | null;
  depth: number;
}

// Helper to call edge functions
async function callEdgeFunction<T>(functionName: string, body: any): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Failed to call ${functionName}`);
  }

  return data;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const { restaurant } = useRestaurantProfile();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [roleInheritance, setRoleInheritance] = useState<RoleInheritance[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [conditions, setConditions] = useState<PermissionCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !restaurant) return;

    try {
      setLoading(true);
      
      // Fetch all data in parallel (READ-ONLY via RLS)
      const [
        permissionsRes,
        rolesRes,
        rolePermsRes,
        inheritanceRes,
        userRolesRes,
        userPermsRes,
        conditionsRes
      ] = await Promise.all([
        supabase.from('permissions').select('*').order('resource, action'),
        supabase.from('roles').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('role_permissions').select('*'),
        supabase.from('role_inheritance').select('*'),
        supabase.from('user_roles').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('user_permissions').select('*').eq('restaurant_id', restaurant.id),
        supabase.from('permission_conditions').select('*')
      ]);

      if (permissionsRes.error) throw permissionsRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (rolePermsRes.error) throw rolePermsRes.error;
      if (inheritanceRes.error) throw inheritanceRes.error;
      if (userRolesRes.error) throw userRolesRes.error;
      if (userPermsRes.error) throw userPermsRes.error;
      if (conditionsRes.error) throw conditionsRes.error;

      setPermissions(permissionsRes.data as Permission[]);
      setRoles(rolesRes.data as Role[]);
      setRolePermissions(rolePermsRes.data as RolePermission[]);
      setRoleInheritance(inheritanceRes.data as RoleInheritance[]);
      setUserRoles(userRolesRes.data as UserRole[]);
      setUserPermissions(userPermsRes.data as UserPermission[]);
      setConditions(conditionsRes.data as unknown as PermissionCondition[]);
    } catch (err: any) {
      console.error('Error fetching permissions data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, restaurant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // ROLE OPERATIONS (via Edge Function)
  // ==========================================
  
  const createRole = async (name: string, description: string | null, roleType: string = 'custom') => {
    await callEdgeFunction('manage-role', {
      action: 'create',
      name,
      description,
      role_type: roleType,
    });
    await fetchData();
  };

  const updateRole = async (id: string, updates: { name?: string; description?: string | null }) => {
    await callEdgeFunction('manage-role', {
      action: 'update',
      role_id: id,
      ...updates,
    });
    await fetchData();
  };

  const deleteRole = async (id: string) => {
    await callEdgeFunction('manage-role', {
      action: 'delete',
      role_id: id,
    });
    await fetchData();
  };

  // ==========================================
  // ROLE PERMISSION OPERATIONS (via Edge Function)
  // ==========================================

  const assignPermissionToRole = async (roleId: string, permissionId: string) => {
    await callEdgeFunction('manage-role-permissions', {
      action: 'assign',
      role_id: roleId,
      permission_id: permissionId,
    });
    await fetchData();
  };

  const removePermissionFromRole = async (roleId: string, permissionId: string) => {
    await callEdgeFunction('manage-role-permissions', {
      action: 'remove',
      role_id: roleId,
      permission_id: permissionId,
    });
    await fetchData();
  };

  // ==========================================
  // ROLE INHERITANCE OPERATIONS (via Edge Function)
  // ==========================================

  const addRoleInheritance = async (parentRoleId: string, childRoleId: string) => {
    await callEdgeFunction('manage-role-inheritance', {
      action: 'add',
      parent_role_id: parentRoleId,
      child_role_id: childRoleId,
    });
    await fetchData();
  };

  const removeRoleInheritance = async (parentRoleId: string, childRoleId: string) => {
    await callEdgeFunction('manage-role-inheritance', {
      action: 'remove',
      parent_role_id: parentRoleId,
      child_role_id: childRoleId,
    });
    await fetchData();
  };

  // ==========================================
  // USER ROLE OPERATIONS (via Edge Function)
  // ==========================================

  const assignRoleToUser = async (userId: string, roleId: string) => {
    await callEdgeFunction('manage-user-roles', {
      action: 'assign',
      user_id: userId,
      role_id: roleId,
    });
    await fetchData();
  };

  const removeRoleFromUser = async (userId: string, roleId: string) => {
    await callEdgeFunction('manage-user-roles', {
      action: 'remove',
      user_id: userId,
      role_id: roleId,
    });
    await fetchData();
  };

  const bulkAssignRolesToUser = async (userId: string, roleIds: string[]) => {
    await callEdgeFunction('manage-user-roles', {
      action: 'bulk_assign',
      user_id: userId,
      role_ids: roleIds,
    });
    await fetchData();
  };

  // ==========================================
  // PERMISSION CONDITION OPERATIONS (via Edge Function)
  // ==========================================

  const setPermissionCondition = async (
    ownerType: 'role' | 'user',
    ownerId: string,
    permissionId: string,
    condition: { field: string; operator: string; value: any }
  ) => {
    if (ownerType !== 'role') {
      console.warn('[RBAC] Direct user permission conditions are deprecated');
      return;
    }
    
    await callEdgeFunction('manage-role-permissions', {
      action: 'set_condition',
      role_id: ownerId,
      permission_id: permissionId,
      condition,
    });
    await fetchData();
  };

  const removePermissionCondition = async (
    ownerType: 'role' | 'user',
    ownerId: string,
    permissionId: string
  ) => {
    if (ownerType !== 'role') {
      console.warn('[RBAC] Direct user permission conditions are deprecated');
      return;
    }

    await callEdgeFunction('manage-role-permissions', {
      action: 'remove_condition',
      role_id: ownerId,
      permission_id: permissionId,
    });
    await fetchData();
  };

  // ==========================================
  // DEPRECATED: Direct User Permission Operations
  // ==========================================
  
  /**
   * @deprecated Use role-based permissions instead. Direct user→permission is not RBAC.
   */
  const assignPermissionToUser = async (_userId: string, _permissionId: string) => {
    console.error('[RBAC] Direct user permission assignment is DEPRECATED. Use roles instead.');
    throw new Error('Direct user permission assignment is not allowed. Assign permissions via roles.');
  };

  /**
   * @deprecated Use role-based permissions instead. Direct user→permission is not RBAC.
   */
  const removePermissionFromUser = async (_userId: string, _permissionId: string) => {
    console.error('[RBAC] Direct user permission removal is DEPRECATED. Use roles instead.');
    throw new Error('Direct user permission removal is not allowed. Manage permissions via roles.');
  };

  // ==========================================
  // COMPUTED HELPERS (client-side only)
  // ==========================================

  // Get inherited permissions for a role
  const getRoleEffectivePermissions = (roleId: string): { permissionId: string; isInherited: boolean; sourceRoleId: string }[] => {
    const result: { permissionId: string; isInherited: boolean; sourceRoleId: string }[] = [];
    const visited = new Set<string>();

    const traverse = (currentRoleId: string, isInherited: boolean) => {
      if (visited.has(currentRoleId)) return;
      visited.add(currentRoleId);

      // Add direct permissions for this role
      rolePermissions
        .filter(rp => rp.role_id === currentRoleId)
        .forEach(rp => {
          if (!result.find(r => r.permissionId === rp.permission_id)) {
            result.push({
              permissionId: rp.permission_id,
              isInherited,
              sourceRoleId: currentRoleId
            });
          }
        });

      // Traverse inherited roles
      roleInheritance
        .filter(ri => ri.parent_role_id === currentRoleId)
        .forEach(ri => traverse(ri.child_role_id, true));
    };

    traverse(roleId, false);
    return result;
  };

  // Get role inheritance tree
  const getRoleInheritanceTree = (): RoleTreeNode[] => {
    const result: RoleTreeNode[] = [];
    const childRoleIds = new Set(roleInheritance.map(ri => ri.child_role_id));
    
    // Find root roles (not children of any other role)
    const rootRoles = roles.filter(r => !childRoleIds.has(r.id));

    const traverse = (role: Role, parentId: string | null, parentName: string | null, depth: number) => {
      result.push({
        role_id: role.id,
        role_name: role.name,
        role_type: role.role_type,
        parent_role_id: parentId,
        parent_role_name: parentName,
        depth
      });

      // Find children
      roleInheritance
        .filter(ri => ri.parent_role_id === role.id)
        .forEach(ri => {
          const childRole = roles.find(r => r.id === ri.child_role_id);
          if (childRole) {
            traverse(childRole, role.id, role.name, depth + 1);
          }
        });
    };

    rootRoles.forEach(r => traverse(r, null, null, 0));
    return result;
  };

  // Check if adding inheritance would create a cycle (client-side check)
  const wouldCreateCycle = (parentRoleId: string, childRoleId: string): boolean => {
    if (parentRoleId === childRoleId) return true;
    
    const visited = new Set<string>();
    
    const traverse = (currentId: string): boolean => {
      if (currentId === parentRoleId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      return roleInheritance
        .filter(ri => ri.parent_role_id === currentId)
        .some(ri => traverse(ri.child_role_id));
    };

    return traverse(childRoleId);
  };

  return {
    // State
    permissions,
    roles,
    rolePermissions,
    roleInheritance,
    userRoles,
    userPermissions,
    conditions,
    loading,
    error,
    refetch: fetchData,
    
    // Role operations (Edge Function)
    createRole,
    updateRole,
    deleteRole,
    
    // Role permission operations (Edge Function)
    assignPermissionToRole,
    removePermissionFromRole,
    
    // Role inheritance operations (Edge Function)
    addRoleInheritance,
    removeRoleInheritance,
    wouldCreateCycle,
    
    // User role operations (Edge Function)
    assignRoleToUser,
    removeRoleFromUser,
    bulkAssignRolesToUser,
    
    // Condition operations (Edge Function)
    setPermissionCondition,
    removePermissionCondition,
    
    // DEPRECATED - kept for backward compatibility, but will throw
    assignPermissionToUser,
    removePermissionFromUser,
    
    // Computed helpers (client-side)
    getRoleEffectivePermissions,
    getRoleInheritanceTree,
  };
};
