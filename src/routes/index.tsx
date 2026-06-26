import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { Player } from "@/components/Player";
import { ChannelGrid } from "@/components/ChannelGrid";
import { MatchSchedule } from "@/components/MatchSchedule";
import { listChannels, listMatches, type PublicChannel, type PublicMatch } from "@/lib/channels.functions";

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
    const [channels, matches] = await Promise.all([listChannels(), listMatches()]);
    return { channels, matches };
  },
  component: Home,
});

function Home() {
  const { channels: initChannels, matches: initMatches } = Route.useLoaderData();
  const refetchCh = useServerFn(listChannels);
  const refetchMa = useServerFn(listMatches);

  const [channels, setChannels] = useState<PublicChannel[]>(initChannels);
  const [matches, setMatches] = useState<PublicMatch[]>(initMatches);
  const [active, setActive] = useState<PublicChannel | null>(initChannels[0] ?? null);

  // Soft poll for real-time updates from admin
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const [c, m] = await Promise.all([refetchCh(), refetchMa()]);
        setChannels(c);
        setMatches(m);
      } catch {
        // ignore
      }
    }, 20000);
    return () => clearInterval(t);
  }, [refetchCh, refetchMa]);

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
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1 text-xs sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)] live-pulse" />
            LIVE NOW
          </span>
        </div>
      </header>

      <h1 className="sr-only">FlashSports HD — Live Television Streaming</h1>

      <div className="mb-4">
        <Player channelId={active?.id ?? null} channelName={active?.name ?? ""} />
      </div>

      <MatchSchedule
        matches={matches}
        channels={channels}
        onPlay={(id) => {
          const c = channels.find((x) => x.id === id);
          if (c) setActive(c);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <ChannelGrid channels={channels} activeId={active?.id ?? null} onPick={setActive} />

      <footer className="mt-10 border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--muted-foreground)]">
        © {new Date().getFullYear()} FlashSports HD · Built for fans
      </footer>
    </div>
  );
}
