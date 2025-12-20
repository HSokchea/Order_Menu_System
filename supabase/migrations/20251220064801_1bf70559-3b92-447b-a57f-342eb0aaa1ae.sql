-- Drop and recreate the view with SECURITY INVOKER (safer default)
DROP VIEW IF EXISTS public.public_restaurants;

CREATE VIEW public.public_restaurants
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  created_at,
  updated_at
FROM public.restaurants;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_restaurants TO anon, authenticated;