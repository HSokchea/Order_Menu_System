-- Create tb_order_temporary table for active/unpaid orders
CREATE TABLE public.tb_order_temporary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_usd NUMERIC DEFAULT 0,
  customer_notes TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one active order per device per day per shop
  CONSTRAINT unique_device_order_per_day UNIQUE (shop_id, device_id, order_date)
);

-- Create tb_his_admin table for completed/paid order history
CREATE TABLE public.tb_his_admin (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_order_id UUID,
  shop_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  total_usd NUMERIC DEFAULT 0,
  customer_notes TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.tb_order_temporary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_his_admin ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tb_order_temporary
CREATE POLICY "Anyone can view temporary orders"
  ON public.tb_order_temporary FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create temporary orders"
  ON public.tb_order_temporary FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update temporary orders"
  ON public.tb_order_temporary FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete temporary orders"
  ON public.tb_order_temporary FOR DELETE
  USING (true);

-- RLS Policies for tb_his_admin (order history)
CREATE POLICY "Anyone can view order history"
  ON public.tb_his_admin FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert order history"
  ON public.tb_his_admin FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_tb_order_temporary_device_shop ON public.tb_order_temporary(shop_id, device_id, order_date);
CREATE INDEX idx_tb_his_admin_shop ON public.tb_his_admin(shop_id);
CREATE INDEX idx_tb_his_admin_device ON public.tb_his_admin(device_id);

-- Create triggers for updated_at
CREATE TRIGGER update_tb_order_temporary_updated_at
  BEFORE UPDATE ON public.tb_order_temporary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tb_his_admin_updated_at
  BEFORE UPDATE ON public.tb_his_admin
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC function to get or create today's order for a device
CREATE OR REPLACE FUNCTION public.get_or_create_device_order(
  p_shop_id UUID,
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Check for existing order today
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE shop_id = p_shop_id
    AND device_id = p_device_id
    AND order_date = v_today;
  
  -- If order exists, return it
  IF v_order.id IS NOT NULL THEN
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
        'created_at', v_order.created_at,
        'updated_at', v_order.updated_at
      )
    );
  END IF;
  
  -- Create new order
  INSERT INTO tb_order_temporary (shop_id, device_id, status, items, order_date)
  VALUES (p_shop_id, p_device_id, 'pending', '[]'::jsonb, v_today)
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
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    )
  );
END;
$$;

-- RPC function to update temporary order items
CREATE OR REPLACE FUNCTION public.update_device_order(
  p_order_id UUID,
  p_device_id TEXT,
  p_items JSONB,
  p_total_usd NUMERIC,
  p_customer_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  UPDATE tb_order_temporary
  SET items = p_items,
      total_usd = p_total_usd,
      customer_notes = p_customer_notes,
      updated_at = now()
  WHERE id = p_order_id
    AND device_id = p_device_id
    AND status != 'paid'
  RETURNING * INTO v_order;
  
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or already paid');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'items', v_order.items,
      'total_usd', v_order.total_usd,
      'status', v_order.status
    )
  );
END;
$$;

-- RPC function to complete payment and move to history
CREATE OR REPLACE FUNCTION public.complete_device_order_payment(
  p_order_id UUID,
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_history_id UUID;
BEGIN
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE id = p_order_id
    AND device_id = p_device_id;
  
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already paid');
  END IF;
  
  INSERT INTO tb_his_admin (
    original_order_id,
    shop_id,
    device_id,
    status,
    total_usd,
    customer_notes,
    items,
    paid_at,
    created_at
  ) VALUES (
    v_order.id,
    v_order.shop_id,
    v_order.device_id,
    'completed',
    v_order.total_usd,
    v_order.customer_notes,
    v_order.items,
    now(),
    v_order.created_at
  )
  RETURNING id INTO v_history_id;
  
  DELETE FROM tb_order_temporary WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'history_id', v_history_id,
    'message', 'Order completed and moved to history'
  );
END;
$$;

-- RPC function to get public shop info
CREATE OR REPLACE FUNCTION public.get_public_shop(p_shop_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  logo_url TEXT,
  currency TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.logo_url,
    r.currency,
    r.created_at
  FROM restaurants r
  WHERE r.id = p_shop_id;
END;
$$;

-- RPC function to get menu items for a shop
CREATE OR REPLACE FUNCTION public.get_shop_menu_items(p_shop_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  price_usd NUMERIC,
  image_url TEXT,
  is_available BOOLEAN,
  category_id UUID,
  category_name TEXT,
  options JSONB,
  sizes JSONB,
  size_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.id,
    mi.name,
    mi.description,
    mi.price_usd,
    mi.image_url,
    mi.is_available,
    mi.category_id,
    mc.name as category_name,
    mi.options,
    mi.sizes,
    mi.size_enabled
  FROM menu_items mi
  LEFT JOIN menu_categories mc ON mi.category_id = mc.id
  WHERE mi.restaurant_id = p_shop_id
    AND mi.is_available = true
  ORDER BY mc.display_order, mi.name;
END;
$$;