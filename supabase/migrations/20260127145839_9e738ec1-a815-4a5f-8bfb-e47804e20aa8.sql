-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS public.get_or_create_device_order(uuid, text);

-- Recreate function with optional p_table_id parameter
CREATE OR REPLACE FUNCTION public.get_or_create_device_order(
  p_shop_id uuid, 
  p_device_id text,
  p_table_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_today DATE := CURRENT_DATE;
  v_order_type TEXT;
BEGIN
  -- Determine order type based on table_id presence
  IF p_table_id IS NOT NULL THEN
    v_order_type := 'dine_in';
  ELSE
    v_order_type := 'takeaway';
  END IF;

  -- Check for existing order today
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE shop_id = p_shop_id
    AND device_id = p_device_id
    AND order_date = v_today;
  
  -- If order exists, update table_id if provided and not already set
  IF v_order.id IS NOT NULL THEN
    -- Update table_id if a new one is provided
    IF p_table_id IS NOT NULL AND v_order.table_id IS NULL THEN
      UPDATE tb_order_temporary
      SET table_id = p_table_id,
          order_type = 'dine_in',
          updated_at = now()
      WHERE id = v_order.id
      RETURNING * INTO v_order;
    END IF;
    
    RETURN jsonb_build_object(
      'exists', true,
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
        'created_at', v_order.created_at,
        'updated_at', v_order.updated_at
      )
    );
  END IF;
  
  -- Create new order with order_type and table_id
  INSERT INTO tb_order_temporary (shop_id, device_id, status, items, order_date, order_type, table_id)
  VALUES (p_shop_id, p_device_id, 'pending', '[]'::jsonb, v_today, v_order_type, p_table_id)
  RETURNING * INTO v_order;
  
  RETURN jsonb_build_object(
    'exists', false,
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
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    )
  );
END;
$function$;