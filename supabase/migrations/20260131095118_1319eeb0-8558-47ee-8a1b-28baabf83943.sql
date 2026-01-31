-- Update get_device_active_order to query from tb_order_temporary instead of tb_his_admin
CREATE OR REPLACE FUNCTION public.get_device_active_order(p_shop_id uuid, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_shop RECORD;
BEGIN
  -- Get the most recent active order for this device from tb_order_temporary
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE shop_id = p_shop_id
    AND device_id = p_device_id
    AND DATE(order_date) = CURRENT_DATE
    AND status IN ('pending', 'placed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active order found');
  END IF;

  -- Get shop info
  SELECT name, currency, logo_url INTO v_shop
  FROM restaurants
  WHERE id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'shop_id', v_order.shop_id,
      'device_id', v_order.device_id,
      'status', v_order.status,
      'total_usd', v_order.total_usd,
      'customer_notes', v_order.customer_notes,
      'items', v_order.items,
      'order_type', v_order.order_type,
      'table_id', v_order.table_id,
      'table_number', (SELECT table_number FROM tables WHERE id = v_order.table_id),
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    ),
    'shop', jsonb_build_object(
      'name', v_shop.name,
      'currency', COALESCE(v_shop.currency, 'USD'),
      'logo_url', v_shop.logo_url
    )
  );
END;
$function$;

-- Update place_device_order to keep items in tb_order_temporary (no move to tb_his_admin)
-- Items are expanded to single units and status is set to 'placed'
CREATE OR REPLACE FUNCTION public.place_device_order(p_order_id uuid, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_expanded_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_qty integer;
  v_i integer;
  v_existing_placed_items jsonb;
  v_table_number text;
BEGIN
  -- Lock and fetch the order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- If already placed, check if there are new pending items to process
  IF v_order.status = 'placed' THEN
    -- Check if the items array has any items without item_id (new cart items to expand)
    SELECT jsonb_agg(item) INTO v_existing_placed_items
    FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) AS item
    WHERE item ? 'item_id';

    -- Return success if all items already have item_id (already expanded)
    IF v_existing_placed_items IS NOT NULL AND 
       jsonb_array_length(v_existing_placed_items) = jsonb_array_length(COALESCE(v_order.items, '[]'::jsonb)) THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'message', 'Order already placed'
      );
    END IF;
  END IF;

  -- Separate already expanded items from new cart items
  v_existing_placed_items := '[]'::jsonb;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) LOOP
    IF v_item ? 'item_id' THEN
      -- Already expanded item - keep as is
      v_existing_placed_items := v_existing_placed_items || v_item;
    ELSE
      -- New cart item - expand to single units
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      FOR v_i IN 1..v_qty LOOP
        v_expanded_items := v_expanded_items || jsonb_build_object(
          'item_id', gen_random_uuid(),
          'menu_item_id', COALESCE(v_item->>'menu_item_id', v_item->>'id'),
          'name', v_item->>'name',
          'options', COALESCE(v_item->'options', '[]'::jsonb),
          'price', COALESCE((v_item->>'price_usd')::numeric, (v_item->>'price')::numeric, 0),
          'status', 'pending',
          'created_at', now()
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Merge existing placed items with newly expanded items
  v_expanded_items := v_existing_placed_items || v_expanded_items;

  -- Get table_number if table_id exists
  IF v_order.table_id IS NOT NULL THEN
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = v_order.table_id;
  END IF;

  -- Update tb_order_temporary with expanded items and placed status
  UPDATE tb_order_temporary
  SET 
    items = v_expanded_items,
    status = 'placed',
    total_usd = (
      SELECT COALESCE(SUM((item->>'price')::numeric), 0)
      FROM jsonb_array_elements(v_expanded_items) AS item
      WHERE item->>'status' != 'rejected'
    ),
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id
  );
END;
$function$;

-- Update update_device_order to properly append items
CREATE OR REPLACE FUNCTION public.update_device_order(p_order_id uuid, p_device_id text, p_items jsonb, p_total_usd numeric, p_customer_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_existing_items jsonb;
  v_merged_items jsonb;
  v_new_total numeric;
BEGIN
  -- Lock and fetch the order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get existing items
  v_existing_items := COALESCE(v_order.items, '[]'::jsonb);

  -- Append new items to existing items
  v_merged_items := v_existing_items || p_items;

  -- Calculate total from merged items (handles both cart format and expanded format)
  SELECT COALESCE(SUM(
    CASE 
      WHEN item ? 'item_id' THEN 
        -- Expanded format (single unit, no quantity)
        COALESCE((item->>'price')::numeric, 0)
      ELSE 
        -- Cart format (has quantity)
        (COALESCE((item->>'price_usd')::numeric, (item->>'price')::numeric, 0) +
         COALESCE((SELECT SUM((opt->>'price')::numeric) FROM jsonb_array_elements(COALESCE(item->'options', '[]'::jsonb)) AS opt), 0)
        ) * COALESCE((item->>'quantity')::integer, 1)
    END
  ), 0)
  INTO v_new_total
  FROM jsonb_array_elements(v_merged_items) AS item
  WHERE (item->>'status') IS NULL OR (item->>'status') != 'rejected';

  -- Update temporary order with merged items
  UPDATE tb_order_temporary
  SET items = v_merged_items,
      total_usd = v_new_total,
      customer_notes = COALESCE(p_customer_notes, customer_notes),
      updated_at = now()
  WHERE id = p_order_id;

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
$function$;

-- Update update_order_item_status to work with tb_order_temporary
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

  -- Find and update the specific item
  v_items := v_order.items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'item_id' = p_item_id::text THEN
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

  RETURN jsonb_build_object(
    'success', true,
    'new_total', v_new_total
  );
END;
$function$;

-- Update update_order_items_status to work with tb_order_temporary
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

  -- Update items matching the provided IDs
  v_items := v_order.items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'item_id')::uuid = ANY(p_item_ids) THEN
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

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'new_total', v_new_total
  );
END;
$function$;

-- Update mark_order_paid to move data from tb_order_temporary to tb_his_admin
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_history_id uuid;
  v_table_number text;
BEGIN
  -- Get the order from tb_order_temporary
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND status = 'placed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not placed');
  END IF;

  -- Get table number if exists
  IF v_order.table_id IS NOT NULL THEN
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = v_order.table_id;
  END IF;

  -- Insert into tb_his_admin (archive)
  INSERT INTO tb_his_admin (
    original_order_id,
    shop_id,
    device_id,
    items,
    total_usd,
    customer_notes,
    status,
    paid_at,
    order_type,
    table_id,
    table_number
  )
  VALUES (
    v_order.id,
    v_order.shop_id,
    v_order.device_id,
    v_order.items,
    v_order.total_usd,
    v_order.customer_notes,
    'paid',
    now(),
    COALESCE(v_order.order_type, 'takeaway'),
    v_order.table_id,
    v_table_number
  )
  RETURNING id INTO v_history_id;

  -- Delete from tb_order_temporary
  DELETE FROM tb_order_temporary WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'history_id', v_history_id,
    'paid_at', now()
  );
END;
$function$;