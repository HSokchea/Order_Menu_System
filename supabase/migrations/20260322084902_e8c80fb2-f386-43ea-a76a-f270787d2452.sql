CREATE OR REPLACE FUNCTION public.restore_inventory_for_items(p_restaurant_id uuid, p_item_ids text[], p_reference_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_menu_item_id UUID;
  v_recipe RECORD;
  v_restored JSONB := '[]'::jsonb;
  v_item_id TEXT;
BEGIN
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    v_menu_item_id := v_item_id::UUID;
    
    FOR v_recipe IN 
      SELECT mii.ingredient_id, mii.quantity, i.name, i.unit
      FROM menu_item_ingredients mii
      JOIN ingredients i ON i.id = mii.ingredient_id
      WHERE mii.menu_item_id = v_menu_item_id
        AND i.is_active = true
      FOR UPDATE OF i
    LOOP
      UPDATE ingredients
      SET current_stock = current_stock + v_recipe.quantity
      WHERE id = v_recipe.ingredient_id;
      
      IF p_reference_id IS NOT NULL THEN
        DELETE FROM inventory_transactions
        WHERE reference_id = p_reference_id
          AND ingredient_id = v_recipe.ingredient_id
          AND type IN ('order', 'order_reversal');
      END IF;
      
      v_restored := v_restored || jsonb_build_object(
        'ingredient', v_recipe.name,
        'quantity', v_recipe.quantity,
        'unit', v_recipe.unit
      );
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'restored', v_restored);
END;
$function$;