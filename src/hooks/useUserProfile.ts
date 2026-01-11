import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  restaurant_id: string | null;
  status: string;
  must_change_password: boolean;
  role: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  role_id: string;
  role_name: string;
  role_type: string;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  is_onboarded: boolean;
}

export interface EffectivePermission {
  permission_id: string;
  permission_key: string;
  permission_name: string;
  source_type: string;
  source_name: string;
  condition_json: any;
}

/**
 * Permission keys for the application
 * ALL access decisions must be based on these permission keys, NOT role names
 * 
 * IMPORTANT: These keys MUST match the 'key' column in the 'permissions' table
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  
  // Menu management
  MENU_VIEW: 'menu.view',
  MENU_MANAGE: 'menu.manage',
  MENU_CATEGORIES_MANAGE: 'menu.categories.manage',
  
  // Orders
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_DELETE: 'orders.delete',
  ORDERS_MANAGE: 'orders.manage',
  ORDERS_UPDATE_STATUS: 'orders.update.status',
  ORDERS_VIEW_OWN: 'orders.view.own',
  
  // Billing
  BILLING_VIEW: 'billing.view',
  BILLING_COLLECT: 'billing.collect',
  BILLING_REFUND: 'billing.refund',
  
  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  
  // Users/Staff
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  USERS_ASSIGN_ROLES: 'users.assign_roles',
  
  // Roles
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  
  // Tables/Sessions
  TABLES_VIEW: 'tables.view',
  TABLES_MANAGE: 'tables.manage',
  TABLES_SESSIONS_VIEW: 'tables.sessions.view',
  TABLES_SESSIONS_MANAGE: 'tables.sessions.manage',
  
  // QR Codes
  QR_VIEW: 'qr.view',
  QR_MANAGE: 'qr.manage',
} as const;

/**
 * ALL_PERMISSIONS - Owner/Admin gets all these automatically
 * Used for granting full access without role-name checks
 */
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Role type to default permissions mapping
 * This is a FALLBACK only when DB permissions aren't set up yet
 * Access decisions should always use hasPermission(), not role names
 */
/**
 * Role type to default permissions mapping
 * This is a FALLBACK only when DB permissions aren't set up yet
 * Access decisions should always use hasPermission(), not role names
 * 
 * NOTE: These should match the defaults in get_default_role_permissions() database function
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.MENU_MANAGE,
    PERMISSIONS.MENU_CATEGORIES_MANAGE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_COLLECT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_MANAGE,
    PERMISSIONS.TABLES_SESSIONS_VIEW,
    PERMISSIONS.TABLES_SESSIONS_MANAGE,
    PERMISSIONS.QR_VIEW,
    PERMISSIONS.QR_MANAGE,
    PERMISSIONS.USERS_VIEW,
  ],
  supervisor: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_SESSIONS_VIEW,
    PERMISSIONS.QR_VIEW,
  ],
  cashier: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_COLLECT,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_SESSIONS_VIEW,
    PERMISSIONS.TABLES_SESSIONS_MANAGE,
  ],
  waiter: [
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_SESSIONS_VIEW,
  ],
  kitchen: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
  ],
  custom: [], // Custom roles have explicit permissions only
};

/**
 * Permission-based dashboard routing
 * Determines which dashboard to show based on the user's permissions
 */
export const getPermissionBasedDashboard = (hasPermissionFn: (key: string) => boolean): string => {
  // Full dashboard for users with reports access
  if (hasPermissionFn(PERMISSIONS.REPORTS_VIEW) || hasPermissionFn(PERMISSIONS.DASHBOARD_VIEW)) {
    return '/admin';
  }
  // Billing focused for users with billing permissions
  if (hasPermissionFn(PERMISSIONS.BILLING_COLLECT)) {
    return '/admin/table-sessions';
  }
  // Kitchen screen for users with order status update permission
  if (hasPermissionFn(PERMISSIONS.ORDERS_UPDATE_STATUS)) {
    return '/admin/order-dashboard';
  }
  // Order view for users with order permission
  if (hasPermissionFn(PERMISSIONS.ORDERS_VIEW)) {
    return '/admin/order-dashboard';
  }
  // Default fallback
  return '/admin/order-dashboard';
};

