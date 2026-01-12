-- Fix: handle_new_user should NOT create restaurants for staff users
-- Staff users are created via edge function with is_staff = true in metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_staff boolean;
  v_restaurant_id uuid;
  v_restaurant_name text;
BEGIN
  -- Check if this is a staff user (created via edge function)
  v_is_staff := COALESCE((NEW.raw_user_meta_data->>'is_staff')::boolean, false);
  v_restaurant_id := (NEW.raw_user_meta_data->>'restaurant_id')::uuid;
  
  IF v_is_staff = true THEN
    -- STAFF USER: Do NOT create restaurant, only create profile if not exists
    -- Profile should already be created by edge function, but handle edge case
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
      INSERT INTO public.profiles (user_id, full_name, restaurant_id, must_change_password, role, status)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        v_restaurant_id,
        true, -- Staff must change password
        'staff', -- Default role for staff
        'active'
      );
    END IF;
    
    -- IMPORTANT: Do NOT create restaurant for staff users
    RETURN NEW;
  END IF;
  
  -- OWNER SIGNUP: Create restaurant and profile
  v_restaurant_name := COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant');
  
  -- Create restaurant record (only for owner signups)
  INSERT INTO public.restaurants (owner_id, name, is_onboarded)
  VALUES (NEW.id, v_restaurant_name, false)
  ON CONFLICT DO NOTHING; -- Prevent duplicate restaurants
  
  -- Get the restaurant ID
  SELECT id INTO v_restaurant_id 
  FROM public.restaurants 
  WHERE owner_id = NEW.id 
  LIMIT 1;
  
  -- Create profile record for owner
  INSERT INTO public.profiles (user_id, full_name, restaurant_id, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_restaurant_id,
    'owner', -- Owner role
    'active'
  )
  ON CONFLICT DO NOTHING; -- Prevent duplicate profiles
  
  RETURN NEW;
END;
$function$;

-- Create a trigger function to prevent duplicate owner roles per restaurant
CREATE OR REPLACE FUNCTION public.prevent_duplicate_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role_type text;
  v_existing_owner_count int;
BEGIN
  -- Get the role type being assigned
  SELECT role_type::text INTO v_role_type
  FROM public.roles
  WHERE id = NEW.role_id;
  
  -- If assigning owner role, check if one already exists
  IF v_role_type = 'owner' THEN
    SELECT COUNT(*) INTO v_existing_owner_count
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.restaurant_id = NEW.restaurant_id
      AND r.role_type = 'owner'
      AND ur.id IS DISTINCT FROM NEW.id;
    
    IF v_existing_owner_count > 0 THEN
      RAISE EXCEPTION 'Restaurant already has an owner. Only one owner is allowed per restaurant.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to prevent duplicate owners
DROP TRIGGER IF EXISTS prevent_duplicate_owner ON public.user_roles;
CREATE TRIGGER prevent_duplicate_owner
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_owner_role();