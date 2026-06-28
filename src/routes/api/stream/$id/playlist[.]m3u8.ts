// Manifest entry point. Resolves channel -> source URL, fetches & rewrites all
// inner URIs through /api/stream/proxy with HMAC-signed payloads. The original
// upstream URL never reaches the client.
//
// IMPORTANT: We do NOT silently fall back to another channel's stream. If the
// requested channel's upstream is offline, we return a clear 502 so the player
// can tell the user. (Silent fallback was the cause of "every new channel plays
// T-Sport".)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stream/$id/playlist.m3u8")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { encodeUrl } = await import("@/lib/stream-sign.server");

        const url = new URL(request.url);
        const sourceId = url.searchParams.get("source");
        const matchStreamId = url.searchParams.get("match_stream");

        // Resolve upstream URL based on the requested resource.
        let upstream: string | null = null;

        if (matchStreamId) {
          // Match-stream playback path: id segment is the match id.
          const { data: ms } = await supabaseAdmin
            .from("match_streams")
            .select("stream_url,is_active,match_id")
            .eq("id", matchStreamId)
            .eq("match_id", params.id)
            .maybeSingle();
          if (!ms || !ms.is_active) return new Response("Stream not found", { status: 404 });
          upstream = ms.stream_url;
        } else {
          const { data, error } = await supabaseAdmin
            .from("channels")
            .select("stream_url,is_active")
            .eq("id", params.id)
            .maybeSingle();
          if (error || !data || !data.is_active) {
            return new Response("Channel not found", { status: 404 });
          }
          upstream = data.stream_url;
          if (sourceId) {
            const { data: src } = await supabaseAdmin
              .from("channel_sources")
              .select("stream_url,is_active")
              .eq("id", sourceId)
              .eq("channel_id", params.id)
              .maybeSingle();
            if (src && src.is_active) upstream = src.stream_url;
          }
        }

        if (!upstream) return new Response("Stream not configured", { status: 404 });
        // Tolerate accidental whitespace in pasted URLs.
        upstream = upstream.trim();

        try {
          const res = await tryFetchPlaylist(upstream, 2, 6000);
          if (!res) return upstreamErrorResponse();
          const text = await res.text();
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

async function tryFetchPlaylist(url: string, attempts = 2, timeoutMs = 6000): Promise<Response | null> {
  try {
    const res = await fetchUpstream(url, attempts, timeoutMs);
    return res.ok ? res : null;
  } catch (error) {
    console.warn("playlist upstream unavailable", error);
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
    if (line.startsWith("#") && line.includes('URI="')) {
      line = line.replace(/URI="([^"]+)"/g, (_m, u) => {
        const abs = resolveUrl(baseUrl, u);
        const { u: eu, s } = enc(abs);
        return `URI="/api/stream/proxy?u=${eu}&s=${s}"`;
      });
    }
    if (line.length > 0 && !line.startsWith("#")) {
      const abs = resolveUrl(baseUrl, line.trim());
      const { u: eu, s } = enc(abs);
      line = `/api/stream/proxy?u=${eu}&s=${s}`;
    }
    out.push(line);
  }
  return out.join("\n");
}