export const useUserProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermission[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clear all state - exposed for sign-out
  const clearState = useCallback(() => {
    setProfile(null);
    setRoles([]);
    setEffectivePermissions([]);
    setRestaurant(null);
    setIsOwner(false);
    setError(null);
  }, []);

  const fetchUserProfile = useCallback(async () => {
    if (!user) {
      clearState();
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
      }

      // Check if user is restaurant owner
      const { data: ownedRestaurant } = await supabase
        .from('restaurants')
        .select('id, name, is_onboarded')
        .eq('owner_id', user.id)
        .single();

      let restaurantId: string | null = null;
      let ownerStatus = false;

      if (ownedRestaurant) {
        ownerStatus = true;
        setIsOwner(true);
        setRestaurant(ownedRestaurant);
        restaurantId = ownedRestaurant.id;
      } else if (profileData?.restaurant_id) {
        // Staff - get restaurant info
        const { data: staffRestaurant } = await supabase
          .from('restaurants')
          .select('id, name, is_onboarded')
          .eq('id', profileData.restaurant_id)
          .single();
        
        if (staffRestaurant) {
          setRestaurant(staffRestaurant);
          restaurantId = staffRestaurant.id;
        }
        setIsOwner(false);
      }

      if (profileData) {
        setProfile(profileData as UserProfile);
        
        // Fetch user roles (for display purposes and fallback permissions)
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select(`
            id,
            role_id,
            roles:role_id (
              name,
              role_type
            )
          `)
          .eq('user_id', user.id);

        if (rolesData) {
          const formattedRoles = rolesData.map((r: any) => ({
            id: r.id,
            role_id: r.role_id,
            role_name: r.roles?.name || 'Unknown',
            role_type: r.roles?.role_type || 'custom'
          }));
          setRoles(formattedRoles);
        }

        // Fetch effective permissions using the database function
        // This is the PRIMARY source of truth for access control
        // Permissions are derived from: user_roles -> role_permissions -> permissions
        // Plus any direct user_permissions overrides
        if (restaurantId) {
          console.log('[useUserProfile] Fetching effective permissions for user:', user.id, 'restaurant:', restaurantId);
          
          const { data: permissionsData, error: permError } = await supabase
            .rpc('get_user_effective_permissions', {
              p_user_id: user.id,
              p_restaurant_id: restaurantId
            });

          if (permError) {
            console.error('[useUserProfile] Error fetching effective permissions:', permError);
          } else if (permissionsData) {
            console.log('[useUserProfile] Effective permissions loaded:', permissionsData.length, 'permissions');
            setEffectivePermissions(permissionsData as EffectivePermission[]);
          } else {
            console.warn('[useUserProfile] No permissions returned from database');
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, clearState]);

  useEffect(() => {
    if (!authLoading) {
      fetchUserProfile();
    }
  }, [authLoading, fetchUserProfile]);

  const refetch = () => {
    fetchUserProfile();
  };

  /**
   * Get the primary role type for the user
   * NOTE: This is for display/fallback only - NOT for access decisions
   */
  const getPrimaryRoleType = (): string => {
    if (isOwner) return 'owner';
    
    const roleHierarchy = ['admin', 'manager', 'supervisor', 'cashier', 'waiter', 'kitchen', 'custom'];
    for (const role of roleHierarchy) {
      if (roles.some(r => r.role_type === role)) {
        return role;
      }
    }
    return 'custom';
  };

  /**
   * hasPermission - THE PRIMARY ACCESS CHECK
   * ALL access decisions MUST use this function
   * Never check role names directly
   */
  const hasPermission = useCallback((permissionKey: string): boolean => {
    // Owner has all permissions (this is the ONLY place isOwner affects access)
    if (isOwner) return true;
    
    // Check effective permissions from database (PRIMARY source)
    if (effectivePermissions.some(p => p.permission_key === permissionKey)) {
      return true;
    }
    
    // Fallback to role-based default permissions (for initial setup only)
    const primaryRole = getPrimaryRoleType();
    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[primaryRole] || [];
    return defaultPerms.includes(permissionKey);
  }, [isOwner, effectivePermissions, roles]);

  /**
   * hasAnyPermission - Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = useCallback((permissionKeys: string[]): boolean => {
    return permissionKeys.some(key => hasPermission(key));
  }, [hasPermission]);

  /**
   * hasAllPermissions - Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = useCallback((permissionKeys: string[]): boolean => {
    return permissionKeys.every(key => hasPermission(key));
  }, [hasPermission]);

  /**
   * getDefaultDashboard - Permission-based dashboard routing
   * Uses permissions to determine appropriate dashboard
   */
  const getDefaultDashboard = useCallback((): string => {
    return getPermissionBasedDashboard(hasPermission);
  }, [hasPermission]);

  /**
   * hasRoleType - Check if user has a specific role type
   * NOTE: Use only for display purposes, NOT for access decisions
   * @deprecated Use hasPermission() instead for access control
   */
  const hasRoleType = (roleType: string): boolean => {
    if (isOwner) return roleType === 'owner';
    return roles.some(r => r.role_type === roleType);
  };

  // Check if user is active
  const isActive = profile?.status === 'active' || isOwner;

  // Check if user needs to change password
  const mustChangePassword = profile?.must_change_password === true && !isOwner;

  /**
   * getAllPermissionKeys - Get list of all permissions the user has
   * Useful for debugging and permission display
   */
  const getAllPermissionKeys = useCallback((): string[] => {
    if (isOwner) return ALL_PERMISSIONS;
    
    const dbPerms = effectivePermissions.map(p => p.permission_key);
    if (dbPerms.length > 0) return dbPerms;
    
    // Fallback
    const primaryRole = getPrimaryRoleType();
    return ROLE_DEFAULT_PERMISSIONS[primaryRole] || [];
  }, [isOwner, effectivePermissions, roles]);

  return {
    user,
    profile,
    roles,
    effectivePermissions,
    restaurant,
    isOwner,
    isActive,
    mustChangePassword,
    // Primary access check functions
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getDefaultDashboard,
    getAllPermissionKeys,
    // Role helpers (for display/fallback only)
    hasRoleType,
    getPrimaryRoleType,
    loading: authLoading || loading,
    error,
    refetch,
    clearState,
  };
};
