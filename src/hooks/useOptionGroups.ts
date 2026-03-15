import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OptionValueIngredient {
  id: string;
  option_value_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: { name: string; unit: string };
}

export interface OptionValue {
  id: string;
  group_id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  sort_order: number;
  ingredients?: OptionValueIngredient[];
}

export interface OptionGroup {
  id: string;
  menu_item_id: string;
  name: string;
  required: boolean;
  selection_type: string;
  sort_order: number;
  values: OptionValue[];
}

export const useOptionGroups = (menuItemId: string | null) => {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!menuItemId) { setGroups([]); return; }
    setLoading(true);

    const { data: groupsData, error: groupsError } = await supabase
      .from('option_groups')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .order('sort_order');

    if (groupsError || !groupsData) {
      setLoading(false);
      return;
    }

    // Fetch values for all groups
    const groupIds = groupsData.map(g => g.id);
    let valuesData: any[] = [];
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from('option_values')
        .select('*')
        .in('group_id', groupIds)
        .order('sort_order');
      valuesData = data || [];
    }

    // Fetch ingredient impacts for all values
    const valueIds = valuesData.map(v => v.id);
    let ingredientsData: any[] = [];
    if (valueIds.length > 0) {
      const { data } = await supabase
        .from('option_value_ingredients')
        .select('*, ingredient:ingredients(name, unit)')
        .in('option_value_id', valueIds);
      ingredientsData = (data || []).map((d: any) => ({
        ...d,
        ingredient: Array.isArray(d.ingredient) ? d.ingredient[0] : d.ingredient,
      }));
    }

    const result: OptionGroup[] = groupsData.map(g => ({
      ...g,
      values: valuesData
        .filter(v => v.group_id === g.id)
        .map(v => ({
          ...v,
          ingredients: ingredientsData.filter(i => i.option_value_id === v.id),
        })),
    }));

    setGroups(result);
    setLoading(false);
  }, [menuItemId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const addGroup = async (name: string, required: boolean = false, selectionType: string = 'single') => {
    if (!menuItemId) return null;
    const { data, error } = await supabase
      .from('option_groups')
      .insert({
        menu_item_id: menuItemId,
        name,
        required,
        selection_type: selectionType,
        sort_order: groups.length,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    await fetchGroups();
    return data;
  };

  const updateGroup = async (id: string, updates: Partial<Pick<OptionGroup, 'name' | 'required' | 'selection_type' | 'sort_order'>>) => {
    const { error } = await supabase.from('option_groups').update(updates).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  const removeGroup = async (id: string) => {
    const { error } = await supabase.from('option_groups').delete().eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  const addValue = async (groupId: string, name: string, priceAdjustment: number = 0, isDefault: boolean = false) => {
    const group = groups.find(g => g.id === groupId);
    const { error } = await supabase.from('option_values').insert({
      group_id: groupId,
      name,
      price_adjustment: priceAdjustment,
      is_default: isDefault,
      sort_order: group?.values.length || 0,
    });
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  const updateValue = async (id: string, updates: Partial<Pick<OptionValue, 'name' | 'price_adjustment' | 'is_default' | 'sort_order'>>) => {
    const { error } = await supabase.from('option_values').update(updates).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  const removeValue = async (id: string) => {
    const { error } = await supabase.from('option_values').delete().eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  const addValueIngredient = async (optionValueId: string, ingredientId: string, quantity: number) => {
    const { error } = await supabase.from('option_value_ingredients').insert({
      option_value_id: optionValueId,
      ingredient_id: ingredientId,
      quantity,
    });
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  const removeValueIngredient = async (id: string) => {
    const { error } = await supabase.from('option_value_ingredients').delete().eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await fetchGroups();
    return true;
  };

  // Sync from JSONB options format to normalized tables
  const syncFromJsonb = async (jsonbOptions: { options: Array<{ name: string; required: boolean; type: string; values: Array<{ label: string; price: number; default?: boolean }> }> } | null) => {
    if (!menuItemId) return false;

    // Delete existing groups (cascade deletes values and ingredients)
    await supabase.from('option_groups').delete().eq('menu_item_id', menuItemId);

    if (!jsonbOptions?.options || jsonbOptions.options.length === 0) {
      await fetchGroups();
      return true;
    }

    for (let gi = 0; gi < jsonbOptions.options.length; gi++) {
      const group = jsonbOptions.options[gi];
      const { data: newGroup, error: groupError } = await supabase
        .from('option_groups')
        .insert({
          menu_item_id: menuItemId,
          name: group.name,
          required: group.required,
          selection_type: group.type,
          sort_order: gi,
        })
        .select()
        .single();

      if (groupError || !newGroup) continue;

      const valueInserts = group.values.map((v, vi) => ({
        group_id: newGroup.id,
        name: v.label,
        price_adjustment: v.price,
        is_default: v.default || false,
        sort_order: vi,
      }));

      if (valueInserts.length > 0) {
        await supabase.from('option_values').insert(valueInserts);
      }
    }

    await fetchGroups();
    return true;
  };

  return {
    groups, loading,
    addGroup, updateGroup, removeGroup,
    addValue, updateValue, removeValue,
    addValueIngredient, removeValueIngredient,
    syncFromJsonb, refetch: fetchGroups,
  };
};
