-- Add size_enabled column to menu_items table
ALTER TABLE public.menu_items 
ADD COLUMN size_enabled boolean NOT NULL DEFAULT false;

-- Add sizes column to store size configurations
ALTER TABLE public.menu_items 
ADD COLUMN sizes jsonb DEFAULT NULL;

COMMENT ON COLUMN public.menu_items.size_enabled IS 'If true, item uses size-based pricing. If false, uses base price.';
COMMENT ON COLUMN public.menu_items.sizes IS 'Array of size objects with label, price, and default flag. Only used when size_enabled is true.';