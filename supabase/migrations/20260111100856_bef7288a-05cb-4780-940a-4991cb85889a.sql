-- Add missing permissions that are used in frontend
INSERT INTO permissions (key, name, description, resource, action)
VALUES 
  ('dashboard.view', 'View Dashboard', 'Access to view main dashboard', 'dashboard', 'view'),
  ('orders.manage', 'Manage Orders', 'Full control over orders', 'orders', 'manage'),
  ('users.view', 'View Users', 'View staff list', 'users', 'view'),
  ('users.manage', 'Manage Users', 'Add, edit, delete users', 'users', 'manage')
ON CONFLICT (key) DO NOTHING;

-- Create a function to get default permissions for a role type
-- This is used when creating roles to auto-assign permissions
CREATE OR REPLACE FUNCTION public.get_default_role_permissions(p_role_type app_role)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permission_ids uuid[];
  v_permission_keys text[];
BEGIN
  -- Define default permissions for each role type
  CASE p_role_type
    WHEN 'owner' THEN
      -- Owners get all permissions via isOwner check, not via role_permissions
      v_permission_keys := ARRAY[]::text[];
    WHEN 'admin' THEN
      -- Admins get almost all permissions
      SELECT array_agg(id) INTO v_permission_ids FROM permissions;
      RETURN COALESCE(v_permission_ids, ARRAY[]::uuid[]);
    WHEN 'manager' THEN
      v_permission_keys := ARRAY[
        'dashboard.view', 'menu.view', 'menu.manage', 'menu.categories.manage',
        'orders.view', 'orders.manage', 'orders.update.status',
        'billing.view', 'billing.collect',
        'reports.view', 'reports.export',
        'tables.view', 'tables.manage', 'tables.sessions.view', 'tables.sessions.manage',
        'qr.view', 'qr.manage',
        'users.view'
      ];
    WHEN 'supervisor' THEN
      v_permission_keys := ARRAY[
        'dashboard.view', 'menu.view',
        'orders.view', 'orders.update.status',
        'billing.view',
        'tables.view', 'tables.sessions.view',
        'qr.view'
      ];
    WHEN 'cashier' THEN
      v_permission_keys := ARRAY[
        'orders.view',
        'billing.view', 'billing.collect',
        'tables.view', 'tables.sessions.view', 'tables.sessions.manage'
      ];
    WHEN 'waiter' THEN
      v_permission_keys := ARRAY[
        'menu.view',
        'orders.view', 'orders.create',
        'tables.view', 'tables.sessions.view'
      ];
    WHEN 'kitchen' THEN
      v_permission_keys := ARRAY[
        'orders.view', 'orders.update.status'
      ];
    ELSE
      -- Custom roles start with no permissions
      v_permission_keys := ARRAY[]::text[];
  END CASE;

  -- Convert permission keys to IDs
  SELECT array_agg(id) INTO v_permission_ids 
  FROM permissions 
  WHERE key = ANY(v_permission_keys);

  RETURN COALESCE(v_permission_ids, ARRAY[]::uuid[]);
END;
$$;

-- Create a function to assign default permissions to a role
CREATE OR REPLACE FUNCTION public.assign_default_role_permissions(p_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_type app_role;
  v_permission_ids uuid[];
  v_permission_id uuid;
BEGIN
  -- Get the role type
  SELECT role_type INTO v_role_type FROM roles WHERE id = p_role_id;
  
  IF v_role_type IS NULL THEN
    RAISE EXCEPTION 'Role not found: %', p_role_id;
  END IF;
  
  -- Get default permissions for this role type
  v_permission_ids := public.get_default_role_permissions(v_role_type);
  
  -- Insert permissions (ignore duplicates)
  FOREACH v_permission_id IN ARRAY v_permission_ids
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (p_role_id, v_permission_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Create trigger to auto-assign default permissions when a role is created
CREATE OR REPLACE FUNCTION public.trigger_assign_default_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-assign for system roles (not custom)
  IF NEW.role_type != 'custom' THEN
    PERFORM public.assign_default_role_permissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_role_created ON roles;

-- Create trigger
CREATE TRIGGER on_role_created
  AFTER INSERT ON roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_assign_default_permissions();

-- Add unique constraint on role_permissions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_id_permission_id_key'
  ) THEN
    ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);
  END IF;
END $$;

-- Now populate existing roles that are missing permissions
DO $$
DECLARE
  v_role RECORD;
BEGIN
  FOR v_role IN SELECT id, name, role_type FROM roles WHERE role_type != 'owner'
  LOOP
    -- Check if role has any permissions
    IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = v_role.id) THEN
      RAISE NOTICE 'Assigning default permissions to role: %', v_role.name;
      PERFORM public.assign_default_role_permissions(v_role.id);
    END IF;
  END LOOP;
END $$;