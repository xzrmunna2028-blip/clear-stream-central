import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listWorldCupFixtures, type WCFixture } from "@/lib/worldcup.functions";
import { flagUrl, isoForCountry } from "@/lib/countries";
import type { PublicMatch } from "@/lib/channels.functions";
import { formatMatchShortDateTime, isSameMatchDay } from "@/lib/date-format";

const BUCKETS = [
  { id: "live", label: "Live" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "recent", label: "Recent" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
] as const;
type BucketId = (typeof BUCKETS)[number]["id"];

const LIVE_SHORT = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
const FINISHED_SHORT = new Set(["FT", "AET", "PEN"]);

type Status = "live" | "upcoming" | "completed";

function adminBucket(m: PublicMatch): Status {
  if (m.is_live) return "live";
  const t = new Date(m.start_time).getTime();
  // ~3h grace after start → completed
  if (t + 3 * 60 * 60 * 1000 < Date.now()) return "completed";
  return "upcoming";
}

function adminBucketAt(m: PublicMatch, nowMs: number): Status {
  if (m.is_live) return "live";
  const t = new Date(m.start_time).getTime();
  if (t + 3 * 60 * 60 * 1000 < nowMs) return "completed";
  return "upcoming";
}

function isToday(iso: string) {
  return isSameMatchDay(iso);
}

function adminMatches(matches: PublicMatch[], b: BucketId): PublicMatch[] {
  const list = matches.slice();
  switch (b) {
    case "live": return list.filter((m) => adminBucket(m) === "live");
    case "today": return list.filter((m) => isToday(m.start_time));
    case "upcoming":
      return list.filter((m) => adminBucket(m) === "upcoming")
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    case "recent":
    case "completed":
      return list.filter((m) => adminBucket(m) === "completed")
        .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
    case "all":
    default:
      return list.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }
}

type Props = {
  matches: PublicMatch[];
  activeMatchId: string | null;
  nowMs: number;
  onPickMatch: (m: PublicMatch) => void;
};

export function WorldCupSection({ matches, activeMatchId, nowMs, onPickMatch }: Props) {
  const fetchFn = useServerFn(listWorldCupFixtures);
  const [bucket, setBucket] = useState<BucketId>("live");
  const [items, setItems] = useState<WCFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(nowMs);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn({ data: { bucket } })
      .then((r) => !cancelled && setItems(r))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    const t = setInterval(() => {
      fetchFn({ data: { bucket } }).then((r) => !cancelled && setItems(r)).catch(() => {});
    }, bucket === "live" ? 30_000 : 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [bucket, fetchFn]);

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const admin = useMemo(() => adminMatchesAt(matches, bucket, clock), [matches, bucket, clock]);
  const liveAdminCount = useMemo(() => matches.filter((m) => adminBucketAt(m, clock) === "live").length, [matches, clock]);

  return (
    <section aria-label="FIFA World Cup 2026" className="mb-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-block h-6 w-1.5 rounded-sm" style={{ background: "var(--brand)" }} />
        <div>
          <h2 className="text-base font-extrabold tracking-tight">FIFA World Cup 2026</h2>
          <p className="text-[11px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Live · Today · Upcoming · Recent · Completed
          </p>
        </div>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
          WC 2026
        </span>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBucket(b.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              bucket === b.id
                ? "border-transparent bg-[var(--brand)] text-[var(--primary-foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--brand)]/60"
            }`}
          >
            {b.label}
            {b.id === "live" && bucket !== "live" && liveAdminCount + items.filter((f) => LIVE_SHORT.has(f.statusShort)).length > 0 ? (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--live)] live-pulse align-middle" />
            ) : null}
          </button>
        ))}
      </div>

      {loading && admin.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : admin.length === 0 && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40 p-8 text-center text-sm text-[var(--muted-foreground)]">
          No matches in this list right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {admin.map((m) => (
            <AdminMatchCard
              key={`a-${m.id}`}
              match={m}
              status={adminBucketAt(m, clock)}
              active={activeMatchId === m.id}
              onClick={() => onPickMatch(m)}
            />
          ))}
          {items.map((m) => <ApiMatchCard key={`w-${m.id}`} match={m} />)}
        </div>
      )}
    </section>
  );
}

function adminMatchesAt(matches: PublicMatch[], b: BucketId, nowMs: number): PublicMatch[] {
  const list = matches.slice();
  switch (b) {
    case "live": return list.filter((m) => adminBucketAt(m, nowMs) === "live");
    case "today": return list.filter((m) => isToday(m.start_time));
    case "upcoming":
      return list.filter((m) => adminBucketAt(m, nowMs) === "upcoming")
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    case "recent":
    case "completed":
      return list.filter((m) => adminBucketAt(m, nowMs) === "completed")
        .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
    case "all":
    default:
      return list.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }
}

function AdminMatchCard({
  match, status, active, onClick,
}: {
  match: PublicMatch;
  status: Status;
  active: boolean;
  onClick: () => void;
}) {
  const isoA = match.team_a_iso || isoForCountry(match.team_a);
  const isoB = match.team_b_iso || isoForCountry(match.team_b);
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-[var(--surface)] p-3 text-left transition hover:border-[var(--accent)]/60 hover:bg-[var(--surface-elevated)] ${
        active ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/50" : "border-[var(--border)]"
      }`}
    >
      <div className="absolute right-2 top-2">
        {status === "live" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
          </span>
        ) : status === "upcoming" ? (
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-black">Upcoming</span>
        ) : (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80">Done</span>
        )}
      </div>
      <div className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] line-clamp-1">
        {match.league || "Match"}
      </div>
      <TeamLine name={match.team_a} iso={isoA} />
      <div className="my-1 ml-12 text-[10px] text-[var(--muted-foreground)]">vs</div>
      <TeamLine name={match.team_b} iso={isoB} />
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
        <span>📅 {formatMatchShortDateTime(match.start_time)}</span>
        <span className="font-bold text-[var(--brand)] opacity-0 transition group-hover:opacity-100">▶ Watch</span>
      </div>
    </button>
  );
}

