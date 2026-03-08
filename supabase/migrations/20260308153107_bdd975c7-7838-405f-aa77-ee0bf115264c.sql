
-- Ingredients table
CREATE TABLE public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Menu item ingredients (recipes)
CREATE TABLE public.menu_item_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, ingredient_id)
);

-- Inventory transactions
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'order', 'adjustment', 'waste')),
  quantity NUMERIC NOT NULL,
  reference_id TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for ingredients
CREATE POLICY "Restaurant staff can view ingredients"
  ON public.ingredients FOR SELECT
  USING (restaurant_id = get_user_restaurant_id_safe(auth.uid()) OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Restaurant owners can manage ingredients"
  ON public.ingredients FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- RLS policies for menu_item_ingredients
CREATE POLICY "Restaurant staff can view recipes"
  ON public.menu_item_ingredients FOR SELECT
  USING (menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = get_user_restaurant_id_safe(auth.uid()) OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())));

CREATE POLICY "Restaurant owners can manage recipes"
  ON public.menu_item_ingredients FOR ALL
  USING (menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())));

-- RLS policies for inventory_transactions
CREATE POLICY "Restaurant staff can view transactions"
  ON public.inventory_transactions FOR SELECT
  USING (restaurant_id = get_user_restaurant_id_safe(auth.uid()) OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Restaurant owners can manage transactions"
  ON public.inventory_transactions FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Updated_at trigger for ingredients
CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to deduct stock for order items
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_items(
  p_restaurant_id UUID,
  p_item_ids TEXT[],
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item_id TEXT;
  v_menu_item_id UUID;
  v_recipe RECORD;
  v_deducted JSONB := '[]'::jsonb;
BEGIN
  -- For each item, find recipe and deduct
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    -- Get menu_item_id from the order item
    -- Items are stored with menu_item_id in the JSONB
    v_menu_item_id := v_item_id::UUID;
    
    -- Deduct each ingredient in the recipe
    FOR v_recipe IN 
      SELECT mii.ingredient_id, mii.quantity, i.name, i.unit
      FROM menu_item_ingredients mii
      JOIN ingredients i ON i.id = mii.ingredient_id
      WHERE mii.menu_item_id = v_menu_item_id
        AND i.is_active = true
    LOOP
      -- Deduct from current stock
      UPDATE ingredients
      SET current_stock = GREATEST(current_stock - v_recipe.quantity, 0)
      WHERE id = v_recipe.ingredient_id;
      
      -- Record transaction
      INSERT INTO inventory_transactions (ingredient_id, restaurant_id, type, quantity, reference_id, note)
      VALUES (v_recipe.ingredient_id, p_restaurant_id, 'order', -v_recipe.quantity, p_reference_id, 
              'Auto-deducted for order');
      
      v_deducted := v_deducted || jsonb_build_object(
        'ingredient', v_recipe.name,
        'quantity', v_recipe.quantity,
        'unit', v_recipe.unit
      );
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'deducted', v_deducted);
END;
$$;

-- Add inventory permission keys
INSERT INTO public.permissions (key, name, action, resource, description)
VALUES 
  ('inventory.view', 'View Inventory', 'view', 'inventory', 'View ingredients and stock levels'),
  ('inventory.manage', 'Manage Inventory', 'manage', 'inventory', 'Add, edit, adjust inventory and recipes')
ON CONFLICT DO NOTHING;
