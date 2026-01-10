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
      
      // Fetch all data in parallel
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

  // Role CRUD operations
  const createRole = async (name: string, description: string | null, roleType: string = 'custom') => {
    if (!restaurant) throw new Error('No restaurant');
    
    const { data, error } = await supabase
      .from('roles')
      .insert({
        restaurant_id: restaurant.id,
        name,
        description,
        role_type: roleType as any
      })
      .select()
      .single();

    if (error) throw error;
    await fetchData();
    return data;
  };

  const updateRole = async (id: string, updates: { name?: string; description?: string | null }) => {
    const { error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchData();
  };

  const deleteRole = async (id: string) => {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchData();
  };

  // Role permission operations
  const assignPermissionToRole = async (roleId: string, permissionId: string) => {
    const { error } = await supabase
      .from('role_permissions')
      .insert({ role_id: roleId, permission_id: permissionId });

    if (error) throw error;
    await fetchData();
  };

  const removePermissionFromRole = async (roleId: string, permissionId: string) => {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId);

    if (error) throw error;
    await fetchData();
  };

  // Role inheritance operations
  const addRoleInheritance = async (parentRoleId: string, childRoleId: string) => {
    const { error } = await supabase
      .from('role_inheritance')
      .insert({ parent_role_id: parentRoleId, child_role_id: childRoleId });

    if (error) throw error;
    await fetchData();
  };

  const removeRoleInheritance = async (parentRoleId: string, childRoleId: string) => {
    const { error } = await supabase
      .from('role_inheritance')
      .delete()
      .eq('parent_role_id', parentRoleId)
      .eq('child_role_id', childRoleId);

    if (error) throw error;
    await fetchData();
  };

  // User role operations
  const assignRoleToUser = async (userId: string, roleId: string) => {
    if (!restaurant || !user) throw new Error('No restaurant or user');

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        restaurant_id: restaurant.id,
        assigned_by: user.id
      });

    if (error) throw error;
    await fetchData();
  };

  const removeRoleFromUser = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) throw error;
    await fetchData();
  };

  // Direct user permission operations
  const assignPermissionToUser = async (userId: string, permissionId: string) => {
    if (!restaurant || !user) throw new Error('No restaurant or user');

    const { error } = await supabase
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permissionId,
        restaurant_id: restaurant.id,
        assigned_by: user.id
      });

    if (error) throw error;
    await fetchData();
  };

  const removePermissionFromUser = async (userId: string, permissionId: string) => {
    if (!restaurant) throw new Error('No restaurant');

    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId)
      .eq('restaurant_id', restaurant.id);

    if (error) throw error;
    await fetchData();
  };

  // Permission condition operations
  const setPermissionCondition = async (
    ownerType: 'role' | 'user',
    ownerId: string,
    permissionId: string,
    condition: { field: string; operator: string; value: any }
  ) => {
    const { error } = await supabase
      .from('permission_conditions')
      .upsert({
        owner_type: ownerType,
        owner_id: ownerId,
        permission_id: permissionId,
        condition_json: condition
      }, {
        onConflict: 'owner_type,owner_id,permission_id'
      });

    if (error) throw error;
    await fetchData();
  };

  const removePermissionCondition = async (
    ownerType: 'role' | 'user',
    ownerId: string,
    permissionId: string
  ) => {
    const { error } = await supabase
      .from('permission_conditions')
      .delete()
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .eq('permission_id', permissionId);

    if (error) throw error;
    await fetchData();
  };

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

  // Check if adding inheritance would create a cycle
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
    // Role operations
    createRole,
    updateRole,
    deleteRole,
    // Role permission operations
    assignPermissionToRole,
    removePermissionFromRole,
    // Role inheritance operations
    addRoleInheritance,
    removeRoleInheritance,
    wouldCreateCycle,
    // User role operations
    assignRoleToUser,
    removeRoleFromUser,
    // User permission operations
    assignPermissionToUser,
    removePermissionFromUser,
    // Condition operations
    setPermissionCondition,
    removePermissionCondition,
    // Computed
    getRoleEffectivePermissions,
    getRoleInheritanceTree,
  };
};
