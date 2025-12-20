-- Fix: Remove insecure RLS policy and implement token-based order access
-- This prevents unauthorized access to historical orders

-- Step 1: Add order_token column for secure customer access
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Step 2: Generate tokens for existing orders that don't have one
UPDATE public.orders 
SET order_token = encode(gen_random_bytes(16), 'hex') 
WHERE order_token IS NULL;

-- Step 3: Drop the insecure RLS policy that allows viewing orders by table_id alone
DROP POLICY IF EXISTS "Anyone can view orders for their table" ON public.orders;

-- Step 4: Also drop the related insecure policy on order_items
DROP POLICY IF EXISTS "Anyone can view order items for their table orders" ON public.order_items;

-- Step 5: Update create_order_with_items_validated to return order_token
CREATE OR REPLACE FUNCTION public.create_order_with_items_validated(p_restaurant_id uuid, p_table_id uuid, p_table_number text, p_total_usd numeric, p_customer_notes text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_token text;
  v_item jsonb;
  v_menu_item record;
  v_unavailable_items jsonb := '[]'::jsonb;
  v_item_id uuid;
  v_item_price numeric;
  v_cart_price numeric;
  v_has_errors boolean := false;
  v_error_item jsonb;
BEGIN
  -- Validate restaurant exists
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Restaurant not found',
      'unavailable_items', '[]'::jsonb
    );
  END IF;

  -- Validate table exists and belongs to this restaurant
  IF p_table_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tables 
      WHERE id = p_table_id 
      AND restaurant_id = p_restaurant_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid table or restaurant',
        'unavailable_items', '[]'::jsonb
      );
    END IF;
  END IF;

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
  ) RETURNING id, order_token INTO v_order_id, v_order_token;

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

  -- Return success response with order_token for customer access
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_token', v_order_token,
    'status', 'new'
  );
END;
$function$;

-- Step 6: Update get_order_details to require token for anonymous access
CREATE OR REPLACE FUNCTION public.get_order_details(
  p_order_id uuid,
  p_order_token text DEFAULT NULL
)
RETURNS TABLE(id uuid, table_number text, table_id uuid, total_usd numeric, status text, created_at timestamp with time zone, restaurant_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If order token is provided, validate it (for anonymous customer access)
  IF p_order_token IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.table_number,
      o.table_id,
      o.total_usd,
      o.status,
      o.created_at,
      r.name as restaurant_name
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = p_order_id AND o.order_token = p_order_token;
  -- If authenticated user is restaurant owner, allow access
  ELSIF auth.uid() IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.table_number,
      o.table_id,
      o.total_usd,
      o.status,
      o.created_at,
      r.name as restaurant_name
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = p_order_id 
    AND o.restaurant_id IN (
      SELECT rest.id FROM restaurants rest WHERE rest.owner_id = auth.uid()
    );
  ELSE
    -- No token and not authenticated - deny access
    RETURN;
  END IF;
END;
$$;

-- Step 7: Create RPC to get order items by token (for customer order view)
CREATE OR REPLACE FUNCTION public.get_order_items_by_token(
  p_order_id uuid,
  p_order_token text
)
RETURNS TABLE(
  id uuid,
  quantity integer,
  price_usd numeric,
  menu_item_name text,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate order token before returning items
  IF NOT EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = p_order_id AND o.order_token = p_order_token
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    oi.id,
    oi.quantity,
    oi.price_usd,
    mi.name as menu_item_name,
    oi.notes
  FROM order_items oi
  JOIN menu_items mi ON oi.menu_item_id = mi.id
  WHERE oi.order_id = p_order_id;
END;
$$;