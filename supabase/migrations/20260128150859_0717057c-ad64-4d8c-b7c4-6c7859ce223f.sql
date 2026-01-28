-- Create RPC function to place an order (without payment processing)
-- This moves the order from temporary to history with status 'placed'
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
  v_history_id uuid;
  v_table_number text;
BEGIN
  -- Fetch the temporary order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or already placed'
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

  -- Insert into history with status 'placed'
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

  -- Update temporary order status to 'placed'
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

-- Create function to get active order for a device
CREATE OR REPLACE FUNCTION get_device_active_order(
  p_shop_id uuid,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order jsonb;
  v_shop_name text;
  v_shop_currency text;
  v_shop_logo text;
BEGIN
  -- Get shop info
  SELECT name, currency, logo_url INTO v_shop_name, v_shop_currency, v_shop_logo
  FROM restaurants
  WHERE id = p_shop_id;

  -- Look for placed order in history (today)
  SELECT jsonb_build_object(
    'id', h.id,
    'shop_id', h.shop_id,
    'device_id', h.device_id,
    'items', h.items,
    'total_usd', h.total_usd,
    'customer_notes', h.customer_notes,
    'status', h.status,
    'order_type', h.order_type,
    'table_id', h.table_id,
    'table_number', h.table_number,
    'created_at', h.created_at,
    'updated_at', h.updated_at,
    'paid_at', h.paid_at
  ) INTO v_order
  FROM tb_his_admin h
  WHERE h.shop_id = p_shop_id
    AND h.device_id = p_device_id
    AND h.status IN ('placed', 'preparing', 'ready')
    AND DATE(h.created_at) = CURRENT_DATE
  ORDER BY h.created_at DESC
  LIMIT 1;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active order found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order', v_order,
    'shop', jsonb_build_object(
      'name', v_shop_name,
      'currency', COALESCE(v_shop_currency, 'USD'),
      'logo_url', v_shop_logo
    )
  );
END;
$$;