-- Create a secure function to get table info for a specific table ID
-- This prevents bulk enumeration of all restaurant tables
CREATE OR REPLACE FUNCTION public.get_public_table(p_table_id uuid)
RETURNS TABLE (
  id uuid,
  table_number text,
  restaurant_id uuid,
  qr_code_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.table_number,
    t.restaurant_id,
    t.qr_code_url,
    t.created_at
  FROM tables t
  WHERE t.id = p_table_id;
END;
$$;

-- Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view tables" ON public.tables;

-- The existing owner management policy remains for authenticated restaurant owners