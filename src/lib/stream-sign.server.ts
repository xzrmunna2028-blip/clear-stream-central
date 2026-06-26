// HMAC signing for stream proxy URLs — hides the original URL from the client.
import { createHmac, timingSafeEqual } from "node:crypto";

function key() {
  const k = process.env.STREAM_PROXY_KEY;
  if (!k) throw new Error("STREAM_PROXY_KEY missing");
  return k;
}

export function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function verify(payload: string, sig: string): boolean {
  try {
    const expected = sign(payload);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function encodeUrl(url: string): { u: string; s: string } {
  const u = Buffer.from(url, "utf8").toString("base64url");
  return { u, s: sign(u) };
}

export function decodeUrl(u: string, s: string): string | null {
  if (!verify(u, s)) return null;
  try {
    return Buffer.from(u, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
