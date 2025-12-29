-- Create table_sessions table
CREATE TABLE public.table_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add table_session_id to orders table
ALTER TABLE public.orders 
ADD COLUMN table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL;

-- Enable RLS on table_sessions
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for table_sessions
CREATE POLICY "Restaurant owners can manage their sessions"
ON public.table_sessions
FOR ALL
USING (restaurant_id IN (
  SELECT id FROM restaurants WHERE owner_id = auth.uid()
));

CREATE POLICY "Anyone can view sessions for ordering"
ON public.table_sessions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create sessions when ordering"
ON public.table_sessions
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_table_sessions_table_status ON public.table_sessions(table_id, status);
CREATE INDEX idx_orders_table_session ON public.orders(table_session_id);

-- Function to get or create open session for a table
CREATE OR REPLACE FUNCTION public.get_or_create_table_session(
  p_table_id UUID,
  p_restaurant_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Try to find an existing open session
  SELECT id INTO v_session_id
  FROM table_sessions
  WHERE table_id = p_table_id
    AND status = 'open'
  LIMIT 1;
  
  -- If no open session, create one
  IF v_session_id IS NULL THEN
    INSERT INTO table_sessions (table_id, restaurant_id, status)
    VALUES (p_table_id, p_restaurant_id, 'open')
    RETURNING id INTO v_session_id;
  END IF;
  
  RETURN v_session_id;
END;
$$;

-- Function to get session details with all orders
CREATE OR REPLACE FUNCTION public.get_session_details(p_session_id UUID)
RETURNS TABLE(
  session_id UUID,
  table_id UUID,
  table_number TEXT,
  restaurant_id UUID,
  restaurant_name TEXT,
  status TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  total_amount NUMERIC,
  orders JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.id as session_id,
    ts.table_id,
    t.table_number,
    ts.restaurant_id,
    r.name as restaurant_name,
    ts.status,
    ts.started_at,
    ts.ended_at,
    ts.total_amount,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'total_usd', o.total_usd,
          'status', o.status,
          'created_at', o.created_at,
          'customer_notes', o.customer_notes,
          'items', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'quantity', oi.quantity,
                'price_usd', oi.price_usd,
                'notes', oi.notes,
                'menu_item_name', mi.name
              )
            )
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = o.id
          )
        ) ORDER BY o.created_at
      )
      FROM orders o
      WHERE o.table_session_id = ts.id
      ), '[]'::jsonb
    ) as orders
  FROM table_sessions ts
  JOIN tables t ON ts.table_id = t.id
  JOIN restaurants r ON ts.restaurant_id = r.id
  WHERE ts.id = p_session_id;
END;
$$;

-- Function to complete payment and close session
CREATE OR REPLACE FUNCTION public.complete_session_payment(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_session_status TEXT;
BEGIN
  -- Check session exists and is open
  SELECT status INTO v_session_status
  FROM table_sessions
  WHERE id = p_session_id;
  
  IF v_session_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  IF v_session_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session already paid');
  END IF;
  
  -- Calculate total from all orders in session
  SELECT COALESCE(SUM(total_usd), 0) INTO v_total
  FROM orders
  WHERE table_session_id = p_session_id;
  
  -- Update all orders in session to completed
  UPDATE orders
  SET status = 'completed', updated_at = now()
  WHERE table_session_id = p_session_id
    AND status != 'rejected';
  
  -- Close the session
  UPDATE table_sessions
  SET status = 'paid',
      ended_at = now(),
      total_amount = v_total,
      updated_at = now()
  WHERE id = p_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_amount', v_total,
    'session_id', p_session_id
  );
END;
$$;

-- Update create_order function to use sessions
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
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_token text;
  v_session_id uuid;
  v_session_status text;
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
    
    -- Check if there's an open session, or if session is paid
    SELECT id, status INTO v_session_id, v_session_status
    FROM table_sessions
    WHERE table_id = p_table_id AND status = 'open'
    LIMIT 1;
    
    -- If no open session, create one
    IF v_session_id IS NULL THEN
      INSERT INTO table_sessions (table_id, restaurant_id, status)
      VALUES (p_table_id, p_restaurant_id, 'open')
      RETURNING id INTO v_session_id;
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
    SELECT id, name, price_usd, is_available, restaurant_id, size_enabled
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
    
    -- Price mismatch validation (skip for size-enabled items)
    IF NOT COALESCE(v_menu_item.size_enabled, false) THEN
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
    table_session_id,
    table_number,
    total_usd,
    customer_notes,
    status
  ) VALUES (
    p_restaurant_id,
    p_table_id,
    v_session_id,
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

  -- Return success response with session info
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_token', v_order_token,
    'session_id', v_session_id,
    'status', 'new'
  );
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_table_sessions_updated_at
BEFORE UPDATE ON public.table_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for table_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;