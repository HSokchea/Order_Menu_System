import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItemIngredient {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: Ingredient;
}

export interface InventoryTransaction {
  id: string;
  ingredient_id: string;
  restaurant_id: string;
  type: 'purchase' | 'order' | 'adjustment' | 'waste';
  quantity: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  ingredient?: { name: string; unit: string };
}

export const useIngredients = () => {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string>('');

  const fetchIngredients = useCallback(async () => {
    if (!user) return;
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!restaurant) {
        // Try staff restaurant
        const { data: profile } = await supabase
          .from('profiles')
          .select('restaurant_id')
          .eq('user_id', user.id)
          .single();
        if (profile?.restaurant_id) {
          setRestaurantId(profile.restaurant_id);
        }
      } else {
        setRestaurantId(restaurant.id);
      }
    } catch (err) {
      console.error('Error fetching restaurant:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  useEffect(() => {
    if (!restaurantId) return;

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');

      if (error) {
        console.error('Error fetching ingredients:', error);
      } else {
        setIngredients(data || []);
      }
      setLoading(false);
    };

    fetch();

    const channel = supabase
      .channel('ingredients-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ingredients',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  const addIngredient = async (data: Omit<Ingredient, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>) => {
    if (!restaurantId) return;
    const { error } = await supabase.from('ingredients').insert({ ...data, restaurant_id: restaurantId });
    if (error) { toast.error(error.message); return false; }
    toast.success('Ingredient added');
    return true;
  };

  const updateIngredient = async (id: string, data: Partial<Ingredient>) => {
    const { error } = await supabase.from('ingredients').update(data).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    toast.success('Ingredient updated');
    return true;
  };

  const adjustStock = async (ingredientId: string, quantity: number, type: 'purchase' | 'adjustment' | 'waste', note?: string) => {
    if (!restaurantId) return false;

    // Update stock
    const ingredient = ingredients.find(i => i.id === ingredientId);
    if (!ingredient) return false;

    const newStock = Math.max(ingredient.current_stock + quantity, 0);
    const { error: updateError } = await supabase
      .from('ingredients')
      .update({ current_stock: newStock })
      .eq('id', ingredientId);

    if (updateError) { toast.error(updateError.message); return false; }

    // Record transaction
    const { error: txError } = await supabase
      .from('inventory_transactions')
      .insert({
        ingredient_id: ingredientId,
        restaurant_id: restaurantId,
        type,
        quantity,
        note,
        created_by: user?.id,
      });

    if (txError) { console.error('Transaction log error:', txError); }

    toast.success('Stock adjusted');
    return true;
  };

  const lowStockIngredients = ingredients.filter(i => i.is_active && i.current_stock <= i.min_stock);

  return { ingredients, loading, restaurantId, addIngredient, updateIngredient, adjustStock, lowStockIngredients, refetch: fetchIngredients };
};

export const useMenuItemRecipe = (menuItemId: string | null) => {
  const [recipe, setRecipe] = useState<MenuItemIngredient[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecipe = useCallback(async () => {
    if (!menuItemId) { setRecipe([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_item_ingredients')
      .select('*, ingredient:ingredients(*)')
      .eq('menu_item_id', menuItemId);

    if (!error && data) {
      setRecipe(data.map((r: any) => ({
        ...r,
        ingredient: Array.isArray(r.ingredient) ? r.ingredient[0] : r.ingredient
      })));
    }
    setLoading(false);
  }, [menuItemId]);

  useEffect(() => { fetchRecipe(); }, [fetchRecipe]);

  const addRecipeIngredient = async (ingredientId: string, quantity: number) => {
    if (!menuItemId) return false;
    const { error } = await supabase.from('menu_item_ingredients').insert({
      menu_item_id: menuItemId,
      ingredient_id: ingredientId,
      quantity,
    });
    if (error) { toast.error(error.message); return false; }
    await fetchRecipe();
    return true;
  };

  const updateRecipeIngredient = async (id: string, quantity: number) => {
    const { error } = await supabase.from('menu_item_ingredients').update({ quantity }).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchRecipe();
    return true;
  };

  const removeRecipeIngredient = async (id: string) => {
    const { error } = await supabase.from('menu_item_ingredients').delete().eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchRecipe();
    return true;
  };

  return { recipe, loading, addRecipeIngredient, updateRecipeIngredient, removeRecipeIngredient, refetch: fetchRecipe };
};

export const useInventoryTransactions = (restaurantId: string) => {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*, ingredient:ingredients(name, unit)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setTransactions(data.map((t: any) => ({
        ...t,
        ingredient: Array.isArray(t.ingredient) ? t.ingredient[0] : t.ingredient
      })));
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  return { transactions, loading, refetch: fetchTransactions };
};
