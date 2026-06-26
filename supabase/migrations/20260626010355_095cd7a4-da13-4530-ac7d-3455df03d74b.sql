DROP POLICY IF EXISTS "channels public read safe cols" ON public.channels;
REVOKE SELECT ON public.channels FROM anon;