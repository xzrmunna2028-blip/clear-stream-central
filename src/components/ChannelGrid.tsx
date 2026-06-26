import { useMemo, useState } from "react";
import type { PublicChannel } from "@/lib/channels.functions";

type Props = {
  channels: PublicChannel[];
  activeId: string | null;
  onPick: (c: PublicChannel) => void;
};

const CATS = [
  { id: "all", label: "All" },
  { id: "sports", label: "Sports" },
  { id: "news", label: "News" },
  { id: "entertainment", label: "Entertainment" },
];

export function ChannelGrid({ channels, activeId, onPick }: Props) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    return channels.filter((c) => {
      if (cat !== "all" && c.category !== cat) return false;
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [channels, cat, q]);

  return (
    <section aria-label="Channels">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                cat === c.id
                  ? "brand-gradient text-black"
                  : "bg-[var(--surface)] text-foreground hover:bg-[var(--surface-elevated)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex-1 sm:max-w-xs">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search channels..."
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--brand)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {visible.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition ${
                active
                  ? "border-[var(--brand)] bg-[var(--surface-elevated)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/60 hover:bg-[var(--surface-elevated)]"
              }`}
            >
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logo_url}
                    alt={c.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                    {c.name.slice(0, 3)}
                  </span>
                )}
              </div>
              <span className="line-clamp-1 text-xs font-medium">{c.name}</span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-[var(--muted-foreground)]">
            No channels found.
          </div>
        )}
      </div>
    </section>
  );
}
