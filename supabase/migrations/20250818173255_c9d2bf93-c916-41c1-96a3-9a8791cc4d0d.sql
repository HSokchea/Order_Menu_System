-- Update the get_order_details function to include table_id
CREATE OR REPLACE FUNCTION get_order_details(p_order_id uuid)
RETURNS TABLE (
    id uuid,
    table_number text,
    table_id uuid,
    total_usd numeric,
    status text,
    created_at timestamptz,
    restaurant_name text
) AS $$
BEGIN
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
    WHERE o.id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;