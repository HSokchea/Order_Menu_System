-- Drop and recreate get_session_details function to include logo_url
DROP FUNCTION IF EXISTS public.get_session_details(uuid);

CREATE FUNCTION public.get_session_details(p_session_id uuid)
 RETURNS TABLE(session_id uuid, table_id uuid, table_number text, restaurant_id uuid, restaurant_name text, restaurant_phone text, restaurant_address text, restaurant_city text, restaurant_country text, restaurant_logo_url text, default_tax_percentage numeric, service_charge_percentage numeric, currency text, status text, started_at timestamp with time zone, ended_at timestamp with time zone, total_amount numeric, orders jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ts.id as session_id,
    ts.table_id,
    t.table_number,
    ts.restaurant_id,
    r.name as restaurant_name,
    r.phone as restaurant_phone,
    r.address as restaurant_address,
    r.city as restaurant_city,
    r.country as restaurant_country,
    r.logo_url as restaurant_logo_url,
    COALESCE(r.default_tax_percentage, 0) as default_tax_percentage,
    COALESCE(r.service_charge_percentage, 0) as service_charge_percentage,
    COALESCE(r.currency, 'USD') as currency,
    ts.status,
    ts.started_at,
    ts.ended_at,
    ts.total_amount,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'total_usd', o.total_usd,
          'status', o.status,
          'created_at', o.created_at,
          'customer_notes', o.customer_notes,
          'items', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', oi.id,
                'quantity', oi.quantity,
                'price_usd', oi.price_usd,
                'notes', oi.notes,
                'menu_item_name', mi.name
              )
            )
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = o.id
          )
        ) ORDER BY o.created_at
      )
      FROM orders o
      WHERE o.table_session_id = ts.id
      ), '[]'::jsonb
    ) as orders
  FROM table_sessions ts
  JOIN tables t ON ts.table_id = t.id
  JOIN restaurants r ON ts.restaurant_id = r.id
  WHERE ts.id = p_session_id;
END;
$function$;