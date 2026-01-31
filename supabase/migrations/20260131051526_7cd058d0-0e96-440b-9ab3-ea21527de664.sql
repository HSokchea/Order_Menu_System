-- Update place_device_order to merge items with existing active order
CREATE OR REPLACE FUNCTION place_device_order(
  p_order_id uuid,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order tb_order_temporary%ROWTYPE;
  v_existing_order tb_his_admin%ROWTYPE;
  v_history_id uuid;
  v_table_number text;
  v_merged_items jsonb;
  v_new_total numeric;
  v_new_item jsonb;
  v_existing_item jsonb;
  v_found_match boolean;
  v_idx integer;
BEGIN
  -- Fetch the temporary order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
    AND status = 'pending';

  -- If not pending, check if already placed (idempotency)
  IF NOT FOUND THEN
    SELECT id INTO v_history_id
    FROM tb_his_admin
    WHERE original_order_id = p_order_id
      AND device_id = p_device_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'history_id', v_history_id,
        'order_id', p_order_id,
        'message', 'Order already placed'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Check if order has items
  IF v_order.items IS NULL OR jsonb_array_length(v_order.items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot place an empty order'
    );
  END IF;

  -- Get table number if table_id exists
  IF v_order.table_id IS NOT NULL THEN
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = v_order.table_id;
  END IF;

  -- Check for existing active order (same shop, device, today, unpaid status)
  SELECT * INTO v_existing_order
  FROM tb_his_admin
  WHERE shop_id = v_order.shop_id
    AND device_id = v_order.device_id
    AND DATE(created_at) = CURRENT_DATE
    AND status IN ('placed', 'preparing', 'ready')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- MERGE MODE: Add new items to existing order
    v_merged_items := COALESCE(v_existing_order.items, '[]'::jsonb);
    
    -- Loop through each new item from the cart
    FOR v_new_item IN SELECT * FROM jsonb_array_elements(v_order.items)
    LOOP
      v_found_match := false;
      v_idx := 0;
      
      -- Check if this item (same menu_item_id + same options) already exists
      FOR v_existing_item IN SELECT * FROM jsonb_array_elements(v_merged_items)
      LOOP
        IF (v_existing_item->>'menu_item_id' = v_new_item->>'menu_item_id') 
           AND (COALESCE(v_existing_item->'options', '[]'::jsonb) = COALESCE(v_new_item->'options', '[]'::jsonb))
        THEN
          -- Found match: increase quantity
          v_merged_items := jsonb_set(
            v_merged_items,
            ARRAY[v_idx::text, 'quantity'],
            to_jsonb((v_existing_item->>'quantity')::integer + (v_new_item->>'quantity')::integer)
          );
          v_found_match := true;
          EXIT;
        END IF;
        v_idx := v_idx + 1;
      END LOOP;
      
      -- No match found: append new item
      IF NOT v_found_match THEN
        v_merged_items := v_merged_items || jsonb_build_array(v_new_item);
      END IF;
    END LOOP;
    
    -- Recalculate total from merged items
    SELECT COALESCE(SUM(
      (item->>'price_usd')::numeric * (item->>'quantity')::integer +
      COALESCE((
        SELECT SUM((opt->>'price')::numeric)
        FROM jsonb_array_elements(COALESCE(item->'options', '[]'::jsonb)) opt
      ), 0) * (item->>'quantity')::integer
    ), 0)
    INTO v_new_total
    FROM jsonb_array_elements(v_merged_items) item;
    
    -- Update existing order with merged items
    UPDATE tb_his_admin
    SET items = v_merged_items,
        total_usd = v_new_total,
        customer_notes = CASE 
          WHEN v_order.customer_notes IS NOT NULL AND v_order.customer_notes != '' 
          THEN COALESCE(customer_notes || ' | ', '') || v_order.customer_notes
          ELSE customer_notes
        END,
        updated_at = now()
    WHERE id = v_existing_order.id;
    
    v_history_id := v_existing_order.id;
  ELSE
    -- CREATE MODE: No existing order, create new one
    INSERT INTO tb_his_admin (
      shop_id,
      device_id,
      items,
      total_usd,
      customer_notes,
      status,
      order_type,
      table_id,
      table_number,
      original_order_id,
      created_at
    )
    VALUES (
      v_order.shop_id,
      v_order.device_id,
      v_order.items,
      v_order.total_usd,
      v_order.customer_notes,
      'placed',
      v_order.order_type,
      v_order.table_id,
      v_table_number,
      v_order.id,
      v_order.created_at
    )
    RETURNING id INTO v_history_id;
  END IF;

  -- Update temporary order status to 'placed'
  UPDATE tb_order_temporary
  SET status = 'placed',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'order_id', p_order_id,
    'merged', FOUND
  );
END;
$$;