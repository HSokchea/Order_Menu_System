-- Allow public read access to restaurant info for customer menu views
-- Enable Row Level Security is already enabled; add permissive SELECT policy
CREATE POLICY IF NOT EXISTS "Anyone can view restaurants"
ON public.restaurants
FOR SELECT
USING (true);
