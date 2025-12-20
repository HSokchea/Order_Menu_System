-- Create a secure function to get menu categories for a specific restaurant
-- This prevents bulk enumeration of all restaurant menus
CREATE OR REPLACE FUNCTION public.get_public_menu_categories(p_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  display_order integer,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return categories for the specified restaurant
  RETURN QUERY
  SELECT 
    mc.id,
    mc.name,
    mc.description,
    mc.display_order,
    mc.status,
    mc.created_at,
    mc.updated_at
  FROM menu_categories mc
  WHERE mc.restaurant_id = p_restaurant_id
  AND mc.status = 'active'
  ORDER BY mc.display_order;
END;
$$;

-- Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view categories" ON public.menu_categories;

-- The existing owner management policy remains for authenticated restaurant owners