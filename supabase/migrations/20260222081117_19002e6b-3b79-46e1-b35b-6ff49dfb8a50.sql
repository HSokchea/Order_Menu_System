
-- Add allowed_public_ips column to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS allowed_public_ips text DEFAULT NULL;

-- Create RPC to get shop's allowed IPs (for edge functions)
CREATE OR REPLACE FUNCTION public.get_shop_allowed_ips(p_shop_id uuid)
RETURNS TABLE(allowed_public_ips text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.allowed_public_ips
  FROM restaurants r
  WHERE r.id = p_shop_id;
$$;
