-- Add missing vat_tin column to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS vat_tin text;

-- Add missing default_order_type column to restaurants table
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS default_order_type text DEFAULT 'dine_in';