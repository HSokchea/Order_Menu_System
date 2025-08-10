-- Insert restaurant record for the current user if it doesn't exist
-- This migration creates a restaurant record using the user's metadata

-- First, let's create a function to handle restaurant creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create restaurant record
  INSERT INTO public.restaurants (owner_id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant')
  );
  
  -- Create profile record
  INSERT INTO public.profiles (user_id, full_name, restaurant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    (SELECT id FROM public.restaurants WHERE owner_id = NEW.id LIMIT 1)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- For existing users without restaurants, create one
INSERT INTO public.restaurants (owner_id, name)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'restaurant_name', 'My Restaurant')
FROM auth.users
WHERE id NOT IN (SELECT owner_id FROM public.restaurants);

-- Create profiles for existing users without them
INSERT INTO public.profiles (user_id, full_name, restaurant_id)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  r.id
FROM auth.users u
JOIN public.restaurants r ON r.owner_id = u.id
WHERE u.id NOT IN (SELECT user_id FROM public.profiles);

-- Create some default categories for restaurants that don't have any
INSERT INTO public.menu_categories (restaurant_id, name, display_order)
SELECT 
  r.id,
  category_name,
  category_order
FROM public.restaurants r
CROSS JOIN (
  VALUES 
    ('Appetizers', 1),
    ('Main Courses', 2),
    ('Beverages', 3),
    ('Desserts', 4)
) AS default_categories(category_name, category_order)
WHERE r.id NOT IN (SELECT DISTINCT restaurant_id FROM public.menu_categories);