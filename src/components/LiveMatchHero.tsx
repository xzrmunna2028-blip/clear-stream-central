import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMatchStreams,
  listHeroMedia,
  type PublicMatch,
  type PublicMatchStream,
  type PublicHeroMedia,
} from "@/lib/channels.functions";
import { flagUrl, isoForCountry } from "@/lib/countries";

type Props = {
  matches: PublicMatch[];
  onWatchMatch: (match: PublicMatch, streamId: string) => void;
};

export function LiveMatchHero({ matches, onWatchMatch }: Props) {
  const liveMatches = useMemo(() => matches.filter((m) => m.is_live), [matches]);
  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => !m.is_live && new Date(m.start_time).getTime() > Date.now())
        .slice(0, 3),
    [matches],
  );
  const [activeLive, setActiveLive] = useState(0);
  const live = liveMatches[activeLive] ?? null;

  const fetchStreams = useServerFn(listMatchStreams);
  const fetchHero = useServerFn(listHeroMedia);
  const [streams, setStreams] = useState<PublicMatchStream[]>([]);
  const [hero, setHero] = useState<PublicHeroMedia[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    if (!live) { setStreams([]); return; }
    let cancelled = false;
    fetchStreams({ data: { matchId: live.id } })
      .then((r) => { if (!cancelled) setStreams(r); })
      .catch(() => { if (!cancelled) setStreams([]); });
    return () => { cancelled = true; };
  }, [live, fetchStreams]);

  useEffect(() => {
    fetchHero().then(setHero).catch(() => setHero([]));
  }, [fetchHero]);

  useEffect(() => {
    if (hero.length < 2) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % hero.length), 12000);
    return () => clearInterval(t);
  }, [hero.length]);

  if (live) {
    return (
      <LiveCard
        match={live}
        streams={streams}
        liveCount={liveMatches.length}
        activeIdx={activeLive}
        onSwitchMatch={setActiveLive}
        onWatch={(streamId) => onWatchMatch(live, streamId)}
      />
    );
  }

  const heroItem = hero[heroIdx];
  return <ComingSoonCard hero={heroItem} upcoming={upcoming} />;
}

function LiveCard({
  match, streams, liveCount, activeIdx, onSwitchMatch, onWatch,
}: {
  match: PublicMatch;
  streams: PublicMatchStream[];
  liveCount: number;
  activeIdx: number;
  onSwitchMatch: (i: number) => void;
  onWatch: (streamId: string) => void;
}) {
  const isoA = match.team_a_iso || isoForCountry(match.team_a);
  const isoB = match.team_b_iso || isoForCountry(match.team_b);
  const canWatch = streams.length > 0;

  return (
    <section
      aria-label="Live now"
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#0b1437] via-[#1a1f4f] to-[#3a0e2c] p-5 sm:p-7"
    >
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #fff 0, transparent 35%), radial-gradient(circle at 80% 80%, #fff 0, transparent 35%)" }} />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> Live now
          </span>
          {match.league && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
              {match.league}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <TeamSide name={match.team_a} iso={isoA} align="right" />
          <button
            type="button"
            onClick={() => streams[0] && onWatch(streams[0].id)}
            disabled={!canWatch}
            className="group relative grid place-items-center rounded-full bg-white/10 px-4 py-3 text-white backdrop-blur ring-2 ring-white/20 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-xs font-semibold uppercase tracking-widest opacity-80">VS</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-yellow-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              {canWatch ? "TAP TO WATCH" : "NO STREAM"}
            </div>
          </button>
          <TeamSide name={match.team_b} iso={isoB} align="left" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium text-white/80">
            {match.title}
          </div>
          {streams.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {streams.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onWatch(s.id)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--brand)] hover:text-black transition"
                >
                  ▶ {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {liveCount > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: liveCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => onSwitchMatch(i)}
                aria-label={`Live match ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === activeIdx ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TeamSide({ name, iso, align }: { name: string | null; iso: string | null; align: "left" | "right" }) {
  const flag = flagUrl(iso, 320);
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && <FlagBlock url={flag} name={name} />}
      <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
        <div className="truncate text-base font-bold uppercase tracking-wide text-white sm:text-xl">
          {name || "TBD"}
        </div>
      </div>
      {align === "right" && <FlagBlock url={flag} name={name} />}
    </div>
  );
}

function FlagBlock({ url, name }: { url: string | null; name: string | null }) {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-md ring-2 ring-white/30 sm:h-20 sm:w-20">
      {url ? (
        <img src={url} alt={name ?? ""} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[10px] font-semibold text-slate-500">{(name || "?").slice(0, 3)}</span>
      )}
    </div>
  );
}

function ComingSoonCard({ hero, upcoming }: { hero?: PublicHeroMedia; upcoming: PublicMatch[] }) {
  return (
    <section
      aria-label="Coming up"
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-black"
    >
      <div className="relative aspect-[16/7] w-full bg-gradient-to-br from-[#0b1437] via-[#1a1f4f] to-[#3a0e2c]">
        {hero?.video_url ? (
          <video
            key={hero.id}
            src={hero.video_url}
            poster={hero.poster_url ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
          <span className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-black">
            ⏱ Coming Soon
          </span>
          <div className="text-xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
            {hero?.title ?? "Stay tuned — live matches start soon"}
          </div>
          {upcoming.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {upcoming.map((m) => (
                <div key={m.id} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur">
                  {m.team_a && m.team_b ? `${m.team_a} vs ${m.team_b}` : m.title}
                  <span className="ml-1.5 opacity-70">· {new Date(m.start_time).toLocaleString([], { hour: "2-digit", minute: "2-digit", weekday: "short" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
