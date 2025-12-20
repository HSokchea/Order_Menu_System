-- Remove the public SELECT policy that exposes owner_id
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;

-- The existing "Users can view their own restaurant" policy remains:
-- owners can still access their own restaurant data including owner_id