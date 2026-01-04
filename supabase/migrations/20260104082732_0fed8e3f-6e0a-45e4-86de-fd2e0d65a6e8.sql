-- Update get_active_orders_by_tokens to include customer_notes
DROP FUNCTION IF EXISTS public.get_active_orders_by_tokens(text[]);

CREATE OR REPLACE FUNCTION public.get_active_orders_by_tokens(p_order_tokens text[])
RETURNS TABLE(
  id uuid,
  table_number text,
  table_id uuid,
  total_usd numeric,
  status text,
  created_at timestamp with time zone,
  restaurant_name text,
  customer_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.table_number,
    o.table_id,
    o.total_usd,
    o.status,
    o.created_at,
    r.name as restaurant_name,
    o.customer_notes
  FROM orders o
  JOIN restaurants r ON o.restaurant_id = r.id
  WHERE o.order_token = ANY(p_order_tokens)
    AND o.status != 'completed';
END;
$$;