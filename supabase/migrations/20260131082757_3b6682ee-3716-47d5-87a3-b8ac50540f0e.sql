-- Update update_device_order to APPEND items instead of replacing
CREATE OR REPLACE FUNCTION public.update_device_order(
  p_order_id uuid,
  p_device_id text,
  p_items jsonb,
  p_total_usd numeric,
  p_customer_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_existing_items jsonb;
  v_merged_items jsonb;
  v_new_total numeric;
  v_history_id uuid;
  v_history_items jsonb;
  v_expanded_new_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_qty integer;
  v_i integer;
BEGIN
  -- Lock and fetch the order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not editable');
  END IF;

  -- Get existing items
  v_existing_items := COALESCE(v_order.items, '[]'::jsonb);

  -- Merge: append new items to existing items
  v_merged_items := v_existing_items || p_items;

  -- Calculate new total from merged items
  SELECT COALESCE(SUM(
    (COALESCE((item->>'price_usd')::numeric, (item->>'price')::numeric, 0) +
     COALESCE((SELECT SUM((opt->>'price')::numeric) FROM jsonb_array_elements(COALESCE(item->'options', '[]'::jsonb)) AS opt), 0)
    ) * COALESCE((item->>'quantity')::integer, 1)
  ), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_merged_items) AS item;

  -- Update temporary order with merged items
  UPDATE tb_order_temporary
  SET items = v_merged_items,
      total_usd = v_new_total,
      customer_notes = COALESCE(p_customer_notes, customer_notes),
      updated_at = now()
  WHERE id = p_order_id;

  -- Check if there's already a placed order in tb_his_admin for this device+shop today
  SELECT id, items INTO v_history_id, v_history_items
  FROM tb_his_admin
  WHERE device_id = p_device_id
    AND shop_id = v_order.shop_id
    AND status = 'placed'
    AND DATE(created_at) = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  -- If history exists, expand new items and append to history
  IF FOUND AND jsonb_array_length(p_items) > 0 THEN
    -- Expand new items to single units
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      FOR v_i IN 1..v_qty LOOP
        v_expanded_new_items := v_expanded_new_items || jsonb_build_object(
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

    -- Append expanded items to history
    UPDATE tb_his_admin
    SET items = COALESCE(v_history_items, '[]'::jsonb) || v_expanded_new_items,
        total_usd = (
          SELECT COALESCE(SUM((item->>'price')::numeric), 0)
          FROM jsonb_array_elements(COALESCE(v_history_items, '[]'::jsonb) || v_expanded_new_items) AS item
          WHERE item->>'status' != 'rejected'
        ),
        customer_notes = COALESCE(p_customer_notes, customer_notes),
        updated_at = now()
    WHERE id = v_history_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', p_order_id,
      'items', v_merged_items,
      'total_usd', v_new_total,
      'customer_notes', COALESCE(p_customer_notes, v_order.customer_notes)
    )
  );
END;
$$;