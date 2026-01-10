-- Create app_role enum for role types
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'supervisor', 'cashier', 'waiter', 'kitchen', 'custom');

-- Permissions table - atomic actions
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  role_type public.app_role NOT NULL DEFAULT 'custom',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, name)
);

-- Role permissions junction
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Role inheritance (parent inherits FROM child, child permissions flow UP to parent)
CREATE TABLE public.role_inheritance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  child_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_role_id, child_role_id),
  CHECK (parent_role_id != child_role_id)
);

-- User roles junction (multi-role support)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Direct user permissions
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_id, restaurant_id)
);

-- Permission conditions (ABAC layer)
CREATE TABLE public.permission_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('role', 'user')),
  owner_id UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  condition_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, permission_id)
);

-- Enable RLS on all tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_inheritance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_conditions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user owns a restaurant
CREATE OR REPLACE FUNCTION public.user_owns_restaurant(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = _restaurant_id AND owner_id = _user_id
  )
$$;

-- Security definer function to get user's restaurant
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM restaurants WHERE owner_id = _user_id LIMIT 1
$$;

-- RLS Policies

-- Permissions: readable by all authenticated users
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions FOR SELECT TO authenticated
USING (true);

-- Roles: restaurant owners can manage their roles
CREATE POLICY "Restaurant owners can view their roles"
ON public.roles FOR SELECT TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant owners can create roles"
ON public.roles FOR INSERT TO authenticated
WITH CHECK (public.user_owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant owners can update their roles"
ON public.roles FOR UPDATE TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant owners can delete their roles"
ON public.roles FOR DELETE TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id) AND is_system_role = false);

-- Role permissions: follow role access
CREATE POLICY "Users can view role permissions for their restaurant"
ON public.role_permissions FOR SELECT TO authenticated
USING (role_id IN (SELECT id FROM roles WHERE public.user_owns_restaurant(auth.uid(), restaurant_id)));

CREATE POLICY "Restaurant owners can manage role permissions"
ON public.role_permissions FOR ALL TO authenticated
USING (role_id IN (SELECT id FROM roles WHERE public.user_owns_restaurant(auth.uid(), restaurant_id)));

-- Role inheritance: follow role access
CREATE POLICY "Users can view role inheritance for their restaurant"
ON public.role_inheritance FOR SELECT TO authenticated
USING (parent_role_id IN (SELECT id FROM roles WHERE public.user_owns_restaurant(auth.uid(), restaurant_id)));

CREATE POLICY "Restaurant owners can manage role inheritance"
ON public.role_inheritance FOR ALL TO authenticated
USING (parent_role_id IN (SELECT id FROM roles WHERE public.user_owns_restaurant(auth.uid(), restaurant_id)));

-- User roles: restaurant owners manage, users can see their own
CREATE POLICY "Restaurant owners can view user roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id) OR user_id = auth.uid());

CREATE POLICY "Restaurant owners can manage user roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id));

-- User permissions: restaurant owners manage, users can see their own
CREATE POLICY "Users can view user permissions"
ON public.user_permissions FOR SELECT TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id) OR user_id = auth.uid());

CREATE POLICY "Restaurant owners can manage user permissions"
ON public.user_permissions FOR ALL TO authenticated
USING (public.user_owns_restaurant(auth.uid(), restaurant_id));

-- Permission conditions: follow owner access
CREATE POLICY "Users can view permission conditions"
ON public.permission_conditions FOR SELECT TO authenticated
USING (
  (owner_type = 'role' AND owner_id IN (SELECT id FROM roles WHERE public.user_owns_restaurant(auth.uid(), restaurant_id)))
  OR 
  (owner_type = 'user' AND (owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_permissions up WHERE up.id = owner_id AND public.user_owns_restaurant(auth.uid(), up.restaurant_id)
  )))
);

