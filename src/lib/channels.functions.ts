// Public channel/match read fns — exposes ONLY safe fields. Stream URL stays server-side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicChannel = {
  id: string;
  name: string;
  logo_url: string | null;
  category: string;
  sort_order: number;
};

export type PublicMatch = {
  id: string;
  title: string;
  team_a: string | null;
  team_b: string | null;
  team_a_iso: string | null;
  team_b_iso: string | null;
  league: string | null;
  channel_id: string | null;
  start_time: string;
  is_live: boolean;
};

export type PublicSource = { id: string; label: string };
export type PublicMatchStream = { id: string; label: string };
export type PublicHeroMedia = {
  id: string;
  title: string;
  video_url: string;
  poster_url: string | null;
};

export const listChannels = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicChannel[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("channels")
        .select("id,name,logo_url,category,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicChannel[];
    } catch (error) {
      console.error("[public] listChannels failed", error);
      return [];
    }
  },
);

export const listMatches = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMatch[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("matches")
        .select("id,title,team_a,team_b,team_a_iso,team_b_iso,league,channel_id,start_time,is_live")
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicMatch[];
    } catch (error) {
      console.error("[public] listMatches failed", error);
      return [];
    }
  },
);

export const listChannelSources = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicSource[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("channel_sources")
        .select("id,label")
        .eq("channel_id", data.channelId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (rows ?? []) as PublicSource[];
    } catch (error) {
      console.error("[public] listChannelSources failed", error);
      return [];
    }
  });

export const listMatchStreams = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicMatchStream[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("match_streams")
        .select("id,label")
        .eq("match_id", data.matchId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (rows ?? []) as PublicMatchStream[];
    } catch (error) {
      console.error("[public] listMatchStreams failed", error);
      return [];
    }
  });

export const listHeroMedia = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicHeroMedia[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("hero_media")
        .select("id,title,video_url,poster_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicHeroMedia[];
    } catch (error) {
      console.error("[public] listHeroMedia failed", error);
      return [];
    }
  },
);
