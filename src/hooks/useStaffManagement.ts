import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantProfile } from '@/hooks/useRestaurantProfile';

export interface StaffMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  status: 'active' | 'inactive';
  role_ids: string[];
  role_names: string[];
  created_at: string;
  is_owner: boolean;
}

export interface CreateStaffInput {
  email: string;
  full_name: string;
  role_ids: string[];
  status: 'active' | 'inactive';
}

export interface UpdateStaffInput {
  user_id: string;
  full_name?: string;
  role_ids?: string[];
  status?: 'active' | 'inactive';
}

export const useStaffManagement = () => {
  const { user } = useAuth();
  const { restaurant } = useRestaurantProfile();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Fetch staff members with their roles
  const { data: staffMembers = [], isLoading, refetch } = useQuery({
    queryKey: ['staff-members', restaurant?.id],
    queryFn: async () => {
      if (!restaurant || !user) return [];

      // Get profiles for this restaurant
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, status, created_at')
        .eq('restaurant_id', restaurant.id);

      if (profilesError) throw profilesError;

      // Get all user roles for this restaurant
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_id, roles(id, name)')
        .eq('restaurant_id', restaurant.id);

      if (rolesError) throw rolesError;

      // Get restaurant owner info
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('owner_id')
        .eq('id', restaurant.id)
        .single();

      if (restaurantError) throw restaurantError;

      // Get auth users to get emails (using the admin's own email for now)
      // Note: We can only get the current user's email via supabase.auth
      // For other users, we'd need an admin function

      const staffList: StaffMember[] = profiles.map(profile => {
        const roles = userRoles
          .filter(ur => ur.user_id === profile.user_id)
          .map(ur => ({
            id: (ur.roles as any)?.id || ur.role_id,
            name: (ur.roles as any)?.name || 'Unknown Role'
          }));

        const isOwner = profile.user_id === restaurantData.owner_id;

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email || (profile.user_id === user.id ? user.email! : 'No email'),
          status: (profile.status as 'active' | 'inactive') || 'active',
          role_ids: roles.map(r => r.id),
          role_names: isOwner ? ['Owner'] : roles.map(r => r.name),
          created_at: profile.created_at,
          is_owner: isOwner
        };
      });

      // Sort: owner first, then by name
      return staffList.sort((a, b) => {
        if (a.is_owner && !b.is_owner) return -1;
        if (!a.is_owner && b.is_owner) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
    },
    enabled: !!restaurant && !!user
  });

  // Create staff mutation
  const createStaffMutation = useMutation({
    mutationFn: async (input: CreateStaffInput) => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(input),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff');
      }

      return data;
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  // Update staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: async (input: UpdateStaffInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-staff-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(input),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update staff');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-staff-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete staff');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  // Toggle status (deactivate/activate)
  const toggleStatus = useCallback(async (userId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    return updateStaffMutation.mutateAsync({
      user_id: userId,
      status: newStatus
    });
  }, [updateStaffMutation]);

  return {
    staffMembers,
    isLoading,
    error,
    refetch,
    createStaff: createStaffMutation.mutateAsync,
    updateStaff: updateStaffMutation.mutateAsync,
    deleteStaff: deleteStaffMutation.mutateAsync,
    toggleStatus,
    isCreating: createStaffMutation.isPending,
    isUpdating: updateStaffMutation.isPending,
    isDeleting: deleteStaffMutation.isPending
  };
};
