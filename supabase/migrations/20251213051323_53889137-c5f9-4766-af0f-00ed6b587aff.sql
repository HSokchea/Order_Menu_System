-- Allow anyone to view orders for their table (for real-time customer updates)
CREATE POLICY "Anyone can view orders for their table" 
ON public.orders 
FOR SELECT 
USING (table_id IS NOT NULL);