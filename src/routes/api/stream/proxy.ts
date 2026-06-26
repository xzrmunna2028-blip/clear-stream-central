// Signed proxy for HLS segments and nested manifests. Verifies HMAC, fetches
// the upstream resource, and streams it back. Nested manifests are recursively
// rewritten so client-visible URLs only ever point at this proxy.
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

        const upstream = await fetch(target, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
            accept: "*/*",
          },
          redirect: "follow",
        });

        if (!upstream.ok) {
          return new Response("Upstream error: " + upstream.status, {
            status: 502,
          });
        }

        const contentType =
          upstream.headers.get("content-type")?.toLowerCase() ?? "";
        const isManifest =
          contentType.includes("mpegurl") ||
          contentType.includes("application/x-mpegurl") ||
          /\.m3u8(\?|$)/i.test(target);

        if (isManifest) {
          const text = await upstream.text();
          const { rewriteManifest } = await import("./$id/playlist[.]m3u8");
          const rewritten = rewriteManifest(text, target, encodeUrl);
          return new Response(rewritten, {
            status: 200,
            headers: {
              "content-type": "application/vnd.apple.mpegurl",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        }

        // Segment / key / other binary: stream through.
        const headers = new Headers();
        const ct = upstream.headers.get("content-type");
        if (ct) headers.set("content-type", ct);
        const cl = upstream.headers.get("content-length");
        if (cl) headers.set("content-length", cl);
        headers.set("cache-control", "public, max-age=10");
        headers.set("access-control-allow-origin", "*");

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
