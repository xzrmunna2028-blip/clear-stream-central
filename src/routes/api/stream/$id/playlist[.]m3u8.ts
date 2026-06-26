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
          .select("stream_url,is_active")
          .eq("id", params.id)
          .maybeSingle();
        if (error || !data || !data.is_active) {
          return new Response("Channel not found", { status: 404 });
        }

        const upstream = data.stream_url;
        try {
          const res = await fetchUpstream(upstream);
          if (!res.ok) {
            return new Response("Upstream error", {
              status: 502,
              headers: { "access-control-allow-origin": "*" },
            });
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
            },
          });
        } catch (e) {
          console.error("playlist fetch failed", e);
          return new Response("Upstream error", {
            status: 502,
            headers: { "access-control-allow-origin": "*" },
          });
        }
      },
    },
  },
});

async function fetchUpstream(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
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
