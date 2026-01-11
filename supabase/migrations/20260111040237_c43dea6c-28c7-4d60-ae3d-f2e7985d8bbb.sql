-- Add must_change_password flag to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password 
ON public.profiles(must_change_password) 
WHERE must_change_password = true;