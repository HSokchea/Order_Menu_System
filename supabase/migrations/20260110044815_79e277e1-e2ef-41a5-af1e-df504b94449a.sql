-- Drop the existing policy
DROP POLICY IF EXISTS "Restaurant owners can manage their tables" ON public.tables;

-- Create separate policies for each operation with proper checks
CREATE POLICY "Restaurant owners can view their tables" 
ON public.tables 
FOR SELECT 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Restaurant owners can insert tables" 
ON public.tables 
FOR INSERT 
WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Restaurant owners can update their tables" 
ON public.tables 
FOR UPDATE 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Restaurant owners can delete their tables" 
ON public.tables 
FOR DELETE 
USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));