-- Allow staff members to view their assigned restaurant
-- Staff are linked via profiles.restaurant_id

CREATE POLICY "Staff can view their assigned restaurant"
ON public.restaurants
FOR SELECT
USING (
  id IN (
    SELECT restaurant_id FROM profiles WHERE user_id = auth.uid() AND restaurant_id IS NOT NULL
  )
);