
-- Add geo restriction columns to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS geo_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS geo_latitude numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geo_longitude numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geo_radius_meters integer DEFAULT 100;

-- RPC: Get shop geo config (public, no auth needed)
CREATE OR REPLACE FUNCTION public.get_shop_geo_config(p_shop_id uuid)
RETURNS TABLE (
  geo_enabled boolean,
  geo_latitude numeric,
  geo_longitude numeric,
  geo_radius_meters integer
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(r.geo_enabled, false),
    r.geo_latitude,
    r.geo_longitude,
    COALESCE(r.geo_radius_meters, 100)
  FROM restaurants r
  WHERE r.id = p_shop_id;
$$;

-- RPC: Validate customer geo location (backend Haversine check)
CREATE OR REPLACE FUNCTION public.validate_customer_geo(
  p_shop_id uuid,
  p_user_latitude numeric,
  p_user_longitude numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_geo_enabled boolean;
  v_shop_lat numeric;
  v_shop_lng numeric;
  v_radius integer;
  v_distance numeric;
  v_tolerance integer := 20;
BEGIN
  -- Fetch shop geo config
  SELECT geo_enabled, geo_latitude, geo_longitude, COALESCE(geo_radius_meters, 100)
  INTO v_geo_enabled, v_shop_lat, v_shop_lng, v_radius
  FROM restaurants
  WHERE id = p_shop_id;

  -- If geo not enabled, allow
  IF NOT COALESCE(v_geo_enabled, false) THEN
    RETURN json_build_object('allowed', true, 'geo_enabled', false);
  END IF;

  -- If shop has no coordinates set, allow (misconfigured)
  IF v_shop_lat IS NULL OR v_shop_lng IS NULL THEN
    RETURN json_build_object('allowed', true, 'geo_enabled', true, 'reason', 'shop_not_configured');
  END IF;

  -- Haversine formula (distance in meters)
  v_distance := 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((p_user_latitude - v_shop_lat) / 2)), 2) +
      cos(radians(v_shop_lat)) * cos(radians(p_user_latitude)) *
      power(sin(radians((p_user_longitude - v_shop_lng) / 2)), 2)
    )
  );

  IF v_distance <= (v_radius + v_tolerance) THEN
    RETURN json_build_object('allowed', true, 'geo_enabled', true, 'distance', round(v_distance));
  ELSE
    RETURN json_build_object(
      'allowed', false,
      'geo_enabled', true,
      'distance', round(v_distance),
      'radius', v_radius,
      'reason', 'outside_radius'
    );
  END IF;
END;
$$;
