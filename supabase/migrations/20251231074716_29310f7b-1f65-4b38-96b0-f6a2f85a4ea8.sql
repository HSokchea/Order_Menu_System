-- Add new columns to restaurants table for shop profile
ALTER TABLE public.restaurants
ADD COLUMN phone text,
ADD COLUMN country text,
ADD COLUMN city text,
ADD COLUMN timezone text DEFAULT 'Asia/Phnom_Penh',
ADD COLUMN currency text DEFAULT 'USD',
ADD COLUMN business_type text DEFAULT 'restaurant',
ADD COLUMN cuisine_type text,
ADD COLUMN default_tax_percentage numeric DEFAULT 0,
ADD COLUMN service_charge_percentage numeric DEFAULT 0,
ADD COLUMN address text,
ADD COLUMN is_onboarded boolean DEFAULT false;