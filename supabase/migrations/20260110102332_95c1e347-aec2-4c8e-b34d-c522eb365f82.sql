-- Function to detect circular inheritance
CREATE OR REPLACE FUNCTION public.check_circular_inheritance(
  p_parent_role_id UUID,
  p_child_role_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_cycle BOOLEAN := false;
BEGIN
  -- Check if adding this inheritance would create a cycle
  WITH RECURSIVE inheritance_chain AS (
    -- Base case: start from the proposed child
    SELECT child_role_id AS role_id, 1 AS depth
    FROM role_inheritance
    WHERE parent_role_id = p_child_role_id
    
    UNION ALL
    
    -- Recursive case: follow the chain
    SELECT ri.child_role_id, ic.depth + 1
    FROM role_inheritance ri
    JOIN inheritance_chain ic ON ri.parent_role_id = ic.role_id
    WHERE ic.depth < 100  -- Prevent infinite loops
  )
  SELECT EXISTS (
    SELECT 1 FROM inheritance_chain WHERE role_id = p_parent_role_id
  ) INTO v_has_cycle;
  
  RETURN v_has_cycle;
END;
$$;

-- Function to get all inherited role IDs for a role (traverses the inheritance tree)
CREATE OR REPLACE FUNCTION public.get_inherited_role_ids(p_role_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_ids UUID[];
BEGIN
  WITH RECURSIVE inheritance_tree AS (
    -- Base case: direct children
    SELECT child_role_id AS role_id, 1 AS depth
    FROM role_inheritance
    WHERE parent_role_id = p_role_id
    
    UNION
    
    -- Recursive case: children of children
    SELECT ri.child_role_id, it.depth + 1
    FROM role_inheritance ri
    JOIN inheritance_tree it ON ri.parent_role_id = it.role_id
    WHERE it.depth < 100
  )
  SELECT array_agg(DISTINCT role_id) INTO v_role_ids
  FROM inheritance_tree;
  
  RETURN COALESCE(v_role_ids, ARRAY[]::UUID[]);
END;
$$;

-- Function to get effective permissions for a role (including inherited)
CREATE OR REPLACE FUNCTION public.get_role_effective_permissions(p_role_id UUID)
RETURNS TABLE(
  permission_id UUID,
  permission_key TEXT,
  permission_name TEXT,
  is_inherited BOOLEAN,
  source_role_id UUID,
  source_role_name TEXT,
  condition_json JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE inheritance_tree AS (
    -- Start with the role itself
    SELECT p_role_id AS role_id, 0 AS depth
    
    UNION
    
    -- Add inherited roles
    SELECT ri.child_role_id, it.depth + 1
    FROM role_inheritance ri
    JOIN inheritance_tree it ON ri.parent_role_id = it.role_id
    WHERE it.depth < 100
  ),
  all_permissions AS (
    SELECT 
      p.id AS permission_id,
      p.key AS permission_key,
      p.name AS permission_name,
      it.depth > 0 AS is_inherited,
      r.id AS source_role_id,
      r.name AS source_role_name,
      pc.condition_json
    FROM inheritance_tree it
    JOIN role_permissions rp ON rp.role_id = it.role_id
    JOIN permissions p ON p.id = rp.permission_id
    JOIN roles r ON r.id = it.role_id
    LEFT JOIN permission_conditions pc ON pc.owner_type = 'role' 
      AND pc.owner_id = it.role_id 
      AND pc.permission_id = p.id
  )
  SELECT DISTINCT ON (ap.permission_id)
    ap.permission_id,
    ap.permission_key,
    ap.permission_name,
    ap.is_inherited,
    ap.source_role_id,
    ap.source_role_name,
    ap.condition_json
  FROM all_permissions ap
  ORDER BY ap.permission_id, ap.is_inherited ASC;  -- Prefer direct over inherited
END;
$$;

-- Function to get effective permissions for a user (roles + direct permissions)
CREATE OR REPLACE FUNCTION public.get_user_effective_permissions(
  p_user_id UUID,
  p_restaurant_id UUID
)
RETURNS TABLE(
  permission_id UUID,
  permission_key TEXT,
  permission_name TEXT,
  source_type TEXT,  -- 'role', 'inherited', or 'direct'
  source_name TEXT,
  condition_json JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Get all role permissions (including inherited)
  role_perms AS (
    SELECT 
      rep.permission_id,
      rep.permission_key,
      rep.permission_name,
      CASE WHEN rep.is_inherited THEN 'inherited' ELSE 'role' END AS source_type,
      rep.source_role_name AS source_name,
      rep.condition_json
    FROM user_roles ur
    CROSS JOIN LATERAL get_role_effective_permissions(ur.role_id) rep
    WHERE ur.user_id = p_user_id AND ur.restaurant_id = p_restaurant_id
  ),
  -- Get direct user permissions
  direct_perms AS (
    SELECT 
      p.id AS permission_id,
      p.key AS permission_key,
      p.name AS permission_name,
      'direct'::TEXT AS source_type,
      'Direct Permission'::TEXT AS source_name,
      pc.condition_json
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    LEFT JOIN permission_conditions pc ON pc.owner_type = 'user' 
      AND pc.owner_id = up.id 
      AND pc.permission_id = p.id
    WHERE up.user_id = p_user_id AND up.restaurant_id = p_restaurant_id
  ),
  -- Combine all permissions
  all_perms AS (
    SELECT * FROM role_perms
    UNION ALL
    SELECT * FROM direct_perms
  )
  SELECT DISTINCT ON (ap.permission_key)
    ap.permission_id,
    ap.permission_key,
    ap.permission_name,
    ap.source_type,
    ap.source_name,
    ap.condition_json
  FROM all_perms ap
  ORDER BY ap.permission_key, 
    CASE ap.source_type 
      WHEN 'direct' THEN 1 
      WHEN 'role' THEN 2 
      ELSE 3 
    END;
END;
$$;

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_restaurant_id UUID,
  p_permission_key TEXT,
  p_context JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permission RECORD;
  v_condition JSONB;
  v_field TEXT;
  v_operator TEXT;
  v_value JSONB;
  v_context_value JSONB;
  v_result BOOLEAN := false;
BEGIN
  -- Check if user is the restaurant owner (owners have all permissions)
  IF EXISTS (
    SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Get the permission with its condition
  SELECT * INTO v_permission
  FROM get_user_effective_permissions(p_user_id, p_restaurant_id) ep
  WHERE ep.permission_key = p_permission_key
  LIMIT 1;
  
  -- Permission not found
  IF v_permission.permission_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- No condition, permission granted
  IF v_permission.condition_json IS NULL THEN
    RETURN true;
  END IF;
  
  -- Evaluate condition
  v_condition := v_permission.condition_json;
  v_field := v_condition->>'field';
  v_operator := v_condition->>'operator';
  v_value := v_condition->'value';
  
  -- Get context value using the field path
  v_context_value := p_context #> string_to_array(v_field, '.');
  
  -- Evaluate based on operator
  CASE v_operator
    WHEN '=' THEN
      v_result := v_context_value = v_value;
    WHEN '!=' THEN
      v_result := v_context_value != v_value;
    WHEN 'in' THEN
      v_result := v_value @> jsonb_build_array(v_context_value);
    WHEN 'not_in' THEN
      v_result := NOT (v_value @> jsonb_build_array(v_context_value));
    ELSE
      v_result := false;
  END CASE;
  
  RETURN v_result;
END;
$$;

-- Function to get role inheritance tree for display
CREATE OR REPLACE FUNCTION public.get_role_inheritance_tree(p_restaurant_id UUID)
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  role_type public.app_role,
  parent_role_id UUID,
  parent_role_name TEXT,
  depth INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    -- Root roles (no parent)
    SELECT 
      r.id AS role_id,
      r.name AS role_name,
      r.role_type,
      NULL::UUID AS parent_role_id,
      NULL::TEXT AS parent_role_name,
      0 AS depth
    FROM roles r
    WHERE r.restaurant_id = p_restaurant_id
      AND NOT EXISTS (
        SELECT 1 FROM role_inheritance ri WHERE ri.child_role_id = r.id
      )
    
    UNION ALL
    
    -- Child roles
    SELECT 
      r.id,
      r.name,
      r.role_type,
      t.role_id,
      t.role_name,
      t.depth + 1
    FROM roles r
    JOIN role_inheritance ri ON ri.child_role_id = r.id
    JOIN tree t ON ri.parent_role_id = t.role_id
    WHERE r.restaurant_id = p_restaurant_id AND t.depth < 100
  )
  SELECT * FROM tree ORDER BY depth, role_name;
END;
$$;

-- Trigger to prevent circular inheritance on insert
CREATE OR REPLACE FUNCTION public.check_inheritance_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.check_circular_inheritance(NEW.parent_role_id, NEW.child_role_id) THEN
    RAISE EXCEPTION 'Circular inheritance detected: adding this relationship would create a cycle';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_circular_inheritance
BEFORE INSERT OR UPDATE ON public.role_inheritance
FOR EACH ROW
EXECUTE FUNCTION public.check_inheritance_cycle();