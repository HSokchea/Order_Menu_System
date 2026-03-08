
-- Update update_order_items_status to auto-deduct inventory when items move to 'preparing'
CREATE OR REPLACE FUNCTION public.update_order_items_status(p_order_id uuid, p_item_ids uuid[], p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_item JSONB;
  v_idx INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_new_total NUMERIC;
  v_menu_item_ids TEXT[] := ARRAY[]::TEXT[];
  v_restaurant_id UUID;
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('pending', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  -- Get the order from tb_order_temporary
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_restaurant_id := v_order.shop_id;

  -- Update items matching the provided IDs
  v_items := v_order.items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'item_id')::uuid = ANY(p_item_ids) THEN
      -- Only deduct inventory when transitioning TO preparing (not if already preparing)
      IF p_new_status = 'preparing' AND COALESCE(v_item->>'status', 'pending') != 'preparing' THEN
        v_menu_item_ids := array_append(v_menu_item_ids, v_item->>'menu_item_id');
      END IF;
      v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
      v_updated_count := v_updated_count + 1;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- Recalculate total
  SELECT COALESCE(SUM((item->>'price')::numeric), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item
  WHERE item->>'status' != 'rejected';

  -- Update order
  UPDATE tb_order_temporary
  SET 
    items = v_items,
    total_usd = v_new_total,
    updated_at = now()
  WHERE id = p_order_id;

  -- Deduct inventory for items moving to preparing
  IF array_length(v_menu_item_ids, 1) > 0 THEN
    PERFORM deduct_inventory_for_items(v_restaurant_id, v_menu_item_ids, p_order_id::text);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'new_total', v_new_total
  );
END;
$$;

-- Also update single item status function
CREATE OR REPLACE FUNCTION public.update_order_item_status(p_order_id uuid, p_item_id uuid, p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('pending', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  -- Get the order from tb_order_temporary
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_restaurant_id := v_order.shop_id;

  -- Find and update the specific item
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

  -- Recalculate total (excluding rejected items)
  SELECT COALESCE(SUM((item->>'price')::numeric), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item
  WHERE item->>'status' != 'rejected';

  -- Update order
  UPDATE tb_order_temporary
  SET 
    items = v_items,
    total_usd = v_new_total,
    updated_at = now()
  WHERE id = p_order_id;

  -- Deduct inventory when moving to preparing
  IF p_new_status = 'preparing' AND v_old_status != 'preparing' AND v_menu_item_id IS NOT NULL THEN
    PERFORM deduct_inventory_for_items(v_restaurant_id, ARRAY[v_menu_item_id], p_order_id::text);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_total', v_new_total
  );
END;
$$;
