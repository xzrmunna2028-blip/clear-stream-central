// Real-time FIFA World Cup 2026 widgets (external image endpoints).
const TZ = "Asia/Dhaka";

const WIDGETS: Array<{ label: string; url: string; wide?: boolean }> = [
  { label: "Countdown", url: `https://wc26-widget.vercel.app/countdown?tz=${TZ}`, wide: true },
  { label: "Live Match", url: `https://wc26-widget.vercel.app/match?tz=${TZ}`, wide: true },
  { label: "Today's Fixtures", url: `https://wc26-widget.vercel.app/today?tz=${TZ}`, wide: true },
  { label: "Team USA", url: `https://wc26-widget.vercel.app/team?id=USA&tz=${TZ}` },
  { label: "Group E", url: "https://wc26-widget.vercel.app/group?id=E" },
  { label: "Round of 32", url: "https://wc26-widget.vercel.app/r32", wide: true },
  { label: "Knockout Bracket", url: "https://wc26-widget.vercel.app/bracket", wide: true },
];

export function WorldCupWidgets() {
  return (
    <section aria-label="World Cup 2026 widgets" className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded bg-[var(--brand)]" />
        <h2 className="text-lg font-bold tracking-tight">FIFA World Cup 2026 · Live Widgets</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WIDGETS.map((w) => (
          <div
            key={w.label}
            className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 ${
              w.wide ? "sm:col-span-2 lg:col-span-3" : ""
            }`}
          >
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {w.label}
            </div>
            <img
              src={w.url}
              alt={`${w.label} — FIFA World Cup 2026`}
              loading="lazy"
              className="mx-auto block h-auto w-full max-w-full rounded-lg"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
