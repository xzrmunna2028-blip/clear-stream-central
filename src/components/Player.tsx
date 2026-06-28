"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Hls, { type Level } from "hls.js";
import type { PublicSource } from "@/lib/channels.functions";

type Props = {
  channelId: string | null;
  channelName: string;
  sources?: PublicSource[];
  /** When set, the playlist URL uses ?match_stream=... and `channelId` is treated as match id. */
  matchStreamId?: string | null;
};

type Quality = { index: number; height: number; bitrate: number };

export function Player({ channelId, channelName, sources = [], matchStreamId = null }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [qualities, setQualities] = useState<Quality[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setCurrentSourceId(sources[0]?.id ?? null);
  }, [channelId, sources]);

  const showOverlay = useCallback((text: string) => {
    setOverlay(text);
    window.setTimeout(() => setOverlay((cur) => (cur === text ? null : cur)), 900);
  }, []);

  useEffect(() => {
    if (!channelId || !videoRef.current) return;
    const video = videoRef.current;
    const params = new URLSearchParams();
    if (matchStreamId) params.set("match_stream", matchStreamId);
    else if (currentSourceId) params.set("source", currentSourceId);
    const qs = params.toString() ? `?${params}` : "";
    const src = `/api/stream/${channelId}/playlist.m3u8${qs}`;
    setLoading(true);
    setOffline(false);
    setQualities([]);
    setCurrentLevel(-1);
    setNeedsUnmute(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const tryAutoplay = () => {
      video.muted = false;
      video.play().catch(() => {
        // Browser blocked autoplay-with-sound — fall back to muted + tap-to-unmute prompt.
        video.muted = true;
        video.play().catch(() => {});
        setNeedsUnmute(true);
      });
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: -1,
        autoStartLoad: true,
        lowLatencyMode: false,
        backBufferLength: 15,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 30 * 1000 * 1000,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
        enableWorker: true,
        progressive: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels: Quality[] = hls.levels.map((l: Level, i: number) => ({
          index: i,
          height: l.height || 0,
          bitrate: l.bitrate || 0,
        }));
        setQualities(levels);
        tryAutoplay();
        setLoading(false);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });
      let netRetries = 0;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (netRetries++ < 3) hls.startLoad();
              else { setOffline(true); setLoading(false); hls.destroy(); }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setOffline(true); setLoading(false); hls.destroy();
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => { tryAutoplay(); setLoading(false); });
      video.addEventListener("error", () => { setOffline(true); setLoading(false); });
    }

    return () => {
      try { video.pause(); } catch {}
      try { video.muted = true; } catch {}
      if (hlsRef.current) {
        try { hlsRef.current.detachMedia(); } catch {}
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      try {
        video.removeAttribute("src");
        video.load();
      } catch {}
    };
  }, [channelId, currentSourceId, matchStreamId]);

  // Gesture handlers
  useEffect(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    let startY = 0;
    let startX = 0;
    let startVol = video.volume;
    let startBri = brightness;
    let mode: "volume" | "brightness" | null = null;
    let active = false;

    const onStart = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-gesture]")) return;
      active = true;
      startY = e.clientY;
      startX = e.clientX;
      startVol = video.volume;
      startBri = brightness;
      const rect = el.getBoundingClientRect();
      mode = e.clientX - rect.left > rect.width / 2 ? "volume" : "brightness";
    };
    const onMove = (e: PointerEvent) => {
      if (!active || !mode) return;
      const dy = startY - e.clientY;
      const dx = Math.abs(e.clientX - startX);
      if (Math.abs(dy) < 12 || dx > 60) return;
      const rect = el.getBoundingClientRect();
      const delta = dy / rect.height;
      if (mode === "volume") {
        const v = Math.max(0, Math.min(1, startVol + delta * 1.4));
        video.volume = v;
        video.muted = v === 0;
        showOverlay(`🔊 ${Math.round(v * 100)}%`);
      } else {
        const b = Math.max(0.2, Math.min(1.6, startBri + delta * 1.4));
        setBrightness(b);
        showOverlay(`☀ ${Math.round((b / 1.6) * 100)}%`);
      }
    };
    const onEnd = () => { active = false; mode = null; };

    el.addEventListener("pointerdown", onStart);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      el.removeEventListener("pointerdown", onStart);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [brightness, showOverlay]);

  useEffect(() => {
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      const so: any = (screen as any).orientation;
      if (fs && so?.lock) so.lock("landscape").catch(() => {});
      else if (!fs && so?.unlock) { try { so.unlock(); } catch {} }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const rotateScreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { try { await el.requestFullscreen?.(); } catch {} }
    const so: any = (screen as any).orientation;
    if (!so?.lock) { showOverlay("Rotate not supported"); return; }
    const isLandscape = so.type?.startsWith("landscape");
    try {
      await so.lock(isLandscape ? "portrait" : "landscape");
      showOverlay(isLandscape ? "↻ Portrait" : "↻ Landscape");
    } catch { showOverlay("Rotate blocked"); }
  }, [showOverlay]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const unmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.play().catch(() => {});
    setNeedsUnmute(false);
  };

  const pickQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (idx === -1) { hls.currentLevel = -1; hls.nextLevel = -1; }
    else hls.currentLevel = idx;
    setCurrentLevel(idx);
    setShowSettings(false);
  };

  const fmtBitrate = (bps: number) => {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    return `${Math.round(bps / 1000)} kbps`;
  };

  const qBadge = (h: number) => {
    if (h >= 2160) return { label: "4K", cls: "bg-red-600 text-white" };
    if (h >= 1440) return { label: "QHD", cls: "bg-orange-500 text-white" };
    if (h >= 720) return { label: "HD", cls: "bg-red-500 text-white" };
    return null;
  };

  const sortedQ = [...qualities].sort((a, b) => b.height - a.height);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl bg-black select-none aspect-video"
      style={{ filter: `brightness(${brightness})` }}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        controls={false}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 h-full w-full bg-black"
      />

      {channelName && (
        <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--live)] live-pulse" />
          {channelName}
        </div>
      )}

      {sources.length > 1 && !matchStreamId && (
        <div
          data-no-gesture
          className="absolute left-1/2 top-12 z-10 flex max-w-[90%] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-black/55 px-2 py-1.5 backdrop-blur ring-1 ring-white/10"
          style={{ scrollbarWidth: "none" }}
        >
          {sources.map((s) => {
            const active = currentSourceId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentSourceId(s.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active ? "bg-[var(--brand)] text-black" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {active && "✓ "}{s.label}
              </button>
            );
          })}
        </div>
      )}

      {loading && !offline && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {offline && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
          <div>
            <div className="text-3xl">📡</div>
            <div className="mt-2 text-base font-semibold text-white">This stream is offline</div>
            <div className="mt-1 text-xs text-white/60">
              Try another source or pick a different channel.
            </div>
          </div>
        </div>
      )}

      {needsUnmute && !offline && (
        <button
          data-no-gesture
          onClick={unmute}
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-black shadow-2xl ring-2 ring-white/30 animate-pulse"
        >
          🔊 Tap to Unmute
        </button>
      )}

      {overlay && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/60 px-4 py-2 text-base font-semibold text-white backdrop-blur">
          {overlay}
        </div>
      )}

      <div data-no-gesture className="absolute right-3 top-3 flex items-center gap-2">
        <button onClick={rotateScreen} className="rounded-md bg-black/60 px-2 py-2 text-white backdrop-blur hover:bg-black/80" aria-label="Rotate" title="Rotate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      <div data-no-gesture className="absolute right-3 bottom-3 flex items-center gap-2">
        <button onClick={() => setShowSettings((s) => !s)} className="rounded-md bg-black/60 px-2 py-2 text-white backdrop-blur hover:bg-black/80" aria-label="Quality" title="Quality">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button onClick={toggleFullscreen} className="rounded-md bg-black/60 px-2 py-2 text-white backdrop-blur hover:bg-black/80" aria-label="Fullscreen" title="Fullscreen">
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4" />
            </svg>
          )}
        </button>
      </div>

      {showSettings && (
        <div data-no-gesture className="absolute right-3 bottom-16 w-72 rounded-xl bg-black/85 p-3 text-white shadow-2xl backdrop-blur ring-1 ring-white/10">
          <div className="mb-2 text-center text-sm font-semibold">Quality</div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            <button
              onClick={() => pickQuality(-1)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ${currentLevel === -1 ? "bg-[var(--brand)] text-black" : "bg-white/10 hover:bg-white/15"}`}
            >
              <span>Auto</span>
              <span className="text-xs opacity-70">Recommended</span>
            </button>
            {sortedQ.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-white/50">Only Auto available for this stream</div>
            )}
            {sortedQ.map((q) => {
              const badge = qBadge(q.height);
              const active = currentLevel === q.index;
              return (
                <button
                  key={q.index}
                  onClick={() => pickQuality(q.index)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-white/15" : "hover:bg-white/10"}`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {q.height > 0 ? `${q.height}p` : "Unknown"}
                    {badge && (
                      <span className={`rounded px-1.5 py-[1px] text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                    )}
                  </span>
                  <span className="text-xs text-white/70">{fmtBitrate(q.bitrate)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
