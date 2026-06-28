-- match_streams: unlimited M3U/HLS URLs per match (SP-1, SP-2, etc.)
CREATE TABLE public.match_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'SP-1',
  stream_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_streams TO authenticated;
GRANT ALL ON public.match_streams TO service_role;
ALTER TABLE public.match_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_streams auth read meta" ON public.match_streams FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_match_streams_match ON public.match_streams(match_id, sort_order);
CREATE TRIGGER trg_match_streams_updated BEFORE UPDATE ON public.match_streams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- hero_media: "Coming Soon" videos shown when no match is live
CREATE TABLE public.hero_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Coming Soon',
  video_url text NOT NULL,
  poster_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hero_media TO anon, authenticated;
GRANT ALL ON public.hero_media TO service_role;
ALTER TABLE public.hero_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_media public read" ON public.hero_media FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE TRIGGER trg_hero_media_updated BEFORE UPDATE ON public.hero_media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add country ISO columns to matches for auto-flag rendering
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team_a_iso text,
  ADD COLUMN IF NOT EXISTS team_b_iso text;