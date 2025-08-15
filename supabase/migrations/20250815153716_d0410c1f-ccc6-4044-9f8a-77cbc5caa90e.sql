-- Insert sample menu items for testing
-- Note: This assumes restaurants and categories exist. Restaurant owners can manage their own items via RLS.

-- Sample Appetizers
INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Spring Rolls', 
  'Fresh vegetables wrapped in rice paper, served with peanut dipping sauce', 
  6.50, 
  26000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%appetizer%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Chicken Wings', 
  'Crispy wings tossed in buffalo sauce, served with celery and blue cheese', 
  8.75, 
  35000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%appetizer%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Mozzarella Sticks', 
  'Golden fried mozzarella served with marinara sauce', 
  7.25, 
  29000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%appetizer%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Bruschetta', 
  'Toasted bread topped with fresh tomatoes, basil, and garlic', 
  5.95, 
  24000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%appetizer%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Calamari Rings', 
  'Crispy squid rings with spicy aioli dipping sauce', 
  9.50, 
  38000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%appetizer%' LIMIT 1;

-- Sample Main Dishes
INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Grilled Salmon', 
  'Fresh Atlantic salmon with lemon herb butter and seasonal vegetables', 
  18.95, 
  76000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%main%' OR mc.name ILIKE '%entree%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Ribeye Steak', 
  '12oz prime ribeye grilled to perfection with garlic mashed potatoes', 
  24.50, 
  98000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%main%' OR mc.name ILIKE '%entree%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Chicken Parmesan', 
  'Breaded chicken breast with marinara sauce and melted mozzarella', 
  16.75, 
  67000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%main%' OR mc.name ILIKE '%entree%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Pad Thai', 
  'Traditional Thai stir-fried noodles with shrimp, tofu, and peanuts', 
  14.25, 
  57000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%main%' OR mc.name ILIKE '%entree%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Margherita Pizza', 
  'Wood-fired pizza with fresh mozzarella, tomatoes, and basil', 
  13.95, 
  56000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%main%' OR mc.name ILIKE '%entree%' LIMIT 1;

-- Sample Desserts
INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Chocolate Lava Cake', 
  'Warm chocolate cake with molten center, served with vanilla ice cream', 
  7.95, 
  32000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%dessert%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Tiramisu', 
  'Classic Italian dessert with coffee-soaked ladyfingers and mascarpone', 
  6.50, 
  26000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%dessert%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Cheesecake', 
  'New York style cheesecake with berry compote', 
  6.95, 
  28000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%dessert%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Crème Brûlée', 
  'Rich vanilla custard with caramelized sugar crust', 
  7.25, 
  29000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%dessert%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Ice Cream Sundae', 
  'Three scoops of vanilla ice cream with chocolate sauce and whipped cream', 
  5.75, 
  23000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%dessert%' LIMIT 1;

-- Sample Beverages
INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Fresh Orange Juice', 
  'Freshly squeezed orange juice', 
  4.50, 
  18000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%beverage%' OR mc.name ILIKE '%drink%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Iced Coffee', 
  'Cold brew coffee served over ice with milk', 
  3.75, 
  15000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%beverage%' OR mc.name ILIKE '%drink%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Mango Smoothie', 
  'Blended fresh mango with yogurt and honey', 
  5.25, 
  21000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%beverage%' OR mc.name ILIKE '%drink%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Green Tea', 
  'Premium jasmine green tea', 
  2.95, 
  12000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%beverage%' OR mc.name ILIKE '%drink%' LIMIT 1;

INSERT INTO public.menu_items (name, description, price_usd, price_khr, category_id, restaurant_id, is_available) 
SELECT 
  'Sparkling Water', 
  'San Pellegrino sparkling mineral water', 
  3.25, 
  13000, 
  mc.id, 
  mc.restaurant_id, 
  true
FROM menu_categories mc WHERE mc.name ILIKE '%beverage%' OR mc.name ILIKE '%drink%' LIMIT 1;