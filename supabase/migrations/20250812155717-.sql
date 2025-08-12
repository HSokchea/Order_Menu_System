-- Add missing foreign key constraints to fix relationship errors

-- Add foreign key constraint from tables to restaurants
ALTER TABLE public.tables 
ADD CONSTRAINT fk_tables_restaurant_id 
FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Add foreign key constraint from menu_categories to restaurants  
ALTER TABLE public.menu_categories
ADD CONSTRAINT fk_menu_categories_restaurant_id
FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Add foreign key constraint from menu_items to restaurants
ALTER TABLE public.menu_items
ADD CONSTRAINT fk_menu_items_restaurant_id  
FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Add foreign key constraint from menu_items to menu_categories
ALTER TABLE public.menu_items
ADD CONSTRAINT fk_menu_items_category_id
FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE SET NULL;

-- Add foreign key constraint from orders to restaurants
ALTER TABLE public.orders
ADD CONSTRAINT fk_orders_restaurant_id
FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Add foreign key constraint from orders to tables
ALTER TABLE public.orders  
ADD CONSTRAINT fk_orders_table_id
FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;

-- Add foreign key constraint from order_items to orders
ALTER TABLE public.order_items
ADD CONSTRAINT fk_order_items_order_id
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- Add foreign key constraint from order_items to menu_items
ALTER TABLE public.order_items
ADD CONSTRAINT fk_order_items_menu_item_id  
FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;

-- Add foreign key constraint from profiles to restaurants
ALTER TABLE public.profiles
ADD CONSTRAINT fk_profiles_restaurant_id
FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;