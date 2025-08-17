-- Create a secure function to create an order with its items and return the order id
-- This avoids RLS issues for anonymous customers by using SECURITY DEFINER
-- and grants execute to anon & authenticated roles only.

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_table_number text,
  p_total_usd numeric,
  p_customer_notes text,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
BEGIN
  -- Validate items
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required';
  END IF;

  -- Create order
  INSERT INTO public.orders (
    restaurant_id,
    table_id,
    table_number,
    total_usd,
    customer_notes,
    status
  ) VALUES (
    p_restaurant_id,
    p_table_id,
    p_table_number,
    COALESCE(p_total_usd, 0),
    NULLIF(p_customer_notes, ''),
    'new'
  ) RETURNING id INTO v_order_id;

  -- Insert items
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      quantity,
      price_usd,
      notes
    ) VALUES (
      v_order_id,
      (v_item->>'menu_item_id')::uuid,
      COALESCE((v_item->>'quantity')::int, 1),
      COALESCE((v_item->>'price_usd')::numeric, 0),
      NULLIF(v_item->>'notes','')
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Ensure only anon and authenticated can execute this function
REVOKE ALL ON FUNCTION public.create_order_with_items(uuid, uuid, text, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid, uuid, text, numeric, text, jsonb) TO anon, authenticated;
