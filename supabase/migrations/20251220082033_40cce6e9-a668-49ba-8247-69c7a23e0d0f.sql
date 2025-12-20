-- Revoke all direct access to the public_restaurants view
REVOKE ALL ON public.public_restaurants FROM PUBLIC;
REVOKE ALL ON public.public_restaurants FROM anon;
REVOKE ALL ON public.public_restaurants FROM authenticated;

-- Grant SELECT only to authenticated users (view inherits RLS from underlying restaurants table)
GRANT SELECT ON public.public_restaurants TO authenticated;

-- If anonymous access is needed for public menu viewing, also grant to anon role
GRANT SELECT ON public.public_restaurants TO anon;