-- Enable realtime for menu_items table
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;

-- Enable realtime for menu_categories table  
ALTER TABLE public.menu_categories REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;