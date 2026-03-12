
-- Drop and recreate get_shop_menu_items with available_servings
DROP FUNCTION IF EXISTS public.get_shop_menu_items(uuid);

CREATE OR REPLACE FUNCTION public.get_shop_menu_items(p_shop_id uuid)
RETURNS TABLE(id uuid, name text, description text, price_usd numeric, image_url text, is_available boolean, category_id uuid, category_name text, options jsonb, sizes jsonb, size_enabled boolean, available_servings integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.id,
    mi.name,
    mi.description,
    mi.price_usd,
    mi.image_url,
    mi.is_available,
    mi.category_id,
    mc.name as category_name,
    mi.options,
    mi.sizes,
    mi.size_enabled,
    mi.available_servings
  FROM menu_items mi
  LEFT JOIN menu_categories mc ON mi.category_id = mc.id
  WHERE mi.restaurant_id = p_shop_id
    AND mi.is_available = true
  ORDER BY mc.display_order, mi.name;
END;
$$;

-- Initialize available_servings for all existing menu items that have recipes
DO $$
DECLARE
  v_item_id uuid;
BEGIN
  FOR v_item_id IN SELECT DISTINCT menu_item_id FROM menu_item_ingredients
  LOOP
    PERFORM recalculate_menu_item_servings(v_item_id);
  END LOOP;
END;
$$;
