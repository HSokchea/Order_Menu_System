-- Add options column to menu_items table for storing customization options (size, sweetness, toppings, etc.)
ALTER TABLE public.menu_items 
ADD COLUMN options jsonb DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.menu_items.options IS 'JSON structure for item options: { options: [{ name: string, required: boolean, type: "single"|"multiple", values: [{ label: string, price: number, default?: boolean }] }] }';