-- Create a secure function to get order details for order success page
-- This allows anonymous users to view their order details after placing an order
CREATE OR REPLACE FUNCTION public.get_order_details(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  table_number text,
  total_usd numeric,
  status text,
  created_at timestamptz,
  restaurant_name text
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
    o.total_usd,
    o.status,
    o.created_at,
    r.name as restaurant_name
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id;
END;
$$;

-- Grant execute permission to anon and authenticated roles
REVOKE ALL ON FUNCTION public.get_order_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_details(uuid) TO anon, authenticated;