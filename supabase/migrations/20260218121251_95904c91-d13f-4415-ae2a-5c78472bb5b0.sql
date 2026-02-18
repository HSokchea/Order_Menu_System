
-- Drop the old function first (return type changed)
DROP FUNCTION IF EXISTS public.get_shop_geo_config(uuid);

-- Recreate without geo_enabled column
CREATE OR REPLACE FUNCTION public.get_shop_geo_config(p_shop_id uuid)
 RETURNS TABLE(geo_latitude numeric, geo_longitude numeric, geo_radius_meters integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    r.geo_latitude,
    r.geo_longitude,
    COALESCE(r.geo_radius_meters, 100)
  FROM restaurants r
  WHERE r.id = p_shop_id;
$function$;

-- Update validate_customer_geo to remove geo_enabled check (mandatory geo)
CREATE OR REPLACE FUNCTION public.validate_customer_geo(p_shop_id uuid, p_user_latitude numeric, p_user_longitude numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shop_lat numeric;
  v_shop_lng numeric;
  v_radius integer;
  v_distance numeric;
  v_tolerance integer := 20;
BEGIN
  SELECT geo_latitude, geo_longitude, COALESCE(geo_radius_meters, 100)
  INTO v_shop_lat, v_shop_lng, v_radius
  FROM restaurants
  WHERE id = p_shop_id;

  -- If shop has no coordinates, block access
  IF v_shop_lat IS NULL OR v_shop_lng IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'shop_not_configured');
  END IF;

  -- Haversine formula
  v_distance := 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((p_user_latitude - v_shop_lat) / 2)), 2) +
      cos(radians(v_shop_lat)) * cos(radians(p_user_latitude)) *
      power(sin(radians((p_user_longitude - v_shop_lng) / 2)), 2)
    )
  );

  IF v_distance <= (v_radius + v_tolerance) THEN
    RETURN json_build_object('allowed', true, 'distance', round(v_distance));
  ELSE
    RETURN json_build_object(
      'allowed', false,
      'distance', round(v_distance),
      'radius', v_radius,
      'reason', 'outside_radius'
    );
  END IF;
END;
$function$;
