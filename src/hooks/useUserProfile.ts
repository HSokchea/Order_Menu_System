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

// Permission keys for the application
export const PERMISSIONS = {
  // Menu management
  MENU_VIEW: 'menu.view',
  MENU_MANAGE: 'menu.manage',
  
  // Orders
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  ORDERS_UPDATE_STATUS: 'orders.update.status',
  
  // Billing
  BILLING_VIEW: 'billing.view',
  BILLING_COLLECT: 'billing.collect',
  
  // Reports
  REPORTS_VIEW: 'reports.view',
  
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  
  // Users
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  
  // Tables/Sessions
  TABLES_VIEW: 'tables.view',
  TABLES_MANAGE: 'tables.manage',
  
  // QR Codes
  QR_VIEW: 'qr.view',
  QR_MANAGE: 'qr.manage',
} as const;

// Role type to default permissions mapping
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  owner: Object.values(PERMISSIONS), // All permissions
  admin: Object.values(PERMISSIONS), // All permissions
  manager: [
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_MANAGE,
  ],
  supervisor: [
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.TABLES_VIEW,
  ],
  cashier: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_COLLECT,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_MANAGE,
  ],
  waiter: [
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.TABLES_VIEW,
  ],
  kitchen: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE_STATUS,
  ],
  custom: [], // Custom roles have explicit permissions only
};

// Role type to default dashboard mapping
export const ROLE_DEFAULT_DASHBOARD: Record<string, string> = {
  owner: '/admin',
  admin: '/admin',
  manager: '/admin/order-dashboard',
  supervisor: '/admin/order-dashboard',
  cashier: '/admin/table-sessions',
  waiter: '/admin/order-dashboard',
  kitchen: '/admin/order-dashboard',
  custom: '/admin/order-dashboard',
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

  const fetchUserProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setRoles([]);
      setEffectivePermissions([]);
      setRestaurant(null);
      setIsOwner(false);
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

      if (ownedRestaurant) {
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
      }

      if (profileData) {
        setProfile(profileData as UserProfile);
        
        // Fetch user roles
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
        if (restaurantId) {
          const { data: permissionsData, error: permError } = await supabase
            .rpc('get_user_effective_permissions', {
              p_user_id: user.id,
              p_restaurant_id: restaurantId
            });

          if (permError) {
            console.error('Error fetching effective permissions:', permError);
          } else if (permissionsData) {
            setEffectivePermissions(permissionsData as EffectivePermission[]);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchUserProfile();
    }
  }, [authLoading, fetchUserProfile]);

  const refetch = () => {
    fetchUserProfile();
  };

  // Helper to check if user has a specific role type
  const hasRoleType = (roleType: string): boolean => {
    if (isOwner) return roleType === 'owner';
    return roles.some(r => r.role_type === roleType);
  };

  // Get primary role type (highest privilege)
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

  // Check if user has a specific permission
  const hasPermission = (permissionKey: string): boolean => {
    // Owner has all permissions
    if (isOwner) return true;
    
    // Check effective permissions from database
    if (effectivePermissions.some(p => p.permission_key === permissionKey)) {
      return true;
    }
    
    // Fallback to role-based default permissions
    const primaryRole = getPrimaryRoleType();
    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[primaryRole] || [];
    return defaultPerms.includes(permissionKey);
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissionKeys: string[]): boolean => {
    return permissionKeys.some(key => hasPermission(key));
  };

  // Check if user has all of the specified permissions
  const hasAllPermissions = (permissionKeys: string[]): boolean => {
    return permissionKeys.every(key => hasPermission(key));
  };

  // Get the default dashboard for the user based on their role
  const getDefaultDashboard = (): string => {
    const primaryRole = getPrimaryRoleType();
    return ROLE_DEFAULT_DASHBOARD[primaryRole] || '/admin/order-dashboard';
  };

  // Check if user is active
  const isActive = profile?.status === 'active' || isOwner;

  // Check if user needs to change password
  const mustChangePassword = profile?.must_change_password === true && !isOwner;

  return {
    user,
    profile,
    roles,
    effectivePermissions,
    restaurant,
    isOwner,
    isActive,
    mustChangePassword,
    hasRoleType,
    getPrimaryRoleType,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getDefaultDashboard,
    loading: authLoading || loading,
    error,
    refetch
  };
};
