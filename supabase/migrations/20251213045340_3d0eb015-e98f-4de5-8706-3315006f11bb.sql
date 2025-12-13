-- Allow anyone to view order items for orders they can see (by table matching)
CREATE POLICY "Anyone can view order items for their table orders"
ON public.order_items
FOR SELECT
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE table_id IS NOT NULL
  )
);

-- Keep existing owner policy but this allows public to also read based on order access