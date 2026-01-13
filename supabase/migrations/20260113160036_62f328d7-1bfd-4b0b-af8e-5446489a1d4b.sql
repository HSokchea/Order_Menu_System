-- Add UNIQUE constraint on user_id to ensure one profile per auth user
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT profiles_user_id_unique ON public.profiles IS 'Ensures one user can only belong to one shop (one-user-one-shop rule)';