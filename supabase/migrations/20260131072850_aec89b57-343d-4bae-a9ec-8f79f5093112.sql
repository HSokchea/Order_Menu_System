-- =====================================================
-- ENHANCED ORDERING FLOW: Append-only items with item-level status
-- Each item represents ONE unit (no quantity field in storage)
-- Items have individual statuses: pending, preparing, ready, rejected
-- Order status: placed, paid
-- =====================================================

-- 1. Update place_device_order to handle new item structure
-- Items are now individual units with status field
-- Existing items are NEVER removed, only new items appended
CREATE OR REPLACE FUNCTION public.place_device_order(p_order_id uuid, p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_existing_history RECORD;
  v_table_number TEXT;
  v_history_id UUID;
  v_new_items JSONB := '[]'::jsonb;
  v_expanded_items JSONB := '[]'::jsonb;
  v_item JSONB;
  v_i INTEGER;
  v_qty INTEGER;
  v_item_id UUID;
  v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
  -- Get the temporary order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id 
    AND device_id = p_device_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or already placed');
  END IF;

  -- Validate items exist
  IF v_order.items IS NULL OR jsonb_array_length(v_order.items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot place an empty order');
  END IF;

  -- Get table number if table_id exists
  IF v_order.table_id IS NOT NULL THEN
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = v_order.table_id;
  END IF;

  -- Expand items: quantity > 1 becomes multiple single-unit items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    
    -- Create individual item entries for each quantity unit
    FOR v_i IN 1..v_qty LOOP
      v_item_id := gen_random_uuid();
      v_expanded_items := v_expanded_items || jsonb_build_object(
        'item_id', v_item_id,
        'menu_item_id', v_item->>'menu_item_id',
        'name', v_item->>'name',
        'price', COALESCE((v_item->>'price_usd')::numeric, 0),
        'options', COALESCE(v_item->'options', '[]'::jsonb),
        'status', 'pending',
        'created_at', v_now
      );
    END LOOP;
  END LOOP;

  -- Check if there's already an active order for this device/shop/day
  SELECT * INTO v_existing_history
  FROM tb_his_admin
  WHERE shop_id = v_order.shop_id
    AND device_id = p_device_id
    AND DATE(created_at) = CURRENT_DATE
    AND status IN ('placed', 'preparing', 'ready')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- MERGE MODE: Append new items to existing order
    -- Calculate new total (sum of non-rejected items)
    v_new_items := v_existing_history.items || v_expanded_items;
    
    UPDATE tb_his_admin
    SET 
      items = v_new_items,
      total_usd = (
        SELECT COALESCE(SUM((item->>'price')::numeric), 0)
        FROM jsonb_array_elements(v_new_items) AS item
        WHERE item->>'status' != 'rejected'
      ),
      customer_notes = CASE 
        WHEN v_existing_history.customer_notes IS NULL OR v_existing_history.customer_notes = '' 
        THEN v_order.customer_notes
        WHEN v_order.customer_notes IS NULL OR v_order.customer_notes = ''
        THEN v_existing_history.customer_notes
        ELSE v_existing_history.customer_notes || E'\n---\n' || v_order.customer_notes
      END,
      updated_at = v_now
    WHERE id = v_existing_history.id;

    v_history_id := v_existing_history.id;
  ELSE
    -- CREATE MODE: New order
    INSERT INTO tb_his_admin (
      shop_id,
      device_id,
      status,
      total_usd,
      customer_notes,
      items,
      order_type,
      table_id,
      table_number,
      original_order_id,
      paid_at,
      created_at,
      updated_at
    ) VALUES (
      v_order.shop_id,
      p_device_id,
      'placed',
      (
        SELECT COALESCE(SUM((item->>'price')::numeric), 0)
        FROM jsonb_array_elements(v_expanded_items) AS item
        WHERE item->>'status' != 'rejected'
      ),
      v_order.customer_notes,
      v_expanded_items,
      COALESCE(v_order.order_type, 'takeaway'),
      v_order.table_id,
      v_table_number,
      p_order_id,
      NULL,
      v_now,
      v_now
    )
    RETURNING id INTO v_history_id;
  END IF;

  -- Update temporary order status to placed (keep for tracking)
  UPDATE tb_order_temporary
  SET status = 'placed', updated_at = v_now
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'order_id', p_order_id
  );
END;
$$;

-- 2. Create RPC to update individual item status (for shop owner)
CREATE OR REPLACE FUNCTION public.update_order_item_status(
  p_order_id uuid,
  p_item_id uuid,
  p_new_status text
)
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
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('pending', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status. Must be: pending, preparing, ready, or rejected');
  END IF;

  -- Get the order
  SELECT * INTO v_order
  FROM tb_his_admin
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Find and update the specific item
  v_items := v_order.items;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'item_id' = p_item_id::text THEN
      -- Update item status
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
  UPDATE tb_his_admin
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
$$;

-- 3. Create RPC to update multiple items status at once (bulk action)
CREATE OR REPLACE FUNCTION public.update_order_items_status(
  p_order_id uuid,
  p_item_ids uuid[],
  p_new_status text
)
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
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('pending', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  -- Get the order
  SELECT * INTO v_order
  FROM tb_his_admin
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
  UPDATE tb_his_admin
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
$$;

-- 4. Create RPC to mark order as paid
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Get and update the order
  UPDATE tb_his_admin
  SET 
    status = 'paid',
    paid_at = now(),
    updated_at = now()
  WHERE id = p_order_id
    AND status != 'paid'
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or already paid');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'paid_at', v_order.paid_at
  );
END;
$$;

-- 5. Update get_device_active_order to return new item structure
CREATE OR REPLACE FUNCTION public.get_device_active_order(p_shop_id uuid, p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_shop RECORD;
BEGIN
  -- Get the most recent active order for this device
  SELECT * INTO v_order
  FROM tb_his_admin
  WHERE shop_id = p_shop_id
    AND device_id = p_device_id
    AND DATE(created_at) = CURRENT_DATE
    AND status IN ('placed', 'preparing', 'ready')
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
      'table_number', v_order.table_number,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'paid_at', v_order.paid_at
    ),
    'shop', jsonb_build_object(
      'name', v_shop.name,
      'currency', COALESCE(v_shop.currency, 'USD'),
      'logo_url', v_shop.logo_url
    )
  );
END;
$$;

-- 6. Add UPDATE policy to tb_his_admin for status updates
DO $$
BEGIN
  -- Drop existing policy if it exists, then create new one
  DROP POLICY IF EXISTS "Shop owners can update order status" ON tb_his_admin;
  
  CREATE POLICY "Shop owners can update order status"
  ON tb_his_admin
  FOR UPDATE
  USING (
    shop_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );
END $$;