
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
  v_old_status TEXT;
  v_restaurant_id UUID;
  v_deduct_result JSONB;
BEGIN
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
      v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
      v_found := true;
      EXIT;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found in order');
  END IF;

  -- Skip if status unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'new_total', v_order.total_usd);
  END IF;

  -- Deduct inventory: pending → confirmed
  IF p_new_status = 'confirmed' AND v_old_status = 'pending' THEN
    v_deduct_result := deduct_inventory_for_items_v2(v_restaurant_id, jsonb_build_array(v_item), p_order_id::text);
    IF NOT (v_deduct_result->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot confirm order: insufficient stock', 'insufficient_items', v_deduct_result->'insufficient_items');
    END IF;
  END IF;

  -- Restore inventory: confirmed/preparing/ready → rejected OR → pending
  IF v_old_status IN ('confirmed', 'preparing', 'ready') AND p_new_status IN ('rejected', 'pending') THEN
    PERFORM restore_inventory_for_items_v2(v_restaurant_id, jsonb_build_array(v_item), p_order_id::text);
  END IF;

  SELECT COALESCE(SUM((item->>'price')::numeric), 0) INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item WHERE item->>'status' != 'rejected';

  UPDATE tb_order_temporary SET items = v_items, total_usd = v_new_total, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'new_total', v_new_total);
END;
$function$;

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
  v_items_to_deduct JSONB := '[]'::jsonb;
  v_items_to_restore JSONB := '[]'::jsonb;
  v_restaurant_id UUID;
  v_deduct_result JSONB;
  v_old_status TEXT;
BEGIN
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

      -- Skip if status unchanged
      IF v_old_status != p_new_status THEN
        -- Deduct: pending → confirmed
        IF p_new_status = 'confirmed' AND v_old_status = 'pending' THEN
          v_items_to_deduct := v_items_to_deduct || jsonb_build_array(v_item);
        END IF;

        -- Restore: confirmed/preparing/ready → rejected OR → pending
        IF v_old_status IN ('confirmed', 'preparing', 'ready') AND p_new_status IN ('rejected', 'pending') THEN
          v_items_to_restore := v_items_to_restore || jsonb_build_array(v_item);
        END IF;

        v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
        v_updated_count := v_updated_count + 1;
      END IF;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'updated_count', 0, 'new_total', v_order.total_usd);
  END IF;

  IF jsonb_array_length(v_items_to_deduct) > 0 THEN
    v_deduct_result := deduct_inventory_for_items_v2(v_restaurant_id, v_items_to_deduct, p_order_id::text);
    IF NOT (v_deduct_result->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot confirm order: insufficient stock', 'insufficient_items', v_deduct_result->'insufficient_items');
    END IF;
  END IF;

  IF jsonb_array_length(v_items_to_restore) > 0 THEN
    PERFORM restore_inventory_for_items_v2(v_restaurant_id, v_items_to_restore, p_order_id::text);
  END IF;

  SELECT COALESCE(SUM((item->>'price')::numeric), 0) INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item WHERE item->>'status' != 'rejected';

  UPDATE tb_order_temporary SET items = v_items, total_usd = v_new_total, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count, 'new_total', v_new_total);
END;
$function$;
