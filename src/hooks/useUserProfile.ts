import { useState, useEffect } from 'react';
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

export const useUserProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    if (!user) {
      setProfile(null);
      setRoles([]);
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

      if (profileError) {
        // Profile might not exist yet for owners
        console.log('Profile not found, checking if owner...');
      }

      // Check if user is restaurant owner
      const { data: ownedRestaurant, error: ownerError } = await supabase
        .from('restaurants')
        .select('id, name, is_onboarded')
        .eq('owner_id', user.id)
        .single();

      if (ownedRestaurant) {
        setIsOwner(true);
        setRestaurant(ownedRestaurant);
      } else if (profileData?.restaurant_id) {
        // Staff - get restaurant info
        const { data: staffRestaurant } = await supabase
          .from('restaurants')
          .select('id, name, is_onboarded')
          .eq('id', profileData.restaurant_id)
          .single();
        
        if (staffRestaurant) {
          setRestaurant(staffRestaurant);
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
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchUserProfile();
    }
  }, [user, authLoading]);

  const refetch = () => {
    fetchUserProfile();
  };

  // Helper to check if user has a specific role type
  const hasRoleType = (roleType: string): boolean => {
    if (isOwner) return roleType === 'owner';
    return roles.some(r => r.role_type === roleType);
  };

  // Check if user is active
  const isActive = profile?.status === 'active' || isOwner;

  // Check if user needs to change password
  const mustChangePassword = profile?.must_change_password === true && !isOwner;

  return {
    user,
    profile,
    roles,
    restaurant,
    isOwner,
    isActive,
    mustChangePassword,
    hasRoleType,
    loading: authLoading || loading,
    error,
    refetch
  };
};
