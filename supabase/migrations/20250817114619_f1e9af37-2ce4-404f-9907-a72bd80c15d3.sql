-- Allow public read access to restaurant info for customer menu views
CREATE POLICY "Anyone can view restaurants"
ON public.restaurants
FOR SELECT
USING (true);