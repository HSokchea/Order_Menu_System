-- Add email column to profiles table
ALTER TABLE public.profiles
ADD COLUMN email text;

-- Create index for faster lookups
CREATE INDEX idx_profiles_email ON public.profiles(email);