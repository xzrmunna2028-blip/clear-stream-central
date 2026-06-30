import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMatchStreams,
  listHeroMedia,
  type PublicMatch,
  type PublicMatchStream,
  type PublicHeroMedia,
} from "@/lib/channels.functions";
import { Player } from "@/components/Player";
import { flagUrl, isoForCountry } from "@/lib/countries";
import { formatMatchDateTime } from "@/lib/date-format";

type Props = {
  match: PublicMatch;
  marqueeText: string;
  onClose: () => void;
};

export function MatchPlayerView({ match, marqueeText, onClose }: Props) {
  const fetchStreams = useServerFn(listMatchStreams);
  const fetchHero = useServerFn(listHeroMedia);
  const [streams, setStreams] = useState<PublicMatchStream[]>([]);
  const [hero, setHero] = useState<PublicHeroMedia[]>([]);
  const [activeStream, setActiveStream] = useState<string | null>(null);

  const now = Date.now();
  const isCompleted = !match.is_live && new Date(match.start_time).getTime() + 3 * 60 * 60 * 1000 < now;
  const isUpcoming = !match.is_live && !isCompleted;

  useEffect(() => {
    let c = false;
    fetchStreams({ data: { matchId: match.id } })
      .then((r) => {
        if (c) return;
        setStreams(r);
        setActiveStream(r[0]?.id ?? null);
      })
      .catch(() => !c && setStreams([]));
    return () => { c = true; };
  }, [match.id, fetchStreams]);

  useEffect(() => {
    if (!isUpcoming) return;
    let c = false;
    fetchHero().then((r) => !c && setHero(r)).catch(() => !c && setHero([]));
    return () => { c = true; };
  }, [isUpcoming, fetchHero]);

  const isoA = match.team_a_iso || isoForCountry(match.team_a);
  const isoB = match.team_b_iso || isoForCountry(match.team_b);
  const promo = hero[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-black/40 px-4 py-3">
        <FlagPill iso={isoA} name={match.team_a} />
        <span className="text-sm font-bold tracking-wide text-[var(--muted-foreground)]">VS</span>
        <FlagPill iso={isoB} name={match.team_b} />
        <div className="ml-auto flex items-center gap-2">
          {match.is_live ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
            </span>
          ) : isCompleted ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase text-white/80">Completed</span>
          ) : (
            <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[11px] font-bold uppercase text-black">Upcoming</span>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface-elevated)]"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {match.is_live ? (
        <>
          <Player
            channelId={match.id}
            channelName={`${match.team_a ?? ""} vs ${match.team_b ?? ""}`.trim() || match.title}
            matchStreamId={activeStream}
          />
          <div className="border-t border-[var(--border)] bg-black/30 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Servers / TV Channels
            </div>
            {streams.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--muted-foreground)]">
                No servers added yet. Admin → Matches → Streams to add M3U links.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {streams.map((s) => {
                  const active = s.id === activeStream;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveStream(s.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-[var(--brand)] text-black"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {active ? "▶ " : ""}{s.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : isUpcoming ? (
        <>
          <div className="relative aspect-video w-full bg-black">
            {promo?.video_url ? (
              <video
                key={promo.id}
                src={promo.video_url}
                poster={promo.poster_url ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-sm text-white/60">
                Coming Soon — upload a promo in Admin → Hero Media
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-yellow-300">⏱ Starts</div>
              <div className="text-sm font-bold text-white">
                {formatMatchDateTime(match.start_time, true)}
              </div>
            </div>
          </div>
          <div className="overflow-hidden border-t border-[var(--border)] bg-black/60 py-2">
            <div className="marquee-scroll whitespace-nowrap text-sm font-medium text-yellow-300">
              {marqueeText || "Stay tuned — the action begins soon."}
            </div>
          </div>
        </>
      ) : (
        <div className="grid aspect-video place-items-center bg-black text-center">
          <div>
            <div className="text-4xl">🏁</div>
            <div className="mt-2 text-base font-semibold text-white">Match ended</div>
            <div className="mt-1 text-xs text-white/60">Check the Completed tab for full results.</div>
          </div>
        </div>
      )}
    </section>
  );
}

function FlagPill({ iso, name }: { iso: string | null; name: string | null }) {
  const url = flagUrl(iso, 80);
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-7 w-10 shrink-0 place-items-center overflow-hidden rounded bg-white shadow ring-1 ring-white/20">
        {url ? (
          <img src={url} alt={name ?? ""} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[9px] font-bold text-slate-500">{(name || "?").slice(0, 3)}</span>
        )}
      </div>
      <span className="text-sm font-bold uppercase tracking-wide text-white">{name || "TBD"}</span>
    </div>
  );
}
