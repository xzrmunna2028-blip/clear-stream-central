import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listWorldCupFixtures, type WCFixture } from "@/lib/worldcup.functions";

const BUCKETS = [
  { id: "live", label: "Live" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "recent", label: "Recent" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
] as const;
type BucketId = (typeof BUCKETS)[number]["id"];

function fmt(d: string) {
  const x = new Date(d);
  return x.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const LIVE_SHORT = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"]);
const FINISHED_SHORT = new Set(["FT", "AET", "PEN"]);

export function WorldCupSection() {
  const fetchFn = useServerFn(listWorldCupFixtures);
  const [bucket, setBucket] = useState<BucketId>("live");
  const [items, setItems] = useState<WCFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn({ data: { bucket } })
      .then((r) => { if (!cancelled) setItems(r); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const t = setInterval(() => {
      fetchFn({ data: { bucket } }).then((r) => !cancelled && setItems(r)).catch(() => {});
    }, bucket === "live" ? 30_000 : 120_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [bucket, fetchFn]);

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
            {b.id === "live" && bucket !== "live" ? (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--live)] live-pulse align-middle" />
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/40 p-6 text-center text-sm text-[var(--muted-foreground)]">
          No matches in this list right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const live = LIVE_SHORT.has(m.statusShort);
            const done = FINISHED_SHORT.has(m.statusShort);
            return (
              <article
                key={m.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--accent)]/60 hover:bg-[var(--surface-elevated)]"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  <span className="line-clamp-1">{m.round ?? "World Cup 2026"}</span>
                  {live ? (
                    <span className="flex items-center gap-1 rounded-full bg-[var(--live)]/15 px-2 py-0.5 font-bold text-[var(--live)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)] live-pulse" />
                      {m.elapsed ? `${m.elapsed}'` : "LIVE"}
                    </span>
                  ) : done ? (
                    <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 font-bold text-[var(--accent)]">FT</span>
                  ) : (
                    <span>{fmt(m.date)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <TeamRow name={m.home.name} logo={m.home.logo} goals={m.goalsHome} />
                </div>
                <div className="my-1 ml-9 text-[10px] text-[var(--muted-foreground)]">vs</div>
                <div className="flex items-center gap-2">
                  <TeamRow name={m.away.name} logo={m.away.logo} goals={m.goalsAway} />
                </div>

                {m.venue ? (
                  <div className="mt-2 line-clamp-1 text-[10px] text-[var(--muted-foreground)]">
                    📍 {m.venue}{m.city ? `, ${m.city}` : ""}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeamRow({ name, logo, goals }: { name: string; logo: string | null; goals: number | null }) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/95">
        {logo ? (
          <img src={logo} alt={name} className="h-6 w-6 object-contain" loading="lazy" />
        ) : (
          <span className="text-[10px] font-bold text-[var(--background)]">{name.slice(0, 2)}</span>
        )}
      </div>
      <span className="line-clamp-1 flex-1 text-sm font-semibold">{name}</span>
      <span className="w-6 text-right text-sm font-bold tabular-nums">
        {goals ?? "–"}
      </span>
    </div>
  );
}