CREATE POLICY "Restaurant owners can manage permission conditions"
ON public.permission_conditions FOR ALL TO authenticated
USING (
  (owner_type = 'role' AND owner_id IN (SELECT id FROM roles WHERE public.user_owns_restaurant(auth.uid(), restaurant_id)))
);

-- Indexes for performance
CREATE INDEX idx_roles_restaurant ON public.roles(restaurant_id);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id);
CREATE INDEX idx_role_inheritance_parent ON public.role_inheritance(parent_role_id);
CREATE INDEX idx_role_inheritance_child ON public.role_inheritance(child_role_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX idx_user_roles_restaurant ON public.user_roles(restaurant_id);
CREATE INDEX idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_restaurant ON public.user_permissions(restaurant_id);
CREATE INDEX idx_permission_conditions_owner ON public.permission_conditions(owner_type, owner_id);

-- Insert default permissions
INSERT INTO public.permissions (key, name, description, resource, action, scope) VALUES
-- Orders
('orders.view', 'View Orders', 'View all orders', 'orders', 'view', NULL),
('orders.view.own', 'View Own Orders', 'View orders assigned to user', 'orders', 'view', 'own'),
('orders.create', 'Create Orders', 'Create new orders', 'orders', 'create', NULL),
('orders.update', 'Update Orders', 'Update order details', 'orders', 'update', NULL),
('orders.update.status', 'Update Order Status', 'Change order status', 'orders', 'update', 'status'),
('orders.delete', 'Delete Orders', 'Delete orders', 'orders', 'delete', NULL),
-- Menu
('menu.view', 'View Menu', 'View menu items and categories', 'menu', 'view', NULL),
('menu.manage', 'Manage Menu', 'Add, edit, delete menu items', 'menu', 'manage', NULL),
('menu.categories.manage', 'Manage Categories', 'Add, edit, delete categories', 'menu', 'categories', 'manage'),
-- Tables
('tables.view', 'View Tables', 'View table list', 'tables', 'view', NULL),
('tables.manage', 'Manage Tables', 'Add, edit, delete tables', 'tables', 'manage', NULL),
('tables.sessions.view', 'View Table Sessions', 'View active sessions', 'tables', 'sessions', 'view'),
('tables.sessions.manage', 'Manage Table Sessions', 'Close sessions, process payments', 'tables', 'sessions', 'manage'),
-- Billing
('billing.view', 'View Billing', 'View bills and payments', 'billing', 'view', NULL),
('billing.collect', 'Collect Payment', 'Process payments', 'billing', 'collect', NULL),
('billing.refund', 'Process Refunds', 'Issue refunds', 'billing', 'refund', NULL),
-- Reports
('reports.view', 'View Reports', 'View analytics and reports', 'reports', 'view', NULL),
('reports.export', 'Export Reports', 'Export data to files', 'reports', 'export', NULL),
-- Users & Roles
('users.view', 'View Users', 'View staff members', 'users', 'view', NULL),
('users.manage', 'Manage Users', 'Add, edit, remove staff', 'users', 'manage', NULL),
('users.assign_roles', 'Assign Roles', 'Assign roles to users', 'users', 'assign_roles', NULL),
('roles.view', 'View Roles', 'View role definitions', 'roles', 'view', NULL),
('roles.manage', 'Manage Roles', 'Create, edit roles and permissions', 'roles', 'manage', NULL),
-- Settings
('settings.view', 'View Settings', 'View restaurant settings', 'settings', 'view', NULL),
('settings.manage', 'Manage Settings', 'Edit restaurant settings', 'settings', 'manage', NULL),
-- QR Codes
('qr.view', 'View QR Codes', 'View QR codes', 'qr', 'view', NULL),
('qr.manage', 'Manage QR Codes', 'Generate and manage QR codes', 'qr', 'manage', NULL);

-- Trigger for updated_at
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permission_conditions_updated_at
BEFORE UPDATE ON public.permission_conditions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();