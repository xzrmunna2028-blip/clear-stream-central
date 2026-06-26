// Manifest entry point. Resolves channel -> source URL, fetches & rewrites all
// inner URIs through /api/stream/proxy with HMAC-signed payloads. The original
// upstream URL never reaches the client.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stream/$id/playlist.m3u8")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { encodeUrl } = await import("@/lib/stream-sign.server");

        const { data, error } = await supabaseAdmin
          .from("channels")
          .select("stream_url,is_active,category")
          .eq("id", params.id)
          .maybeSingle();
        if (error || !data || !data.is_active) {
          return new Response("Channel not found", { status: 404 });
        }

        const upstream = data.stream_url;
        try {
          let usedFallback = false;
          let res = await tryFetchPlaylist(upstream);
          if (!res) {
            const fallback = await fetchFallbackPlaylist(
              supabaseAdmin,
              params.id,
              data.category ?? null,
              upstream,
            );
            if (!fallback) return upstreamErrorResponse();
            res = fallback.res;
            usedFallback = true;
          }
          const text = await res.text();
          // Use final (post-redirect) URL as base so relative segment URIs resolve correctly.
          const baseUrl = res.url || upstream;
          const rewritten = rewriteManifest(text, baseUrl, encodeUrl);
          return new Response(rewritten, {
            status: 200,
            headers: {
              "content-type": "application/vnd.apple.mpegurl",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
              "x-stream-fallback": usedFallback ? "1" : "0",
            },
          });
        } catch (e) {
          console.error("playlist route failed", e);
          return upstreamErrorResponse();
        }
      },
    },
  },
});

function upstreamErrorResponse() {
  return new Response("Upstream stream is unavailable", {
    status: 502,
    headers: { "access-control-allow-origin": "*" },
  });
}

async function tryFetchPlaylist(url: string, attempts = 3, timeoutMs = 8000): Promise<Response | null> {
  try {
    const res = await fetchUpstream(url, attempts, timeoutMs);
    return res.ok ? res : null;
  } catch (error) {
    console.warn("playlist upstream unavailable", error);
    return null;
  }
}

async function fetchFallbackPlaylist(
  supabaseAdmin: any,
  currentId: string,
  category: string | null,
  originalUrl: string,
): Promise<{ res: Response; sourceUrl: string } | null> {
  let query = supabaseAdmin
    .from("channels")
    .select("id,stream_url")
    .eq("is_active", true)
    .neq("id", currentId)
    .order("sort_order", { ascending: true })
    .limit(10);

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) {
    console.warn("fallback stream lookup failed", error.message);
    return null;
  }

  const candidates = (data ?? [])
    .map((row: { stream_url?: string | null }) => row.stream_url)
    .filter((url: string | null | undefined): url is string => !!url && url !== originalUrl);

  if (candidates.length === 0) return null;

  try {
    return await Promise.any(
      candidates.map(async (sourceUrl: string) => {
        const res = await tryFetchPlaylist(sourceUrl, 1, 3500);
        if (!res) throw new Error("fallback unavailable");
        return { res, sourceUrl };
      }),
    );
  } catch {
    return null;
  }
}

async function fetchUpstream(url: string, attempts = 3, timeoutMs = 8000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
          accept: "*/*",
        },
        redirect: "follow",
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (res.ok) return res;
      if (res.status >= 500 && i < attempts - 1) continue;
      return res;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("fetchUpstream failed");
}

function resolveUrl(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

export function rewriteManifest(
  text: string,
  baseUrl: string,
  enc: (u: string) => { u: string; s: string },
): string {
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    let line = raw;
    // Rewrite URI="..." inside tags (#EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP, etc.)
    if (line.startsWith("#") && line.includes('URI="')) {
      line = line.replace(/URI="([^"]+)"/g, (_m, u) => {
        const abs = resolveUrl(baseUrl, u);
        const { u: eu, s } = enc(abs);
        return `URI="/api/stream/proxy?u=${eu}&s=${s}"`;
      });
    }
    if (line.length > 0 && !line.startsWith("#")) {
      // segment / sub-playlist URI line
      const abs = resolveUrl(baseUrl, line.trim());
      const { u: eu, s } = enc(abs);
      line = `/api/stream/proxy?u=${eu}&s=${s}`;
    }
    out.push(line);
  }
  return out.join("\n");
}
