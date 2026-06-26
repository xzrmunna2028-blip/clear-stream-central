CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.channel_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  label text NOT NULL,
  stream_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.channel_sources TO authenticated;
GRANT ALL ON public.channel_sources TO service_role;

ALTER TABLE public.channel_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_sources auth read meta"
  ON public.channel_sources FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_channel_sources_channel ON public.channel_sources(channel_id, sort_order);

CREATE TRIGGER trg_channel_sources_updated
  BEFORE UPDATE ON public.channel_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.channel_sources (channel_id, label, stream_url, sort_order)
SELECT id, 'SP-1', stream_url, 0 FROM public.channels;