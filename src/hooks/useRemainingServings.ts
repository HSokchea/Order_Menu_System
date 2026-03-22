import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IngredientServings {
  [ingredientId: string]: {
    minServings: number;
    recipes: { menuItemName: string; servings: number; sizeName?: string }[];
  };
}

export const useRemainingServings = (restaurantId: string) => {
  const [servingsMap, setServingsMap] = useState<IngredientServings>({});
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    try {
      // Fetch all recipes with ingredient + menu item info in one query
      const { data: recipes, error } = await supabase
        .from('menu_item_ingredients')
        .select(`
          ingredient_id,
          quantity,
          size_id,
          menu_item:menu_items!inner(id, name, restaurant_id, is_available),
          size:menu_item_sizes(name)
        `)
        .eq('menu_item.restaurant_id', restaurantId);

      if (error || !recipes) {
        console.error('Error fetching recipes for servings:', error);
        setLoading(false);
        return;
      }

      // Fetch current stock for all ingredients
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('id, current_stock')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true);

      if (!ingredients) { setLoading(false); return; }

      const stockMap: Record<string, number> = {};
      ingredients.forEach(i => { stockMap[i.id] = i.current_stock; });

      const result: IngredientServings = {};

      recipes.forEach((r: any) => {
        const ingId = r.ingredient_id;
        const qty = r.quantity;
        if (!qty || qty <= 0) return;

        const stock = stockMap[ingId];
        if (stock === undefined) return;

        const menuItem = Array.isArray(r.menu_item) ? r.menu_item[0] : r.menu_item;
        if (!menuItem) return;

        const sizeName = Array.isArray(r.size) ? r.size[0]?.name : r.size?.name;
        const servings = Math.floor(stock / qty);
        const itemLabel = sizeName ? `${menuItem.name} (${sizeName})` : menuItem.name;

        if (!result[ingId]) {
          result[ingId] = { minServings: servings, recipes: [] };
        }

        result[ingId].recipes.push({
          menuItemName: itemLabel,
          servings,
          sizeName,
        });

        if (servings < result[ingId].minServings) {
          result[ingId].minServings = servings;
        }
      });

      setServingsMap(result);
    } catch (err) {
      console.error('Error calculating servings:', err);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { calculate(); }, [calculate]);

  return { servingsMap, loading, refetch: calculate };
};
