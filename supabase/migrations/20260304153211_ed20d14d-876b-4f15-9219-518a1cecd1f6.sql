
CREATE OR REPLACE FUNCTION public.get_device_active_order(p_shop_id uuid, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_shop RECORD;
BEGIN
  SELECT * INTO v_order
  FROM tb_order_temporary
  WHERE shop_id = p_shop_id
    AND device_id = p_device_id
    AND DATE(order_date) = CURRENT_DATE
    AND status IN ('pending', 'placed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active order found');
  END IF;

  SELECT name, currency, logo_url, address, city, country, phone, vat_tin,
         COALESCE(default_tax_percentage, 0) AS default_tax_percentage,
         COALESCE(service_charge_percentage, 0) AS service_charge_percentage,
         COALESCE(exchange_rate_usd_to_khr, 4100) AS exchange_rate_usd_to_khr,
         receipt_header_text, receipt_footer_text
  INTO v_shop
  FROM restaurants
  WHERE id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'shop_id', v_order.shop_id,
      'device_id', v_order.device_id,
      'status', v_order.status,
      'total_usd', v_order.total_usd,
      'customer_notes', v_order.customer_notes,
      'items', v_order.items,
      'order_type', v_order.order_type,
      'table_id', v_order.table_id,
      'table_number', (SELECT table_number FROM tables WHERE id = v_order.table_id),
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    ),
    'shop', jsonb_build_object(
      'name', v_shop.name,
      'currency', COALESCE(v_shop.currency, 'USD'),
      'logo_url', v_shop.logo_url,
      'address', v_shop.address,
      'city', v_shop.city,
      'country', v_shop.country,
      'phone', v_shop.phone,
      'vat_tin', v_shop.vat_tin,
      'default_tax_percentage', v_shop.default_tax_percentage,
      'service_charge_percentage', v_shop.service_charge_percentage,
      'exchange_rate_usd_to_khr', v_shop.exchange_rate_usd_to_khr,
      'receipt_header_text', v_shop.receipt_header_text,
      'receipt_footer_text', v_shop.receipt_footer_text
    )
  );
END;
$function$;
