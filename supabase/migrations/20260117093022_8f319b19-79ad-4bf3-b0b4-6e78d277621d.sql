-- Drop the problematic policy
DROP POLICY IF EXISTS "Staff can view their assigned restaurant" ON public.restaurants;

-- Create a SECURITY DEFINER function to safely get user's restaurant_id
-- This breaks the RLS recursion by bypassing RLS when checking
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id_safe(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Recreate the policy using the function
CREATE POLICY "Staff can view their assigned restaurant"
ON public.restaurants
FOR SELECT
USING (
  id = public.get_user_restaurant_id_safe(auth.uid())
  OR owner_id = auth.uid()
);