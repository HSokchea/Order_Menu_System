import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MenuItemSize {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export const useMenuItemSizes = (menuItemId: string | null) => {
  const [sizes, setSizes] = useState<MenuItemSize[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSizes = useCallback(async () => {
    if (!menuItemId) { setSizes([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_item_sizes')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .order('sort_order');

    if (!error && data) setSizes(data);
    setLoading(false);
  }, [menuItemId]);

  useEffect(() => { fetchSizes(); }, [fetchSizes]);

  const addSize = async (name: string, price: number, isDefault: boolean = false) => {
    if (!menuItemId) return false;
    
    // If setting as default, unset others first
    if (isDefault) {
      await supabase
        .from('menu_item_sizes')
        .update({ is_default: false })
        .eq('menu_item_id', menuItemId);
    }
    
    const { error } = await supabase.from('menu_item_sizes').insert({
      menu_item_id: menuItemId,
      name,
      price,
      is_default: isDefault,
      sort_order: sizes.length,
    });
    if (error) { toast.error(error.message); return false; }
    await fetchSizes();
    return true;
  };

  const updateSize = async (id: string, updates: Partial<Pick<MenuItemSize, 'name' | 'price' | 'is_default' | 'sort_order'>>) => {
    if (updates.is_default && menuItemId) {
      await supabase
        .from('menu_item_sizes')
        .update({ is_default: false })
        .eq('menu_item_id', menuItemId);
    }
    const { error } = await supabase.from('menu_item_sizes').update(updates).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchSizes();
    return true;
  };

  const removeSize = async (id: string) => {
    const { error } = await supabase.from('menu_item_sizes').delete().eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchSizes();
    return true;
  };

  const syncSizesFromJsonb = async (jsonbSizes: Array<{ label: string; price: number; default?: boolean }>) => {
    if (!menuItemId) return false;
    
    // Delete existing sizes
    await supabase.from('menu_item_sizes').delete().eq('menu_item_id', menuItemId);
    
    // Insert new sizes
    const inserts = jsonbSizes.map((s, i) => ({
      menu_item_id: menuItemId,
      name: s.label,
      price: s.price,
      is_default: s.default || false,
      sort_order: i,
    }));
    
    if (inserts.length > 0) {
      const { error } = await supabase.from('menu_item_sizes').insert(inserts);
      if (error) { toast.error(error.message); return false; }
    }
    
    await fetchSizes();
    return true;
  };

  return { sizes, loading, addSize, updateSize, removeSize, syncSizesFromJsonb, refetch: fetchSizes };
};
