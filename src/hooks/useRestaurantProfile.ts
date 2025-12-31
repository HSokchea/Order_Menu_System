import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RestaurantProfile {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  currency: string;
  business_type: string | null;
  cuisine_type: string | null;
  default_tax_percentage: number;
  service_charge_percentage: number;
}

export const useRestaurantProfile = () => {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('restaurants')
          .select(`
            id,
            name,
            phone,
            address,
            city,
            country,
            timezone,
            currency,
            business_type,
            cuisine_type,
            default_tax_percentage,
            service_charge_percentage
          `)
          .eq('owner_id', user.id)
          .single();

        if (fetchError) throw fetchError;

        setRestaurant({
          id: data.id,
          name: data.name,
          phone: data.phone,
          address: data.address,
          city: data.city,
          country: data.country,
          timezone: data.timezone,
          currency: data.currency || 'USD',
          business_type: data.business_type,
          cuisine_type: data.cuisine_type,
          default_tax_percentage: Number(data.default_tax_percentage) || 0,
          service_charge_percentage: Number(data.service_charge_percentage) || 0,
        });
      } catch (err: any) {
        console.error('Error fetching restaurant:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [user]);

  return { restaurant, loading, error };
};
