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

// Resolution presets — used to label closest available HLS level.
const PRESETS: Array<{ key: string; label: string; badge?: string; minH: number }> = [
  { key: "8k", label: "8K HD", badge: "8K", minH: 4320 },
  { key: "4k", label: "4K Ultra", badge: "4K", minH: 2160 },
  { key: "1440", label: "1440p QHD", badge: "QHD", minH: 1440 },
  { key: "1080", label: "1080p Full HD", badge: "FHD", minH: 1080 },
  { key: "720", label: "720p HD", badge: "HD", minH: 720 },
  { key: "480", label: "480p", minH: 480 },
  { key: "360", label: "360p", minH: 360 },
];

export function Player({ channelId, sources = [], matchStreamId = null }: Props) {
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

  // Pinch-zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setCurrentSourceId(sources[0]?.id ?? null);
    setZoom(1); setPan({ x: 0, y: 0 });
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
        video.muted = true;
        video.play().catch(() => {});
        setNeedsUnmute(true);
      });
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: -1,
        autoStartLoad: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 1,
        nudgeMaxRetry: 10,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        manifestLoadingRetryDelay: 500,
        enableWorker: true,
        progressive: true,
        testBandwidth: true,
        abrEwmaDefaultEstimate: 1_500_000,
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

  // Touch gestures: swipe (vol/brightness) + pinch-to-zoom
  useEffect(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    let startY = 0;
    let startX = 0;
    let startVol = video.volume;
    let startBri = brightness;
    let startZoom = zoom;
    let startPan = pan;
    let startDist = 0;
    let mode: "volume" | "brightness" | "pinch" | null = null;
    const pointers = new Map<number, PointerEvent>();

    const dist = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[0].clientX - pts[1].clientX;
      const dy = pts[0].clientY - pts[1].clientY;
      return Math.hypot(dx, dy);
    };
    const center = () => {
      const pts = Array.from(pointers.values());
      return {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2,
      };
    };

    const onStart = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-gesture]")) return;
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        mode = "pinch";
        startDist = dist();
        startZoom = zoom;
        startPan = pan;
        return;
      }
      startY = e.clientY;
      startX = e.clientX;
      startVol = video.volume;
      startBri = brightness;
      const rect = el.getBoundingClientRect();
      mode = e.clientX - rect.left > rect.width / 2 ? "volume" : "brightness";
    };
    const onMove = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
      if (!mode) return;

      if (mode === "pinch" && pointers.size >= 2) {
        const d = dist();
        if (startDist > 0) {
          const scale = Math.max(1, Math.min(4, startZoom * (d / startDist)));
          setZoom(scale);
          if (scale <= 1.01) setPan({ x: 0, y: 0 });
          showOverlay(`⛶ ${scale.toFixed(1)}×`);
        }
        return;
      }

      if (pointers.size > 1) return;
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
      } else if (mode === "brightness") {
        const b = Math.max(0.2, Math.min(1.6, startBri + delta * 1.4));
        setBrightness(b);
        showOverlay(`☀ ${Math.round((b / 1.6) * 100)}%`);
      }
    };
    const onEnd = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        if (mode === "pinch") mode = null;
      }
      if (pointers.size === 0) mode = null;
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
  }, [brightness, zoom, pan, showOverlay]);

  // Double-tap to reset zoom
  const lastTapRef = useRef(0);
  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setZoom(1); setPan({ x: 0, y: 0 });
      showOverlay("⛶ 1.0×");
    }
    lastTapRef.current = now;
  }, [showOverlay]);

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

  // Map presets to the best matching available HLS level (closest >= minH, else closest).
  const presetRows = PRESETS.map((p) => {
    let bestIdx = -1;
    let bestDelta = Infinity;
    qualities.forEach((q) => {
      const delta = Math.abs((q.height || 0) - p.minH);
      if (delta < bestDelta) { bestDelta = delta; bestIdx = q.index; }
    });
    const q = qualities.find((x) => x.index === bestIdx);
    const available = !!q && q.height >= p.minH * 0.85;
    return { ...p, levelIndex: bestIdx, available, real: q };
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl bg-black select-none aspect-video touch-none"
      style={{ filter: `brightness(${brightness})` }}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        controls={false}
        onClick={(e) => { handleVideoTap(); if ((e.detail ?? 1) === 1) togglePlay(); }}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 h-full w-full bg-black transition-transform duration-150 ease-out"
        style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "center center" }}
      />

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
            <div className="mt-1 text-xs text-white/60">Try another source or pick a different channel.</div>
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

      {/* Source switcher kept tucked at top-center, hidden unless multiple sources */}
      {sources.length > 1 && !matchStreamId && (
        <div
          data-no-gesture
          className="absolute left-1/2 top-3 z-10 flex max-w-[90%] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-black/55 px-2 py-1.5 backdrop-blur ring-1 ring-white/10"
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

      {/* Bottom-right controls */}
      <div data-no-gesture className="absolute right-3 bottom-3 flex items-center gap-2">
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); showOverlay("⛶ 1.0×"); }}
          className="rounded-md bg-black/60 px-2 py-2 text-white backdrop-blur hover:bg-black/80"
          aria-label="Reset zoom" title="Reset zoom"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
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
        <div data-no-gesture className="absolute right-3 bottom-16 w-72 rounded-xl bg-black/90 p-3 text-white shadow-2xl backdrop-blur ring-1 ring-white/10">
          <div className="mb-2 text-center text-sm font-semibold">Quality</div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            <button
              onClick={() => pickQuality(-1)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ${currentLevel === -1 ? "bg-[var(--brand)] text-black" : "bg-white/10 hover:bg-white/15"}`}
            >
              <span>Auto</span>
              <span className="text-xs opacity-70">Recommended</span>
            </button>
            {presetRows.map((p) => {
              const active = currentLevel === p.levelIndex && p.available;
              return (
                <button
                  key={p.key}
                  disabled={!p.available}
                  onClick={() => p.available && pickQuality(p.levelIndex)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    active ? "bg-white/15" : p.available ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {p.label}
                    {p.badge && (
                      <span className={`rounded px-1.5 py-[1px] text-[10px] font-bold ${
                        p.key === "8k" ? "bg-purple-600 text-white" :
                        p.key === "4k" ? "bg-red-600 text-white" :
                        p.key === "1440" ? "bg-orange-500 text-white" :
                        "bg-emerald-600 text-white"
                      }`}>{p.badge}</span>
                    )}
                  </span>
                  <span className="text-xs text-white/60">
                    {p.available ? `${p.real?.height}p` : "N/A"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-white/40 text-center">
            Stream provides what's listed. "N/A" means the source does not offer that resolution.
          </div>
        </div>
      )}
    </div>
  );
}
