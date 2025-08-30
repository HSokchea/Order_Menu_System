import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import CategoryManager from '@/components/admin/CategoryManager';

interface Category {
  id: string;
  name: string;
  description?: string;
  status: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  restaurant_id: string;
}

const Categories = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string>('');

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch restaurant
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!restaurant) return;
      
      setRestaurantId(restaurant.id);

      // Fetch categories with updated fields
      const { data: categoriesData } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('display_order');

      setCategories(categoriesData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <CategoryManager
        categories={categories}
        restaurantId={restaurantId}
        onCategoriesUpdate={fetchData}
      />
    </div>
  );
};

export default Categories;