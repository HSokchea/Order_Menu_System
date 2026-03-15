
-- ============================================================
-- 1. Create menu_item_sizes table (normalize from JSONB)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.menu_item_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage sizes" ON public.menu_item_sizes
  FOR ALL USING (
    menu_item_id IN (
      SELECT id FROM menu_items WHERE restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view sizes" ON public.menu_item_sizes
  FOR SELECT USING (true);

-- ============================================================
-- 2. Add size_id to menu_item_ingredients for size-specific recipes
-- ============================================================
ALTER TABLE public.menu_item_ingredients
  ADD COLUMN IF NOT EXISTS size_id uuid REFERENCES menu_item_sizes(id) ON DELETE CASCADE;

-- ============================================================
-- 3. Create option_groups table (normalized from JSONB)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  selection_type text NOT NULL DEFAULT 'single',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage option groups" ON public.option_groups
  FOR ALL USING (
    menu_item_id IN (
      SELECT id FROM menu_items WHERE restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view option groups" ON public.option_groups
  FOR SELECT USING (true);

-- ============================================================
-- 4. Create option_values table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_adjustment numeric NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.option_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage option values" ON public.option_values
  FOR ALL USING (
    group_id IN (
      SELECT og.id FROM option_groups og
      JOIN menu_items mi ON og.menu_item_id = mi.id
      JOIN restaurants r ON mi.restaurant_id = r.id
      WHERE r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view option values" ON public.option_values
  FOR SELECT USING (true);

-- ============================================================
-- 5. Create option_value_ingredients table (option ingredient impact)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.option_value_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_value_id uuid NOT NULL REFERENCES option_values(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(option_value_id, ingredient_id)
);

ALTER TABLE public.option_value_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage option value ingredients" ON public.option_value_ingredients
  FOR ALL USING (
    option_value_id IN (
      SELECT ov.id FROM option_values ov
      JOIN option_groups og ON ov.group_id = og.id
      JOIN menu_items mi ON og.menu_item_id = mi.id
      JOIN restaurants r ON mi.restaurant_id = r.id
      WHERE r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view option value ingredients" ON public.option_value_ingredients
  FOR SELECT USING (true);

-- ============================================================
-- 6. New deduction function supporting size + options
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_items_v2(
  p_restaurant_id uuid,
  p_order_items jsonb,
  p_reference_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_item jsonb;
  v_menu_item_id uuid;
  v_size_id uuid;
  v_recipe RECORD;
  v_opt jsonb;
  v_opt_val_id uuid;
  v_ovi RECORD;
  v_requirements jsonb := '{}'::jsonb;
  v_key text;
  v_required_qty numeric;
  v_current_stock numeric;
  v_insufficient jsonb := '[]'::jsonb;
  v_has_insufficient boolean := false;
  v_deducted jsonb := '[]'::jsonb;
  v_ing_name text;
  v_ing_unit text;
BEGIN
  -- Phase 1: Aggregate all ingredient requirements
  FOR v_order_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_menu_item_id := (v_order_item->>'menu_item_id')::uuid;
    v_size_id := NULL;

    -- Find size_id if item has a Size option
    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_order_item->'options', '[]'::jsonb))
    LOOP
      IF v_opt->>'groupName' = 'Size' THEN
        SELECT mis.id INTO v_size_id
        FROM menu_item_sizes mis
        WHERE mis.menu_item_id = v_menu_item_id
          AND mis.name = v_opt->>'label'
        LIMIT 1;
      END IF;
    END LOOP;

    -- Load recipe ingredients for this item/size
    FOR v_recipe IN
      SELECT mii.ingredient_id, mii.quantity
      FROM menu_item_ingredients mii
      WHERE mii.menu_item_id = v_menu_item_id
        AND (
          (v_size_id IS NOT NULL AND mii.size_id = v_size_id)
          OR (v_size_id IS NULL AND mii.size_id IS NULL)
        )
    LOOP
      v_key := v_recipe.ingredient_id::text;
      v_requirements := jsonb_set(
        v_requirements, ARRAY[v_key],
        to_jsonb(COALESCE((v_requirements->>v_key)::numeric, 0) + v_recipe.quantity)
      );
    END LOOP;

    -- Load option ingredient impacts (non-Size options)
    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_order_item->'options', '[]'::jsonb))
    LOOP
      IF v_opt->>'groupName' != 'Size' THEN
        SELECT ov.id INTO v_opt_val_id
        FROM option_values ov
        JOIN option_groups og ON ov.group_id = og.id
        WHERE og.menu_item_id = v_menu_item_id
          AND og.name = v_opt->>'groupName'
          AND ov.name = v_opt->>'label'
        LIMIT 1;

        IF v_opt_val_id IS NOT NULL THEN
          FOR v_ovi IN
            SELECT ovi.ingredient_id, ovi.quantity
            FROM option_value_ingredients ovi
            WHERE ovi.option_value_id = v_opt_val_id
          LOOP
            v_key := v_ovi.ingredient_id::text;
            v_requirements := jsonb_set(
              v_requirements, ARRAY[v_key],
              to_jsonb(COALESCE((v_requirements->>v_key)::numeric, 0) + v_ovi.quantity)
            );
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Phase 2: Check stock levels with FOR UPDATE locks
  FOR v_key IN SELECT * FROM jsonb_object_keys(v_requirements)
  LOOP
    v_required_qty := (v_requirements->>v_key)::numeric;
    SELECT i.current_stock, i.name, i.unit
    INTO v_current_stock, v_ing_name, v_ing_unit
    FROM ingredients i
    WHERE i.id = v_key::uuid AND i.is_active = true
    FOR UPDATE;

    IF v_current_stock IS NULL OR v_current_stock < v_required_qty THEN
      v_has_insufficient := true;
      v_insufficient := v_insufficient || jsonb_build_object(
        'ingredient', COALESCE(v_ing_name, 'Unknown'),
        'required', v_required_qty,
        'available', COALESCE(v_current_stock, 0),
        'unit', COALESCE(v_ing_unit, '')
      );
    END IF;
  END LOOP;

  IF v_has_insufficient THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_STOCK', 'insufficient_items', v_insufficient);
  END IF;

  -- Phase 3: Deduct stock
  FOR v_key IN SELECT * FROM jsonb_object_keys(v_requirements)
  LOOP
    v_required_qty := (v_requirements->>v_key)::numeric;
    SELECT i.name, i.unit INTO v_ing_name, v_ing_unit FROM ingredients i WHERE i.id = v_key::uuid;

    UPDATE ingredients SET current_stock = current_stock - v_required_qty WHERE id = v_key::uuid;

    INSERT INTO inventory_transactions (ingredient_id, restaurant_id, type, quantity, reference_id, note)
    VALUES (v_key::uuid, p_restaurant_id, 'order', -v_required_qty, p_reference_id, 'Auto-deducted for order confirmation');

    v_deducted := v_deducted || jsonb_build_object('ingredient', v_ing_name, 'quantity', v_required_qty, 'unit', v_ing_unit);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'deducted', v_deducted);
END;
$function$;

-- ============================================================
-- 7. Restore function v2 for size+options
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_inventory_for_items_v2(
  p_restaurant_id uuid,
  p_order_items jsonb,
  p_reference_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_item jsonb;
  v_menu_item_id uuid;
  v_size_id uuid;
  v_recipe RECORD;
  v_opt jsonb;
  v_opt_val_id uuid;
  v_ovi RECORD;
  v_requirements jsonb := '{}'::jsonb;
  v_key text;
  v_required_qty numeric;
  v_ing_name text;
  v_ing_unit text;
  v_restored jsonb := '[]'::jsonb;
BEGIN
  FOR v_order_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    v_menu_item_id := (v_order_item->>'menu_item_id')::uuid;
    v_size_id := NULL;

    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_order_item->'options', '[]'::jsonb))
    LOOP
      IF v_opt->>'groupName' = 'Size' THEN
        SELECT mis.id INTO v_size_id FROM menu_item_sizes mis
        WHERE mis.menu_item_id = v_menu_item_id AND mis.name = v_opt->>'label' LIMIT 1;
      END IF;
    END LOOP;

    FOR v_recipe IN
      SELECT mii.ingredient_id, mii.quantity FROM menu_item_ingredients mii
      WHERE mii.menu_item_id = v_menu_item_id
        AND ((v_size_id IS NOT NULL AND mii.size_id = v_size_id) OR (v_size_id IS NULL AND mii.size_id IS NULL))
    LOOP
      v_key := v_recipe.ingredient_id::text;
      v_requirements := jsonb_set(v_requirements, ARRAY[v_key],
        to_jsonb(COALESCE((v_requirements->>v_key)::numeric, 0) + v_recipe.quantity));
    END LOOP;

    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_order_item->'options', '[]'::jsonb))
    LOOP
      IF v_opt->>'groupName' != 'Size' THEN
        SELECT ov.id INTO v_opt_val_id FROM option_values ov
        JOIN option_groups og ON ov.group_id = og.id
        WHERE og.menu_item_id = v_menu_item_id AND og.name = v_opt->>'groupName' AND ov.name = v_opt->>'label' LIMIT 1;

        IF v_opt_val_id IS NOT NULL THEN
          FOR v_ovi IN SELECT ovi.ingredient_id, ovi.quantity FROM option_value_ingredients ovi WHERE ovi.option_value_id = v_opt_val_id
          LOOP
            v_key := v_ovi.ingredient_id::text;
            v_requirements := jsonb_set(v_requirements, ARRAY[v_key],
              to_jsonb(COALESCE((v_requirements->>v_key)::numeric, 0) + v_ovi.quantity));
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_key IN SELECT * FROM jsonb_object_keys(v_requirements)
  LOOP
    v_required_qty := (v_requirements->>v_key)::numeric;
    SELECT i.name, i.unit INTO v_ing_name, v_ing_unit FROM ingredients i WHERE i.id = v_key::uuid;

    UPDATE ingredients SET current_stock = current_stock + v_required_qty WHERE id = v_key::uuid;
    INSERT INTO inventory_transactions (ingredient_id, restaurant_id, type, quantity, reference_id, note)
    VALUES (v_key::uuid, p_restaurant_id, 'order_reversal', v_required_qty, p_reference_id, 'Stock restored due to order rejection');

    v_restored := v_restored || jsonb_build_object('ingredient', v_ing_name, 'quantity', v_required_qty, 'unit', v_ing_unit);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'restored', v_restored);
