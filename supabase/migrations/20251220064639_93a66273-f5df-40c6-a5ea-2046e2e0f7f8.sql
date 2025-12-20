-- Create a public view for restaurants that excludes owner_id
-- This allows anonymous users to access restaurant info without seeing internal fields

CREATE OR REPLACE VIEW public.public_restaurants AS
SELECT 
  id,
  name,
  created_at,
  updated_at
FROM public.restaurants;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_restaurants TO anon, authenticated;