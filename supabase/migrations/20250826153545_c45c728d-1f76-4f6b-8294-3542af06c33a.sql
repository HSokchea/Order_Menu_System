-- Replace the create_order_with_items function with enhanced validation
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid, uuid, text, numeric, text, jsonb);

-- Create a type for validation results
CREATE TYPE public.order_validation_result AS (
  success boolean,
  order_id uuid,
  unavailable_items jsonb
);

-- Enhanced create_order_with_items function with validation
CREATE OR REPLACE FUNCTION public.create_order_with_items_validated(
  p_restaurant_id uuid, 
  p_table_id uuid, 
  p_table_number text, 
  p_total_usd numeric, 
  p_customer_notes text, 
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_menu_item record;
  v_unavailable_items jsonb := '[]'::jsonb;
  v_item_id uuid;
  v_item_price numeric;
  v_cart_price numeric;
  v_has_errors boolean := false;
  v_error_item jsonb;
BEGIN
  -- Validate items input
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order items are required',
      'unavailable_items', '[]'::jsonb
    );
  END IF;

  -- Validate each item
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'menu_item_id')::uuid;
    v_cart_price := COALESCE((v_item->>'price_usd')::numeric, 0);
    
    -- Check if item exists and get current details
    SELECT id, name, price_usd, is_available, restaurant_id
    INTO v_menu_item
    FROM public.menu_items
    WHERE id = v_item_id AND restaurant_id = p_restaurant_id;
    
    -- Item doesn't exist
    IF v_menu_item.id IS NULL THEN
      v_error_item := jsonb_build_object(
        'id', v_item_id,
        'name', 'Unknown Item',
        'reason', 'Item no longer exists'
      );
      v_unavailable_items := v_unavailable_items || v_error_item;
      v_has_errors := true;
      CONTINUE;
    END IF;
    
    -- Item is not available
    IF NOT v_menu_item.is_available THEN
      v_error_item := jsonb_build_object(
        'id', v_item_id,
        'name', v_menu_item.name,
        'reason', 'Unavailable'
      );
      v_unavailable_items := v_unavailable_items || v_error_item;
      v_has_errors := true;
      CONTINUE;
    END IF;
    
    -- Price mismatch (allow small floating point differences)
    IF ABS(v_cart_price - COALESCE(v_menu_item.price_usd, 0)) > 0.01 THEN
      v_error_item := jsonb_build_object(
        'id', v_item_id,
        'name', v_menu_item.name,
        'reason', 'Price updated to $' || COALESCE(v_menu_item.price_usd, 0)::text
      );
      v_unavailable_items := v_unavailable_items || v_error_item;
      v_has_errors := true;
      CONTINUE;
    END IF;
  END LOOP;

  -- If there are validation errors, return them
  IF v_has_errors THEN
    RETURN jsonb_build_object(
      'success', false,
      'unavailable_items', v_unavailable_items
    );
  END IF;

  -- All items are valid, create the order
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

  -- Insert order items
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

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', 'new'
  );
END;
$$;