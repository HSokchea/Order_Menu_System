-- Fix the trigger function to have search_path set
CREATE OR REPLACE FUNCTION public.check_inheritance_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.check_circular_inheritance(NEW.parent_role_id, NEW.child_role_id) THEN
    RAISE EXCEPTION 'Circular inheritance detected: adding this relationship would create a cycle';
  END IF;
  RETURN NEW;
END;
$$;