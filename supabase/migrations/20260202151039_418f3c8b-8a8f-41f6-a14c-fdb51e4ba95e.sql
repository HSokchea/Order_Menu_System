-- Update place_device_order to include special_request per item
-- This ensures each round's items carry their own special request note

CREATE OR REPLACE FUNCTION public.place_device_order(p_order_id uuid, p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_expanded_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_i int;
  v_current_time text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_customer_notes text;
BEGIN
  -- Get the current order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id AND device_id = p_device_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Store customer notes for this round
  v_customer_notes := v_order.customer_notes;

  -- Get existing placed items (already expanded)
  IF v_order.status = 'placed' AND v_order.items IS NOT NULL THEN
    -- Filter to only keep items that have item_id (already expanded)
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_expanded_items
    FROM jsonb_array_elements(v_order.items) AS item
    WHERE item->>'item_id' IS NOT NULL;
  END IF;

  -- Expand new cart items (those without item_id) into single units
  IF v_order.items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
    LOOP
      -- Skip already expanded items (those with item_id)
      IF v_item->>'item_id' IS NOT NULL THEN
        CONTINUE;
      END IF;
      
      -- Expand each quantity into individual items with special_request
      FOR v_i IN 1..COALESCE((v_item->>'quantity')::int, 1)
      LOOP
        v_expanded_items := v_expanded_items || jsonb_build_object(
          'item_id', gen_random_uuid()::text,
          'menu_item_id', v_item->>'menu_item_id',
          'name', v_item->>'name',
          'price', COALESCE((v_item->>'price_usd')::numeric, (v_item->>'price')::numeric, 0),
          'options', COALESCE(v_item->'options', '[]'::jsonb),
          'status', 'pending',
          'created_at', v_current_time,
          'special_request', v_customer_notes  -- Each item in this round gets the current notes
        );
      END LOOP;
    END LOOP;
  END IF;

  -- Calculate total from expanded items (excluding rejected)
  SELECT COALESCE(SUM(
    (item->>'price')::numeric + 
    COALESCE((SELECT SUM((opt->>'price')::numeric) FROM jsonb_array_elements(item->'options') AS opt), 0)
  ), 0)
  INTO v_order.total_usd
  FROM jsonb_array_elements(v_expanded_items) AS item
  WHERE item->>'status' != 'rejected';

  -- Update the order with expanded items, mark as placed, and clear customer_notes
  -- (notes are now stored per-item)
  UPDATE tb_order_temporary
  SET 
    items = v_expanded_items,
    status = 'placed',
    total_usd = v_order.total_usd,
    customer_notes = null,  -- Clear order-level notes as they're now in items
    updated_at = now()
  WHERE id = p_order_id AND device_id = p_device_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'message', 'Order placed successfully'
  );
END;
$$;