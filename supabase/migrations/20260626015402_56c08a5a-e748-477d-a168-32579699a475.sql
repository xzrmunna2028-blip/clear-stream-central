CREATE TABLE public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'We are updating the site. Please wait a moment...',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings public read"
  ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER trg_site_settings_updated
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (id) VALUES (true);