"use client";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSiteSettings } from "@/lib/site-settings.functions";

/**
 * Polls site settings every 15s. When maintenance_mode is ON, renders a
 * full-screen overlay with the brand logo and a scrolling status message.
 * Admin route is exempt so admins can toggle the switch off.
 */
export function MaintenanceOverlay() {
  const get = useServerFn(getSiteSettings);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await get();
        if (!alive) return;
        setOn(s.maintenance_mode);
        setMsg(s.maintenance_message);
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [get]);

  if (!on) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070b14]/95 backdrop-blur-xl">
      <div className="relative mb-8 flex items-center gap-3">
        <div className="h-16 w-16 animate-pulse rounded-2xl brand-gradient shadow-2xl shadow-[var(--brand)]/40" />
        <div className="text-2xl font-extrabold tracking-tight text-white">
          FlashSports <span className="text-[var(--brand)]">HD</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-white/80">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <span className="text-sm font-semibold uppercase tracking-widest text-amber-400">
          Update in progress
        </span>
      </div>

      <div className="relative w-full max-w-md overflow-hidden">
        <div className="whitespace-nowrap text-center text-base text-white/90 marquee">
          {msg || "We are updating the site. Please wait a moment..."}
        </div>
      </div>

      <div className="mt-8 h-1 w-64 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-[loadbar_1.6s_ease-in-out_infinite] rounded-full brand-gradient" />
      </div>

      <p className="mt-6 text-xs text-white/40">Please don't close this window.</p>

      <style>{`
        @keyframes loadbar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .marquee { animation: marquee 12s linear infinite; }
      `}</style>
    </div>
  );
}
