CREATE OR REPLACE FUNCTION public.restore_inventory_for_items_v2(p_restaurant_id uuid, p_order_items jsonb, p_reference_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_item jsonb;
  v_menu_item_id uuid;
  v_size_id uuid;
  v_recipe RECORD;
  v_opt jsonb;
  v_opt_val_id uuid;
  v_ovi RECORD;
  v_requirements jsonb := '{}'::jsonb;
  v_key text;
  v_required_qty numeric;
  v_ing_name text;
  v_ing_unit text;
  v_restored jsonb := '[]'::jsonb;
BEGIN
  FOR v_order_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_menu_item_id := (v_order_item->>'menu_item_id')::uuid;
    v_size_id := NULL;

    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_order_item->'options', '[]'::jsonb))
    LOOP
      IF v_opt->>'groupName' = 'Size' THEN
        SELECT mis.id INTO v_size_id FROM menu_item_sizes mis
        WHERE mis.menu_item_id = v_menu_item_id AND mis.name = v_opt->>'label' LIMIT 1;
      END IF;
    END LOOP;

    FOR v_recipe IN
      SELECT mii.ingredient_id, mii.quantity FROM menu_item_ingredients mii
      WHERE mii.menu_item_id = v_menu_item_id
        AND ((v_size_id IS NOT NULL AND mii.size_id = v_size_id) OR (v_size_id IS NULL AND mii.size_id IS NULL))
    LOOP
      v_key := v_recipe.ingredient_id::text;
      v_requirements := jsonb_set(v_requirements, ARRAY[v_key],
        to_jsonb(COALESCE((v_requirements->>v_key)::numeric, 0) + v_recipe.quantity));
    END LOOP;

    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_order_item->'options', '[]'::jsonb))
    LOOP
      IF v_opt->>'groupName' != 'Size' THEN
        SELECT ov.id INTO v_opt_val_id FROM option_values ov
        JOIN option_groups og ON ov.group_id = og.id
        WHERE og.menu_item_id = v_menu_item_id AND og.name = v_opt->>'groupName' AND ov.name = v_opt->>'label' LIMIT 1;

        IF v_opt_val_id IS NOT NULL THEN
          FOR v_ovi IN SELECT ovi.ingredient_id, ovi.quantity FROM option_value_ingredients ovi WHERE ovi.option_value_id = v_opt_val_id
          LOOP
            v_key := v_ovi.ingredient_id::text;
            v_requirements := jsonb_set(v_requirements, ARRAY[v_key],
              to_jsonb(COALESCE((v_requirements->>v_key)::numeric, 0) + v_ovi.quantity));
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_key IN SELECT * FROM jsonb_object_keys(v_requirements)
  LOOP
    v_required_qty := (v_requirements->>v_key)::numeric;
    SELECT i.name, i.unit INTO v_ing_name, v_ing_unit FROM ingredients i WHERE i.id = v_key::uuid;

    UPDATE ingredients SET current_stock = current_stock + v_required_qty WHERE id = v_key::uuid;

    IF p_reference_id IS NOT NULL THEN
      DELETE FROM inventory_transactions
      WHERE reference_id = p_reference_id
        AND ingredient_id = v_key::uuid
        AND type IN ('order', 'order_reversal');
    END IF;

    v_restored := v_restored || jsonb_build_object('ingredient', v_ing_name, 'quantity', v_required_qty, 'unit', v_ing_unit);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'restored', v_restored);
END;
$function$;