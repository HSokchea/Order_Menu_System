-- Add missing columns to table_sessions
ALTER TABLE public.table_sessions
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'dine_in',
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS cashier_name text,
ADD COLUMN IF NOT EXISTS is_invoice_locked boolean DEFAULT false;