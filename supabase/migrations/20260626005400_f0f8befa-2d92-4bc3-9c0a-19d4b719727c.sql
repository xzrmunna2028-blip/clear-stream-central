
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  logo_url TEXT,
  category TEXT NOT NULL DEFAULT 'sports',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels public read safe cols" ON public.channels FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "channels auth read" ON public.channels FOR SELECT TO authenticated USING (true);

CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  team_a TEXT,
  team_b TEXT,
  league TEXT,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches public read" ON public.matches FOR SELECT TO anon USING (true);
CREATE POLICY "matches auth read" ON public.matches FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER channels_touch BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER matches_touch BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
