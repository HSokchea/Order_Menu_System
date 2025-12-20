-- Create RPC function to get active orders by tokens (for customer My Orders page)
-- This replaces the removed public RLS policy with token-based access

CREATE OR REPLACE FUNCTION public.get_active_orders_by_tokens(
  p_order_tokens text[]
)
RETURNS TABLE(
  id uuid,
  table_number text,
  table_id uuid,
  total_usd numeric,
  status text,
  created_at timestamp with time zone,
  restaurant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    r.name as restaurant_name
  FROM orders o
  JOIN restaurants r ON o.restaurant_id = r.id
  WHERE o.order_token = ANY(p_order_tokens)
  AND o.status NOT IN ('completed', 'rejected')
  ORDER BY o.created_at DESC;
END;
$$;