END;
$function$;

-- ============================================================
-- 8. Update update_order_items_status to use v2 deduction
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_items_status(p_order_id uuid, p_item_ids uuid[], p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_item JSONB;
  v_idx INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_new_total NUMERIC;
  v_items_to_deduct JSONB := '[]'::jsonb;
  v_items_to_restore JSONB := '[]'::jsonb;
  v_restaurant_id UUID;
  v_deduct_result JSONB;
  v_old_status TEXT;
BEGIN
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_order FROM tb_order_temporary WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_restaurant_id := v_order.shop_id;
  v_items := v_order.items;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF (v_item->>'item_id')::uuid = ANY(p_item_ids) THEN
      v_old_status := COALESCE(v_item->>'status', 'pending');

      IF p_new_status = 'confirmed' AND v_old_status = 'pending' THEN
        v_items_to_deduct := v_items_to_deduct || jsonb_build_array(v_item);
      END IF;

      IF p_new_status = 'rejected' AND v_old_status IN ('confirmed', 'preparing', 'ready') THEN
        v_items_to_restore := v_items_to_restore || jsonb_build_array(v_item);
      END IF;

      v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
      v_updated_count := v_updated_count + 1;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF jsonb_array_length(v_items_to_deduct) > 0 THEN
    v_deduct_result := deduct_inventory_for_items_v2(v_restaurant_id, v_items_to_deduct, p_order_id::text);
    IF NOT (v_deduct_result->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot confirm order: insufficient stock', 'insufficient_items', v_deduct_result->'insufficient_items');
    END IF;
  END IF;

  IF jsonb_array_length(v_items_to_restore) > 0 THEN
    PERFORM restore_inventory_for_items_v2(v_restaurant_id, v_items_to_restore, p_order_id::text);
  END IF;

  SELECT COALESCE(SUM((item->>'price')::numeric), 0) INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item WHERE item->>'status' != 'rejected';

  UPDATE tb_order_temporary SET items = v_items, total_usd = v_new_total, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count, 'new_total', v_new_total);
END;
$function$;

-- ============================================================
-- 9. Update update_order_item_status (single item) to use v2
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_item_status(p_order_id uuid, p_item_id uuid, p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_item JSONB;
  v_idx INTEGER := 0;
  v_found BOOLEAN := false;
  v_new_total NUMERIC;
  v_old_status TEXT;
  v_restaurant_id UUID;
  v_deduct_result JSONB;
BEGIN
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_order FROM tb_order_temporary WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_restaurant_id := v_order.shop_id;
  v_items := v_order.items;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'item_id' = p_item_id::text THEN
      v_old_status := COALESCE(v_item->>'status', 'pending');
      v_items := jsonb_set(v_items, ARRAY[v_idx::text, 'status'], to_jsonb(p_new_status));
      v_found := true;
      EXIT;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  IF NOT v_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found in order');
  END IF;

  IF p_new_status = 'confirmed' AND v_old_status = 'pending' THEN
    v_deduct_result := deduct_inventory_for_items_v2(v_restaurant_id, jsonb_build_array(v_item), p_order_id::text);
    IF NOT (v_deduct_result->>'success')::boolean THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot confirm order: insufficient stock', 'insufficient_items', v_deduct_result->'insufficient_items');
    END IF;
  END IF;

  IF p_new_status = 'rejected' AND v_old_status IN ('confirmed', 'preparing', 'ready') THEN
    PERFORM restore_inventory_for_items_v2(v_restaurant_id, jsonb_build_array(v_item), p_order_id::text);
  END IF;

  SELECT COALESCE(SUM((item->>'price')::numeric), 0) INTO v_new_total
  FROM jsonb_array_elements(v_items) AS item WHERE item->>'status' != 'rejected';

  UPDATE tb_order_temporary SET items = v_items, total_usd = v_new_total, updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'new_total', v_new_total);
END;
$function$;

-- ============================================================
-- 10. Update recalculate_menu_item_servings for size-specific recipes
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_menu_item_servings(p_menu_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recipe RECORD;
  v_min_servings integer := NULL;
  v_servings integer;
  v_has_recipe boolean := false;
BEGIN
  FOR v_recipe IN
    SELECT mii.ingredient_id, mii.quantity AS required_qty, mii.size_id, i.current_stock
    FROM menu_item_ingredients mii
    JOIN ingredients i ON i.id = mii.ingredient_id AND i.is_active = true
    WHERE mii.menu_item_id = p_menu_item_id AND mii.quantity > 0
  LOOP
    v_has_recipe := true;
    v_servings := floor(v_recipe.current_stock / v_recipe.required_qty)::integer;
    IF v_min_servings IS NULL OR v_servings < v_min_servings THEN
      v_min_servings := v_servings;
    END IF;
  END LOOP;

  IF NOT v_has_recipe THEN
    UPDATE menu_items SET available_servings = NULL WHERE id = p_menu_item_id;
  ELSE
    UPDATE menu_items SET available_servings = GREATEST(v_min_servings, 0) WHERE id = p_menu_item_id;
  END IF;
END;
$function$;

-- ============================================================
-- 11. Update get_shop_menu_items to serve normalized options/sizes
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shop_menu_items(p_shop_id uuid)
RETURNS TABLE(
  id uuid, name text, description text, price_usd numeric, image_url text,
  is_available boolean, category_id uuid, category_name text,
  options jsonb, sizes jsonb, size_enabled boolean, available_servings integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mi.id, mi.name, mi.description, mi.price_usd, mi.image_url,
    mi.is_available, mi.category_id,
    mc.name as category_name,
    COALESCE(
      (SELECT jsonb_build_object('options',
        jsonb_agg(
          jsonb_build_object(
            'name', og.name,
            'required', og.required,
            'type', og.selection_type,
            'values', (
              SELECT COALESCE(jsonb_agg(
                jsonb_build_object('label', ov.name, 'price', ov.price_adjustment, 'default', ov.is_default)
                ORDER BY ov.sort_order
              ), '[]'::jsonb)
              FROM option_values ov WHERE ov.group_id = og.id
            )
          ) ORDER BY og.sort_order
        )
      )
      FROM option_groups og WHERE og.menu_item_id = mi.id
      HAVING count(*) > 0),
      mi.options
    ) as options,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object('label', mis.name, 'price', mis.price, 'default', mis.is_default)
        ORDER BY mis.sort_order
      )
      FROM menu_item_sizes mis WHERE mis.menu_item_id = mi.id
      HAVING count(*) > 0),
      mi.sizes
    ) as sizes,
    mi.size_enabled,
    mi.available_servings
  FROM menu_items mi
  LEFT JOIN menu_categories mc ON mi.category_id = mc.id
  WHERE mi.restaurant_id = p_shop_id AND mi.is_available = true
  ORDER BY mc.display_order, mi.name;
END;
$function$;

-- ============================================================
-- 12. Trigger for menu_item_sizes changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_recalculate_servings_on_size_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_menu_item_servings(OLD.menu_item_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_menu_item_servings(NEW.menu_item_id);
    RETURN NEW;
  END IF;
END;
$function$;

CREATE TRIGGER trg_recalculate_servings_on_size_change
  AFTER INSERT OR UPDATE OR DELETE ON public.menu_item_sizes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_servings_on_size_change();
