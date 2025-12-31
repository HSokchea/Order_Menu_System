-- Add logo_url column to restaurants table for shop/restaurant branding
ALTER TABLE public.restaurants
ADD COLUMN logo_url text DEFAULT NULL;