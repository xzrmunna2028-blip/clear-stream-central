// Admin server functions. Auth via signed cookie session.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("Server misconfigured");
    const { timingSafeEqual, createHash } = await import("node:crypto");
    const a = createHash("sha256").update(data.password).digest();
    const b = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(a, b)) return { ok: false as const };
    const { getAdminSession } = await import("./admin-session");
    const session = await getAdminSession();
    await session.update({ isAdmin: true, loginAt: Date.now() });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("./admin-session");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminSession } = await import("./admin-session");
  const session = await getAdminSession();
  return { isAdmin: !!session.data.isAdmin };
});

export type AdminChannel = {
  id: string;
  name: string;
  stream_url: string;
  logo_url: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
};

export const adminListChannels = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("channels")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminChannel[];
});

const trimmedUrl = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().url().max(2000),
);

const channelInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  stream_url: trimmedUrl,
  logo_url: trimmedUrl.nullable().optional(),
  category: z.string().min(1).max(40).default("sports"),
  sort_order: z.number().int().min(0).max(99999).default(0),
  is_active: z.boolean().default(true),
});

export const adminSaveChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => channelInput.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabaseAdmin.from("channels").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id };
    } else {
      const { id: _omit, ...rest } = data;
      const { data: row, error } = await supabaseAdmin
        .from("channels")
        .insert(rest)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true as const, id: row!.id };
    }
  });

export const adminDeleteChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("channels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListMatches = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("*")
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const matchInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  team_a: z.string().max(80).nullable().optional(),
  team_b: z.string().max(80).nullable().optional(),
  team_a_iso: z.string().max(10).nullable().optional(),
  team_b_iso: z.string().max(10).nullable().optional(),
  league: z.string().max(120).nullable().optional(),
  channel_id: z.string().uuid().nullable().optional(),
  start_time: z.string(),
  is_live: z.boolean().default(false),
});

export const adminSaveMatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => matchInput.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabaseAdmin.from("matches").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id };
    }
    const { id: _omit, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("matches")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row!.id };
  });

export const adminDeleteMatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("matches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============ CHANNEL SOURCES (multi-source: SP-1, SP-2, Server 1, etc.) ============

export type AdminSource = {
  id: string;
  channel_id: string;
  label: string;
  stream_url: string;
  sort_order: number;
  is_active: boolean;
};

export const adminListSources = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ channel_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("channel_sources")
      .select("*")
      .eq("channel_id", data.channel_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdminSource[];
  });

const sourceInput = z.object({
  id: z.string().uuid().optional(),
  channel_id: z.string().uuid(),
  label: z.string().min(1).max(40),
  stream_url: trimmedUrl,
  sort_order: z.number().int().min(0).max(99999).default(0),
  is_active: z.boolean().default(true),
});

export const adminSaveSource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sourceInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabaseAdmin.from("channel_sources").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id };
    }
    const { id: _o, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("channel_sources").insert(rest).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row!.id };
  });

export const adminDeleteSource = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("channel_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
