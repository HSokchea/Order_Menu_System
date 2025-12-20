-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Revoke all public access to the profiles table
REVOKE ALL ON public.profiles FROM PUBLIC;

-- The existing "Users can view their own profile" policy already covers SELECT
-- No need to create a duplicate policy