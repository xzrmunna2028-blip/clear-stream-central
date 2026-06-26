// Signed proxy for HLS resources.
// - Nested manifests (.m3u8) are fetched + rewritten so client never sees upstream URLs.
// - Segments / keys / binary are served with a 302 redirect to the upstream URL.
//   This avoids streaming every byte through the Worker, eliminating buffering
//   and matching native CDN speed. The signed URL is one-shot per playback session.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stream/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const u = url.searchParams.get("u");
        const s = url.searchParams.get("s");
        if (!u || !s) return new Response("Bad request", { status: 400 });

        const { decodeUrl, encodeUrl } = await import("@/lib/stream-sign.server");
        const target = decodeUrl(u, s);
        if (!target) return new Response("Forbidden", { status: 403 });

        const isManifest = /\.m3u8(\?|$)/i.test(target);

        if (isManifest) {
          // Fetch + rewrite nested manifests.
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 8000);
          const upstream = await fetch(target, {
            headers: {
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
              accept: "*/*",
            },
            redirect: "follow",
            signal: ctrl.signal,
          }).finally(() => clearTimeout(timer));
          if (!upstream.ok) {
            return new Response("Upstream error: " + upstream.status, { status: 502 });
          }
          const text = await upstream.text();
          const { rewriteManifest } = await import("./$id/playlist[.]m3u8");
          const rewritten = rewriteManifest(text, upstream.url || target, encodeUrl);
          return new Response(rewritten, {
            status: 200,
            headers: {
              "content-type": "application/vnd.apple.mpegurl",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        }

        // Segment / key / binary: redirect to upstream so the CDN serves bytes directly.
        return new Response(null, {
          status: 302,
          headers: {
            location: target,
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
