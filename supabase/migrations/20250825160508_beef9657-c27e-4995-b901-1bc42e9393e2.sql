-- Add new columns to menu_categories table for enhanced category management
ALTER TABLE public.menu_categories 
ADD COLUMN description text,
ADD COLUMN status text DEFAULT 'active',
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_menu_categories_updated_at
    BEFORE UPDATE ON public.menu_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();