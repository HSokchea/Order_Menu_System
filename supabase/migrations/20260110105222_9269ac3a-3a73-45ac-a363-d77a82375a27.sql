-- Add status column to profiles for staff management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive'));

-- Create index for faster queries by status
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Create index for restaurant_id + status combination
CREATE INDEX IF NOT EXISTS idx_profiles_restaurant_status ON public.profiles(restaurant_id, status);