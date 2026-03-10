
-- 1. Add CHECK constraint to prevent negative stock
ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_current_stock_non_negative CHECK (current_stock >= 0);

-- 2. Replace deduct_inventory_for_items with transaction-safe version using FOR UPDATE
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_items(p_restaurant_id uuid, p_item_ids text[], p_reference_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_menu_item_id UUID;
  v_recipe RECORD;
  v_deducted JSONB := '[]'::jsonb;
  v_current NUMERIC;
  v_required NUMERIC;
  v_insufficient JSONB := '[]'::jsonb;
  v_has_insufficient BOOLEAN := false;
  v_item_id TEXT;
BEGIN
  -- First pass: check all stock levels with FOR UPDATE locks
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    v_menu_item_id := v_item_id::UUID;
    
    FOR v_recipe IN 
      SELECT mii.ingredient_id, mii.quantity, i.name, i.unit, i.current_stock
      FROM menu_item_ingredients mii
      JOIN ingredients i ON i.id = mii.ingredient_id
      WHERE mii.menu_item_id = v_menu_item_id
        AND i.is_active = true
      FOR UPDATE OF i  -- Lock ingredient rows
    LOOP
      IF v_recipe.current_stock < v_recipe.quantity THEN
        v_has_insufficient := true;
        v_insufficient := v_insufficient || jsonb_build_object(
          'ingredient', v_recipe.name,
          'required', v_recipe.quantity,
          'available', v_recipe.current_stock,
          'unit', v_recipe.unit
        );
      END IF;
    END LOOP;
  END LOOP;

  -- If any ingredient is insufficient, abort
  IF v_has_insufficient THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INSUFFICIENT_STOCK',
      'insufficient_items', v_insufficient
    );
  END IF;

  -- Second pass: deduct stock (rows are still locked within this transaction)
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    v_menu_item_id := v_item_id::UUID;
    
    FOR v_recipe IN 
      SELECT mii.ingredient_id, mii.quantity, i.name, i.unit
      FROM menu_item_ingredients mii
      JOIN ingredients i ON i.id = mii.ingredient_id
      WHERE mii.menu_item_id = v_menu_item_id
        AND i.is_active = true
    LOOP
      UPDATE ingredients
      SET current_stock = current_stock - v_recipe.quantity
      WHERE id = v_recipe.ingredient_id;
      
      INSERT INTO inventory_transactions (ingredient_id, restaurant_id, type, quantity, reference_id, note)
      VALUES (v_recipe.ingredient_id, p_restaurant_id, 'order', -v_recipe.quantity, p_reference_id, 
              'Auto-deducted for order confirmation');
      
      v_deducted := v_deducted || jsonb_build_object(
        'ingredient', v_recipe.name,
        'quantity', v_recipe.quantity,
        'unit', v_recipe.unit
      );
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'deducted', v_deducted);
END;
$function$;

-- 3. Create restore_inventory_for_items for rejection reversals
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
      
      INSERT INTO inventory_transactions (ingredient_id, restaurant_id, type, quantity, reference_id, note)
      VALUES (v_recipe.ingredient_id, p_restaurant_id, 'order_reversal', v_recipe.quantity, p_reference_id, 
              'Stock restored due to order rejection');
      
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

