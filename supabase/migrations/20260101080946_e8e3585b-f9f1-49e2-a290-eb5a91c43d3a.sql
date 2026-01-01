-- Update complete_session_payment to accept cashier name and generate invoice
CREATE OR REPLACE FUNCTION public.complete_session_payment(p_session_id uuid, p_cashier_name text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total NUMERIC;
  v_session_status TEXT;
  v_invoice_number TEXT;
  v_restaurant_id UUID;
BEGIN
  -- Check session exists and is open
  SELECT status, restaurant_id INTO v_session_status, v_restaurant_id
  FROM table_sessions
  WHERE id = p_session_id;
  
  IF v_session_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  IF v_session_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session already paid');
  END IF;
  
  -- Generate unique invoice number (format: INV-YYYYMMDD-XXXX)
  v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || 
    LPAD(((random() * 9999)::int)::text, 4, '0');
  
  -- Calculate total from all orders in session
  SELECT COALESCE(SUM(total_usd), 0) INTO v_total
  FROM orders
  WHERE table_session_id = p_session_id
    AND status != 'rejected';
  
  -- Update all orders in session to completed
  UPDATE orders
  SET status = 'completed', updated_at = now()
  WHERE table_session_id = p_session_id
    AND status != 'rejected';
  
  -- Close the session with invoice details
  UPDATE table_sessions
  SET status = 'paid',
      ended_at = now(),
      total_amount = v_total,
      invoice_number = v_invoice_number,
      cashier_name = p_cashier_name,
      updated_at = now()
  WHERE id = p_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_amount', v_total,
    'session_id', p_session_id,
    'invoice_number', v_invoice_number,
    'cashier_name', p_cashier_name
  );
END;
$function$;