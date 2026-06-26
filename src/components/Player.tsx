"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Hls, { type Level } from "hls.js";

type Props = {
  channelId: string | null;
  channelName: string;
};

type Quality = { index: number; height: number; bitrate: number };

export function Player({ channelId, channelName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [qualities, setQualities] = useState<Quality[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = auto
  const [showSettings, setShowSettings] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const showOverlay = useCallback((text: string) => {
    setOverlay(text);
    window.setTimeout(() => setOverlay((cur) => (cur === text ? null : cur)), 900);
  }, []);

  // Load stream
  useEffect(() => {
    if (!channelId || !videoRef.current) return;
    const video = videoRef.current;
    const src = `/api/stream/${channelId}/playlist.m3u8`;
    setLoading(true);
    setQualities([]);
    setCurrentLevel(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
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
        video.play().catch(() => {});
        setLoading(false);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
        setLoading(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channelId]);

  // Gesture handlers — vertical drag on right half = volume, left half = brightness
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
    const onEnd = () => {
      active = false;
      mode = null;
    };

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
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const pickQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (idx === -1) {
      hls.currentLevel = -1;
      hls.nextLevel = -1;
    } else {
      hls.currentLevel = idx;
    }
    setCurrentLevel(idx);
    setShowSettings(false);
  };

  const fmtBitrate = (bps: number) => {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    return `${Math.round(bps / 1000)} kbps`;
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

      {/* Channel name strip (top-left) */}
      {channelName && (
        <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium tracking-wide text-white backdrop-blur">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--live)] live-pulse" />
          {channelName}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {/* Gesture overlay */}
      {overlay && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/60 px-4 py-2 text-base font-semibold text-white backdrop-blur">
          {overlay}
        </div>
      )}

      {/* Controls row (bottom) */}
      <div
        data-no-gesture
        className="absolute right-3 bottom-3 flex items-center gap-2"
      >
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="rounded-md bg-black/60 px-2 py-2 text-white backdrop-blur hover:bg-black/80"
          aria-label="Quality settings"
          title="Quality"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={toggleFullscreen}
          className="rounded-md bg-black/60 px-2 py-2 text-white backdrop-blur hover:bg-black/80"
          aria-label="Fullscreen"
          title="Fullscreen"
        >
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

      {/* Settings panel */}
      {showSettings && (
        <div
          data-no-gesture
          className="absolute right-3 bottom-16 w-64 rounded-lg bg-black/80 p-3 text-white shadow-xl backdrop-blur"
        >
          <div className="mb-2 text-xs font-semibold text-white/70">Quality (Resolution)</div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            <button
              onClick={() => pickQuality(-1)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${currentLevel === -1 ? "bg-[var(--brand)] text-black" : "hover:bg-white/10"}`}
            >
              Auto
            </button>
            {sortedQ.length === 0 && (
              <div className="px-2 py-3 text-xs text-white/50">Loading quality options…</div>
            )}
            {sortedQ.map((q) => (
              <button
                key={q.index}
                onClick={() => pickQuality(q.index)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${currentLevel === q.index ? "bg-[var(--brand)] text-black" : "hover:bg-white/10"}`}
              >
                <span>{q.height > 0 ? `${q.height}p` : "Unknown"}</span>
                <span className="text-xs opacity-70">{fmtBitrate(q.bitrate)}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-white/40">
            Tip: ডান-উপরে টান দিলে সাউন্ড বাড়বে, বাম-উপরে টান দিলে ব্রাইটনেস। নিচে টান কমাবে।
          </div>
        </div>
      )}
    </div>
  );
}
