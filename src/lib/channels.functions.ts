// Public channel/match read fns — exposes ONLY safe fields. Stream URL stays server-side.
import { createServerFn } from "@tanstack/react-start";

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
  league: string | null;
  channel_id: string | null;
  start_time: string;
  is_live: boolean;
};

export type PublicSource = { id: string; label: string };

export const listChannels = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicChannel[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("channels")
      .select("id,name,logo_url,category,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PublicChannel[];
  },
);

export const listMatches = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMatch[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("matches")
      .select("id,title,team_a,team_b,league,channel_id,start_time,is_live")
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PublicMatch[];
  },
);

import { z } from "zod";

export const listChannelSources = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicSource[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("channel_sources")
      .select("id,label")
      .eq("channel_id", data.channelId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as PublicSource[];
  });
