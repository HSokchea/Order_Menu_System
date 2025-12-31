-- Add new settings fields to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS receipt_header_text text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS receipt_footer_text text DEFAULT 'Thank you for dining with us!',
ADD COLUMN IF NOT EXISTS show_tax_on_receipt boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_service_charge_on_receipt boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_multiple_orders_per_table boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_close_session_after_payment boolean DEFAULT true;