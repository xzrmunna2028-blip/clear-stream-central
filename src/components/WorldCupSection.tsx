import { useEffect, useMemo, useState } from "react";
import { flagUrl, isoForCountry } from "@/lib/countries";
import type { PublicMatch } from "@/lib/channels.functions";
import { formatMatchShortDateTime } from "@/lib/date-format";

type Status = "live" | "upcoming" | "completed";

function statusAt(m: PublicMatch, nowMs: number): Status {
  if (m.is_live) return "live";
  const t = new Date(m.start_time).getTime();
  if (t <= nowMs && nowMs - t < 3 * 60 * 60 * 1000) return "live";
  if (t + 3 * 60 * 60 * 1000 < nowMs) return "completed";
  return "upcoming";
}

function countdown(iso: string, nowMs: number): string {
  const diff = new Date(iso).getTime() - nowMs;
  if (diff <= 0) return "Starting now";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

type Props = {
  matches: PublicMatch[];
  activeMatchId: string | null;
  nowMs: number;
  onPickMatch: (m: PublicMatch) => void;
};

export function WorldCupSection({ matches, activeMatchId, nowMs, onPickMatch }: Props) {
  const [clock, setClock] = useState(nowMs);

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(() => {
    return matches.slice().sort((a, b) => {
      const sa = statusAt(a, clock);
      const sb = statusAt(b, clock);
      const rank = { live: 0, upcoming: 1, completed: 2 } as const;
      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
      return +new Date(a.start_time) - +new Date(b.start_time);
    });
  }, [matches, clock]);

  return (
    <section aria-label="FIFA World Cup 2026" className="mb-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-block h-6 w-1.5 rounded-sm" style={{ background: "var(--brand)" }} />
        <div>
          <h2 className="text-base font-extrabold tracking-tight">FIFA World Cup 2026</h2>
          <p className="text-[11px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Tap the VS to watch live
          </p>
        </div>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
          WC 2026
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40 p-8 text-center text-sm text-[var(--muted-foreground)]">
          No matches scheduled yet. Add matches from the admin panel.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              status={statusAt(m, clock)}
              nowMs={clock}
              active={activeMatchId === m.id}
              onClick={() => onPickMatch(m)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({
  match, status, nowMs, active, onClick,
}: {
  match: PublicMatch;
  status: Status;
  nowMs: number;
  active: boolean;
  onClick: () => void;
}) {
  const isoA = match.team_a_iso || isoForCountry(match.team_a);
  const isoB = match.team_b_iso || isoForCountry(match.team_b);
  const isLive = status === "live";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-[var(--surface)] p-3 transition ${
        active ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/50" : "border-[var(--border)]"
      }`}
    >
      <div className="absolute right-2 top-2">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
          </span>
        ) : status === "upcoming" ? (
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-black">
            {countdown(match.start_time, nowMs)}
          </span>
        ) : (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80">Done</span>
        )}
      </div>

      <div className="mb-3 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] line-clamp-1">
        {match.league || "FIFA World Cup 2026"}
      </div>

      <div className="flex items-center justify-between gap-2">
        <TeamBlock name={match.team_a} iso={isoA} />

        <button
          onClick={onClick}
          disabled={!isLive}
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-xs font-black transition ${
            isLive
              ? "bg-red-600 text-white shadow-lg hover:scale-110 hover:bg-red-500 cursor-pointer"
              : "bg-[var(--surface-elevated)] text-[var(--muted-foreground)] cursor-not-allowed"
          }`}
          title={isLive ? "Watch live" : "Not live yet"}
          aria-label={isLive ? "Watch live" : "Match not live"}
        >
          {isLive ? "▶" : "VS"}
        </button>

        <TeamBlock name={match.team_b} iso={isoB} align="right" />
      </div>

      <div className="mt-3 text-center text-[11px] text-[var(--muted-foreground)]">
        📅 {formatMatchShortDateTime(match.start_time)}
      </div>
    </div>
  );
}

function TeamBlock({ name, iso, align = "left" }: { name: string | null; iso: string | null; align?: "left" | "right" }) {
  const url = flagUrl(iso, 80);
  return (
    <div className={`flex flex-1 flex-col items-center gap-1 ${align === "right" ? "order-none" : ""}`}>
      <div className="grid h-10 w-14 place-items-center overflow-hidden rounded bg-white ring-1 ring-white/15">
        {url ? (
          <img src={url} alt={name ?? ""} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[9px] font-bold text-slate-500">{(name || "?").slice(0, 3)}</span>
        )}
      </div>
      <span className="line-clamp-1 text-center text-xs font-semibold">{name || "TBD"}</span>
    </div>
  );
}