-- 4. Update update_order_item_status: deduct on 'confirmed', restore on 'rejected'
CREATE OR REPLACE FUNCTION public.update_order_item_status(p_order_id uuid, p_item_id uuid, p_new_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_item JSONB;
  v_idx INTEGER := 0;
  v_found BOOLEAN := false;
  v_new_total NUMERIC;
  v_menu_item_id TEXT;
  v_old_status TEXT;
  v_restaurant_id UUID;
  v_deduct_result JSONB;
BEGIN
  -- Validate status (now includes 'confirmed')
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_order FROM tb_order_temporary WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_restaurant_id := v_order.shop_id;
  v_items := v_order.items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'item_id' = p_item_id::text THEN
      v_old_status := COALESCE(v_item->>'status', 'pending');
      v_menu_item_id := v_item->>'menu_item_id';
      v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
      v_found := true;
      EXIT;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found in order');
  END IF;

  -- Deduct inventory when moving to confirmed (from pending)
  IF p_new_status = 'confirmed' AND v_old_status = 'pending' AND v_menu_item_id IS NOT NULL THEN
    v_deduct_result := deduct_inventory_for_items(v_restaurant_id, ARRAY[v_menu_item_id], p_order_id::text);
    IF NOT (v_deduct_result->>'success')::boolean THEN
      -- Rollback the status change by not saving
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Cannot confirm order: insufficient stock',
        'insufficient_items', v_deduct_result->'insufficient_items'
      );
    END IF;
  END IF;

  -- Restore inventory when rejecting a confirmed/preparing/ready item
  IF p_new_status = 'rejected' AND v_old_status IN ('confirmed', 'preparing', 'ready') AND v_menu_item_id IS NOT NULL THEN
    PERFORM restore_inventory_for_items(v_restaurant_id, ARRAY[v_menu_item_id], p_order_id::text);
  END IF;

  -- Recalculate total (excluding rejected items)
  SELECT COALESCE(SUM((item->>'price')::numeric), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item
  WHERE item->>'status' != 'rejected';

  UPDATE tb_order_temporary
  SET items = v_items, total_usd = v_new_total, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'new_total', v_new_total);
END;
$function$;

-- 5. Update update_order_items_status: deduct on 'confirmed', restore on 'rejected'
CREATE OR REPLACE FUNCTION public.update_order_items_status(p_order_id uuid, p_item_ids uuid[], p_new_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_item JSONB;
  v_idx INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_new_total NUMERIC;
  v_menu_item_ids_to_deduct TEXT[] := ARRAY[]::TEXT[];
  v_menu_item_ids_to_restore TEXT[] := ARRAY[]::TEXT[];
  v_restaurant_id UUID;
  v_deduct_result JSONB;
  v_old_status TEXT;
BEGIN
  -- Validate status (now includes 'confirmed')
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_order FROM tb_order_temporary WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_restaurant_id := v_order.shop_id;
  v_items := v_order.items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'item_id')::uuid = ANY(p_item_ids) THEN
      v_old_status := COALESCE(v_item->>'status', 'pending');
      
      -- Collect items to deduct when transitioning TO confirmed from pending
      IF p_new_status = 'confirmed' AND v_old_status = 'pending' THEN
        v_menu_item_ids_to_deduct := array_append(v_menu_item_ids_to_deduct, v_item->>'menu_item_id');
      END IF;
      
      -- Collect items to restore when rejecting already-confirmed items
      IF p_new_status = 'rejected' AND v_old_status IN ('confirmed', 'preparing', 'ready') THEN
        v_menu_item_ids_to_restore := array_append(v_menu_item_ids_to_restore, v_item->>'menu_item_id');
      END IF;
      
      v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
      v_updated_count := v_updated_count + 1;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- Deduct inventory for items moving to confirmed
  IF array_length(v_menu_item_ids_to_deduct, 1) > 0 THEN
    v_deduct_result := deduct_inventory_for_items(v_restaurant_id, v_menu_item_ids_to_deduct, p_order_id::text);
    IF NOT (v_deduct_result->>'success')::boolean THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Cannot confirm order: insufficient stock',
        'insufficient_items', v_deduct_result->'insufficient_items'
      );
    END IF;
  END IF;

  -- Restore inventory for items being rejected after deduction
  IF array_length(v_menu_item_ids_to_restore, 1) > 0 THEN
    PERFORM restore_inventory_for_items(v_restaurant_id, v_menu_item_ids_to_restore, p_order_id::text);
  END IF;

  -- Recalculate total
  SELECT COALESCE(SUM((item->>'price')::numeric), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item
  WHERE item->>'status' != 'rejected';

  UPDATE tb_order_temporary
  SET items = v_items, total_usd = v_new_total, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'new_total', v_new_total
  );
END;
$function$;
