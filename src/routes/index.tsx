import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo.png";
import { Player } from "@/components/Player";
import { ChannelGrid } from "@/components/ChannelGrid";
import { WorldCupSection } from "@/components/WorldCupSection";
import { MatchPlayerView } from "@/components/MatchPlayerView";
import {
  listChannels,
  listMatches,
  listChannelSources,
  type PublicChannel,
  type PublicMatch,
  type PublicSource,
} from "@/lib/channels.functions";
import { getSiteSettings } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlashSports HD — Live TV & Sports Streaming" },
      {
        name: "description",
        content:
          "Watch live sports, news and entertainment channels in HD with adaptive quality and zero buffering on FlashSports HD.",
      },
      { property: "og:title", content: "FlashSports HD — Live TV & Sports Streaming" },
      {
        property: "og:description",
        content: "Live channels, FIFA matches, news — all in one fast HD player.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: async () => {
    const [channelsResult, matchesResult, settingsResult] = await Promise.allSettled([
      listChannels(),
      listMatches(),
      getSiteSettings(),
    ]);
    const channels = channelsResult.status === "fulfilled" ? channelsResult.value : [];
    const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
    const settings = settingsResult.status === "fulfilled"
      ? settingsResult.value
      : { maintenance_mode: false, maintenance_message: "", marquee_text: "" };
    return { channels, matches, settings, renderedAt: Date.now() };
  },
  component: Home,
});

type Mode =
  | { kind: "channel"; channel: PublicChannel }
  | { kind: "match"; match: PublicMatch };

function Home() {
  const { channels: initChannels, matches: initMatches, settings: initSettings, renderedAt } =
    Route.useLoaderData();
  const refetchCh = useServerFn(listChannels);
  const refetchMa = useServerFn(listMatches);
  const refetchSettings = useServerFn(getSiteSettings);
  const fetchSources = useServerFn(listChannelSources);

  const [channels, setChannels] = useState<PublicChannel[]>(initChannels);
  const [matches, setMatches] = useState<PublicMatch[]>(initMatches);
  const [marquee, setMarquee] = useState<string>(initSettings.marquee_text);
  const [mode, setMode] = useState<Mode | null>(null);
  const [sources, setSources] = useState<PublicSource[]>([]);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode?.kind !== "channel") { setSources([]); return; }
    const chId = mode.channel.id;
    let cancelled = false;
    fetchSources({ data: { channelId: chId } })
      .then((r) => !cancelled && setSources(r))
      .catch(() => !cancelled && setSources([]));
    return () => { cancelled = true; };
  }, [mode, fetchSources]);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const [c, m, s] = await Promise.all([refetchCh(), refetchMa(), refetchSettings()]);
        setChannels(c); setMatches(m); setMarquee(s.marquee_text);
      } catch { /* ignore */ }
    }, 20000);
    return () => clearInterval(t);
  }, [refetchCh, refetchMa, refetchSettings]);

  const scrollToPlayer = () => {
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const pickChannel = (c: PublicChannel) => { setMode({ kind: "channel", channel: c }); scrollToPlayer(); };
  const pickMatch = (m: PublicMatch) => { setMode({ kind: "match", match: m }); scrollToPlayer(); };
  const close = () => setMode(null);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
      <header className="mb-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <img src={logo} alt="FlashSports HD" width={40} height={40} className="h-10 w-10 rounded-md" />
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">FlashSports HD</div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Live TV · Sports · News
            </div>
          </div>
        </a>
        <span className="hidden items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1 text-xs sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)] live-pulse" />
          LIVE NOW
        </span>
      </header>

      <h1 className="sr-only">FlashSports HD — Live Television Streaming</h1>

      <div ref={playerRef} className="mb-4">
        {mode?.kind === "match" ? (
          <MatchPlayerView match={mode.match} marqueeText={marquee} onClose={close} />
        ) : mode?.kind === "channel" ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-black/40 px-4 py-2">
              <div className="text-sm font-semibold">{mode.channel.name}</div>
              <button onClick={close} className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface-elevated)]">✕ Close</button>
            </div>
            <Player
              channelId={mode.channel.id}
              channelName={mode.channel.name}
              sources={sources}
            />
          </div>
        ) : null}
      </div>

      <WorldCupSection
        matches={matches}
        activeMatchId={mode?.kind === "match" ? mode.match.id : null}
        nowMs={renderedAt}
        onPickMatch={pickMatch}
      />

      <ChannelGrid
        channels={channels}
        activeId={mode?.kind === "channel" ? mode.channel.id : null}
        onPick={pickChannel}
      />

      <footer className="mt-10 border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--muted-foreground)]">
        © 2026 FlashSports HD · Built for fans
      </footer>
    </div>
  );
}
