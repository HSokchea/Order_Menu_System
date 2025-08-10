-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table  
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'owner',
  restaurant_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu categories table
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu items table
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  category_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  price_usd NUMERIC DEFAULT 0,
  price_khr INTEGER DEFAULT 0,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables table
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  table_number TEXT NOT NULL,
  qr_code_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  table_id UUID,
  table_number TEXT NOT NULL,
  customer_notes TEXT,
  status TEXT DEFAULT 'new',
  total_usd NUMERIC DEFAULT 0,
  total_khr INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  menu_item_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_usd NUMERIC DEFAULT 0,
  price_khr INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurants
CREATE POLICY "Users can view their own restaurant" ON public.restaurants FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can create their own restaurant" ON public.restaurants FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own restaurant" ON public.restaurants FOR UPDATE USING (owner_id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for menu categories
CREATE POLICY "Anyone can view categories" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "Restaurant owners can manage their categories" ON public.menu_categories FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- RLS Policies for menu items
CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Restaurant owners can manage their menu items" ON public.menu_items FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- RLS Policies for tables
CREATE POLICY "Anyone can view tables" ON public.tables FOR SELECT USING (true);
CREATE POLICY "Restaurant owners can manage their tables" ON public.tables FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- RLS Policies for orders
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Restaurant owners can view their orders" ON public.orders FOR SELECT USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "Restaurant owners can update their orders" ON public.orders FOR UPDATE USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- RLS Policies for order items
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Restaurant owners can view their order items" ON public.order_items FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for orders and order_items
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;