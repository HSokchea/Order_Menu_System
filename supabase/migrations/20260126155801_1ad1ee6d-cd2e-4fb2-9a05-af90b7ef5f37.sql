-- Drop existing function first to change return type
DROP FUNCTION IF EXISTS public.complete_device_order_payment(uuid, text);

-- Recreate with updated logic
CREATE FUNCTION public.complete_device_order_payment(
  p_order_id uuid,
  p_device_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_history_id uuid;
  v_table_number text;
BEGIN
  -- Get the order
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id
    AND status = 'pending';

  IF v_order IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Order not found or already paid'
    );
  END IF;

  -- Get table number if table_id exists
  IF v_order.table_id IS NOT NULL THEN
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = v_order.table_id;
  END IF;

  -- Insert into history
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
    'completed',
    now(),
    COALESCE(v_order.order_type, 'takeaway'),
    v_order.table_id,
    v_table_number
  )
  RETURNING id INTO v_history_id;

  -- Delete the temporary order
  DELETE FROM tb_order_temporary WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true,
    'history_id', v_history_id
  );
END;
$$;

-- Create function to get public table info for QR scanning
CREATE OR REPLACE FUNCTION public.get_public_table_by_id(p_table_id uuid)
RETURNS TABLE (
  id uuid,
  table_number text,
  restaurant_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, table_number, restaurant_id
  FROM tables
  WHERE id = p_table_id;
$$;