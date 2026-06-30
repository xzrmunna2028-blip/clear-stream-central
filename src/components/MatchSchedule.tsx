import type { PublicMatch, PublicChannel } from "@/lib/channels.functions";
import { formatMatchShortDateTime } from "@/lib/date-format";

type Props = {
  matches: PublicMatch[];
  channels: PublicChannel[];
  onPlay: (channelId: string) => void;
};

export function MatchSchedule({ matches, channels, onPlay }: Props) {
  if (matches.length === 0) return null;
  const chMap = new Map(channels.map((c) => [c.id, c]));

  return (
    <section aria-label="Match schedule" className="mb-4">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-[var(--muted-foreground)]">
        UPCOMING & LIVE MATCHES
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {matches.map((m) => {
          const ch = m.channel_id ? chMap.get(m.channel_id) : null;
          return (
            <button
              key={m.id}
              onClick={() => ch && onPlay(ch.id)}
              disabled={!ch}
              className="min-w-[240px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--brand)]/60 hover:bg-[var(--surface-elevated)] disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase text-[var(--muted-foreground)]">
                  {m.league ?? "Match"}
                </span>
                {m.is_live ? (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--live)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--live)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)] live-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {formatMatchShortDateTime(m.start_time)}
                  </span>
                )}
              </div>
              <div className="mt-1 line-clamp-1 text-sm font-semibold">
                {m.team_a && m.team_b ? `${m.team_a} vs ${m.team_b}` : m.title}
              </div>
              <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {ch ? `📺 ${ch.name}` : "Channel not assigned"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
