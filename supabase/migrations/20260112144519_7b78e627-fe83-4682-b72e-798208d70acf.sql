-- Allow restaurant owners to view profiles of staff in their restaurant
CREATE POLICY "Restaurant owners can view staff profiles"
ON public.profiles
FOR SELECT
USING (
  restaurant_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = profiles.restaurant_id
    AND restaurants.owner_id = auth.uid()
  )
);

-- Allow restaurant owners to update staff profiles in their restaurant
CREATE POLICY "Restaurant owners can update staff profiles"
ON public.profiles
FOR UPDATE
USING (
  restaurant_id IS NOT NULL AND
  user_id != auth.uid() AND -- Can't update own profile via this policy
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = profiles.restaurant_id
    AND restaurants.owner_id = auth.uid()
  )
);