function TeamLine({ name, iso }: { name: string | null; iso: string | null }) {
  const url = flagUrl(iso, 80);
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-7 w-10 shrink-0 place-items-center overflow-hidden rounded bg-white ring-1 ring-white/15">
        {url ? <img src={url} alt={name ?? ""} className="h-full w-full object-cover" loading="lazy" />
          : <span className="text-[9px] font-bold text-slate-500">{(name || "?").slice(0, 3)}</span>}
      </div>
      <span className="line-clamp-1 flex-1 text-sm font-semibold">{name || "TBD"}</span>
    </div>
  );
}

function ApiMatchCard({ match }: { match: WCFixture }) {
  const live = LIVE_SHORT.has(match.statusShort);
  const done = FINISHED_SHORT.has(match.statusShort);
  return (
    <article className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3">
      <div className="absolute right-2 top-2">
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> {match.elapsed ? `${match.elapsed}'` : "LIVE"}
          </span>
        ) : done ? (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80">FT</span>
        ) : null}
      </div>
      <div className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] line-clamp-1">
        {match.round ?? "World Cup 2026"}
      </div>
      <TeamApiRow name={match.home.name} logo={match.home.logo} goals={match.goalsHome} />
      <div className="my-1 ml-12 text-[10px] text-[var(--muted-foreground)]">vs</div>
      <TeamApiRow name={match.away.name} logo={match.away.logo} goals={match.goalsAway} />
      <div className="mt-2 text-[10px] text-[var(--muted-foreground)]">📅 {formatMatchShortDateTime(match.date)}</div>
    </article>
  );
}

function TeamApiRow({ name, logo, goals }: { name: string; logo: string | null; goals: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-7 w-10 shrink-0 place-items-center overflow-hidden rounded bg-white ring-1 ring-white/15">
        {logo ? <img src={logo} alt={name} className="h-6 w-6 object-contain" loading="lazy" />
          : <span className="text-[9px] font-bold text-slate-500">{name.slice(0, 2)}</span>}
      </div>
      <span className="line-clamp-1 flex-1 text-sm font-semibold">{name}</span>
      <span className="w-6 text-right text-sm font-bold tabular-nums">{goals ?? "–"}</span>
    </div>
  );
}
