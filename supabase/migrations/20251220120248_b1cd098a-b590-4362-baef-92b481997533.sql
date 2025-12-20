-- Fix search_path on update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix search_path on handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Drop the old get_order_details overload without search_path (single parameter version)
-- This is redundant since we have the version with optional p_order_token that already has search_path set
DROP FUNCTION IF EXISTS public.get_order_details(uuid);

-- Recreate get_order_details with proper signature to ensure backwards compatibility
-- The two-parameter version with default NULL already handles both cases
CREATE OR REPLACE FUNCTION public.get_order_details(p_order_id uuid, p_order_token text DEFAULT NULL::text)
RETURNS TABLE(id uuid, table_number text, table_id uuid, total_usd numeric, status text, created_at timestamp with time zone, restaurant_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- If order token is provided, validate it (for anonymous customer access)
  IF p_order_token IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.table_number,
      o.table_id,
      o.total_usd,
      o.status,
      o.created_at,
      r.name as restaurant_name
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = p_order_id AND o.order_token = p_order_token;
  -- If authenticated user is restaurant owner, allow access
  ELSIF auth.uid() IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.table_number,
      o.table_id,
      o.total_usd,
      o.status,
      o.created_at,
      r.name as restaurant_name
    FROM orders o
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE o.id = p_order_id 
    AND o.restaurant_id IN (
      SELECT rest.id FROM restaurants rest WHERE rest.owner_id = auth.uid()
    );
  ELSE
    -- No token and not authenticated - deny access
    RETURN;
  END IF;
END;
$function$;