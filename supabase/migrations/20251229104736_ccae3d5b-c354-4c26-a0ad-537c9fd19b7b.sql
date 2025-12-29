-- Create a secure function to get public restaurant info
-- This allows anonymous users to view restaurant name for menu display
CREATE OR REPLACE FUNCTION public.get_public_restaurant(p_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.created_at,
    r.updated_at
  FROM restaurants r
  WHERE r.id = p_restaurant_id;
END;
$$;