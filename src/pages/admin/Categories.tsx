import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import CategoryManager from '@/components/admin/CategoryManager';
import CategoryControls from '@/components/admin/CategoryControls';

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
    <div className="space-y-6">
      {/* Sticky Header with filters and controls */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Categories</h2>
              <p className="text-sm text-muted-foreground">
                Showing {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CategoryControls 
                restaurantId={restaurantId}
                onCategoriesUpdate={fetchData}
              />
            </div>
          </div>
        </div>
      </div>

      <CategoryManager
        categories={categories}
        restaurantId={restaurantId}
        onCategoriesUpdate={fetchData}
        showControls={false}
      />
    </div>
  );
};

export default Categories;