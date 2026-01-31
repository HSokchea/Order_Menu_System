-- Make place_device_order idempotent by checking if order was already placed
CREATE OR REPLACE FUNCTION public.place_device_order(p_order_id uuid, p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_history_id uuid;
  v_expanded_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_qty integer;
  v_i integer;
  v_existing_items jsonb;
  v_table_number text;
BEGIN
  -- Lock and fetch the pending order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
    AND status = 'pending'
  FOR UPDATE;

  -- If not pending, check if already placed
  IF NOT FOUND THEN
    SELECT id INTO v_history_id
    FROM tb_his_admin
    WHERE original_order_id = p_order_id
      AND device_id = p_device_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Order already placed → return success (idempotent)
      RETURN jsonb_build_object(
        'success', true,
        'history_id', v_history_id,
        'order_id', p_order_id,
        'message', 'Order already placed'
      );
    END IF;

    -- Truly not found
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Expand items: each unit becomes a separate object with unique item_id
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    FOR v_i IN 1..v_qty LOOP
      v_expanded_items := v_expanded_items || jsonb_build_object(
        'item_id', gen_random_uuid(),
        'menu_item_id', v_item->>'menu_item_id',
        'name', v_item->>'name',
        'options', COALESCE(v_item->'options', '[]'::jsonb),
        'price', COALESCE((v_item->>'price_usd')::numeric, (v_item->>'price')::numeric, 0),
        'status', 'pending',
        'created_at', now()
      );
    END LOOP;
  END LOOP;

  -- Get table_number if table_id exists
  IF v_order.table_id IS NOT NULL THEN
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = v_order.table_id;
  END IF;

  -- Check if there's already an active order for this device+shop today in tb_his_admin
  SELECT id, items INTO v_history_id, v_existing_items
  FROM tb_his_admin
  WHERE device_id = p_device_id
    AND shop_id = v_order.shop_id
    AND status = 'placed'
    AND DATE(created_at) = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Append new items to existing order
    UPDATE tb_his_admin
    SET items = COALESCE(v_existing_items, '[]'::jsonb) || v_expanded_items,
        total_usd = (
          SELECT COALESCE(SUM((item->>'price')::numeric), 0)
          FROM jsonb_array_elements(COALESCE(v_existing_items, '[]'::jsonb) || v_expanded_items) AS item
          WHERE item->>'status' != 'rejected'
        ),
        customer_notes = COALESCE(v_order.customer_notes, customer_notes),
        updated_at = now()
    WHERE id = v_history_id;
  ELSE
    -- Create new history entry
    INSERT INTO tb_his_admin (
      shop_id,
      device_id,
      table_id,
      table_number,
      order_type,
      items,
      total_usd,
      customer_notes,
      status,
      original_order_id
    ) VALUES (
      v_order.shop_id,
      p_device_id,
      v_order.table_id,
      v_table_number,
      v_order.order_type,
      v_expanded_items,
      (SELECT COALESCE(SUM((item->>'price')::numeric), 0)
       FROM jsonb_array_elements(v_expanded_items) AS item
       WHERE item->>'status' != 'rejected'),
      v_order.customer_notes,
      'placed',
      p_order_id
    )
    RETURNING id INTO v_history_id;
  END IF;

  -- Update original order status
  UPDATE tb_order_temporary
  SET status = 'placed',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'order_id', p_order_id
  );
END;
$$;