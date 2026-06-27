// FIFA World Cup 2026 fixtures via API-Football (api-sports.io).
// League id 1 = FIFA World Cup. Cached briefly in-memory to limit upstream calls.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WCTeam = { id: number; name: string; logo: string | null; winner: boolean | null };
export type WCFixture = {
  id: number;
  date: string;
  status: string;        // NS, 1H, HT, 2H, ET, P, FT, AET, PEN, PST, CANC, ABD, SUSP, INT, LIVE
  statusShort: string;
  elapsed: number | null;
  venue: string | null;
  city: string | null;
  round: string | null;
  home: WCTeam;
  away: WCTeam;
  goalsHome: number | null;
  goalsAway: number | null;
};

type CacheEntry = { at: number; data: WCFixture[] };
let cache: CacheEntry | null = null;
const TTL_MS = 60_000;

async function fetchAllFixtures(): Promise<WCFixture[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");

  const url = "https://v3.football.api-sports.io/fixtures?league=1&season=2026";
  const res = await fetch(url, {
    headers: { "x-apisports-key": key, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const json = (await res.json()) as {
    response: Array<{
      fixture: { id: number; date: string; status: { long: string; short: string; elapsed: number | null }; venue: { name: string | null; city: string | null } };
      league: { round: string | null };
      teams: { home: WCTeam; away: WCTeam };
      goals: { home: number | null; away: number | null };
    }>;
  };
  const data: WCFixture[] = (json.response ?? []).map((r) => ({
    id: r.fixture.id,
    date: r.fixture.date,
    status: r.fixture.status.long,
    statusShort: r.fixture.status.short,
    elapsed: r.fixture.status.elapsed,
    venue: r.fixture.venue?.name ?? null,
    city: r.fixture.venue?.city ?? null,
    round: r.league?.round ?? null,
    home: r.teams.home,
    away: r.teams.away,
    goalsHome: r.goals.home,
    goalsAway: r.goals.away,
  }));
  cache = { at: Date.now(), data };
  return data;
}

const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
const FINISHED = new Set(["FT", "AET", "PEN"]);
const UPCOMING = new Set(["NS", "TBD"]);

export const listWorldCupFixtures = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        bucket: z.enum(["all", "live", "today", "upcoming", "recent", "completed"]).default("all"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<WCFixture[]> => {
    try {
      const all = await fetchAllFixtures();
      const now = Date.now();
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

      switch (data.bucket) {
        case "live":
          return all.filter((f) => LIVE.has(f.statusShort));
        case "today":
          return all.filter((f) => {
            const t = new Date(f.date).getTime();
            return t >= startOfToday.getTime() && t <= endOfToday.getTime();
          });
        case "upcoming":
          return all
            .filter((f) => UPCOMING.has(f.statusShort) && new Date(f.date).getTime() > now)
            .sort((a, b) => +new Date(a.date) - +new Date(b.date));
        case "recent":
          return all
            .filter((f) => FINISHED.has(f.statusShort))
            .sort((a, b) => +new Date(b.date) - +new Date(a.date))
            .slice(0, 20);
        case "completed":
          return all
            .filter((f) => FINISHED.has(f.statusShort))
            .sort((a, b) => +new Date(b.date) - +new Date(a.date));
        case "all":
        default:
          return all.sort((a, b) => +new Date(a.date) - +new Date(b.date));
      }
    } catch (e) {
      // graceful fallback so the page doesn't error out
      console.error("[worldcup] fetch failed", e);
      return [];
    }
  });
