// Site-wide settings (maintenance mode toggle) — public read, admin write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SiteSettings = {
  maintenance_mode: boolean;
  maintenance_message: string;
};

export const getSiteSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("maintenance_mode,maintenance_message")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      maintenance_mode: !!data?.maintenance_mode,
      maintenance_message: data?.maintenance_message ?? "",
    };
  },
);

const updateSchema = z.object({
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().max(300),
});

export const adminUpdateSiteSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data }): Promise<SiteSettings> => {
    const { requireAdmin } = await import("./admin-session");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("site_settings")
      .update({
        maintenance_mode: data.maintenance_mode,
        maintenance_message: data.maintenance_message,
      })
      .eq("id", true)
      .select("maintenance_mode,maintenance_message")
      .single();
    if (error) throw new Error(error.message);
    return {
      maintenance_mode: !!row.maintenance_mode,
      maintenance_message: row.maintenance_message,
    };
  });
