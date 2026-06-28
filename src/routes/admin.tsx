import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  adminListChannels,
  adminSaveChannel,
  adminDeleteChannel,
  adminListMatches,
  adminSaveMatch,
  adminDeleteMatch,
  adminListSources,
  adminSaveSource,
  adminDeleteSource,
  type AdminChannel,
  type AdminSource,
} from "@/lib/admin.functions";
import { getSiteSettings, adminUpdateSiteSettings } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · FlashSports HD" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const status = useServerFn(adminStatus);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    status().then((r) => setAuthed(r.isAdmin)).catch(() => setAuthed(false));
  }, [status]);

  if (authed === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted-foreground)]">Loading…</div>;
  }
  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;
  return <AdminDashboard onLogout={() => setAuthed(false)} />;
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await login({ data: { password: pw } });
      if (r.ok) onSuccess();
      else setErr("Incorrect password");
    } catch {
      setErr("Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-md brand-gradient" />
          <div>
            <div className="text-base font-bold">Admin Access</div>
            <div className="text-xs text-[var(--muted-foreground)]">FlashSports HD control panel</div>
          </div>
        </div>
        <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Password</label>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        />
        {err && <p className="mt-2 text-xs text-[var(--destructive)]">{err}</p>}
        <button
          disabled={busy || !pw}
          className="brand-gradient mt-4 w-full rounded-md px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

type Tab = "channels" | "matches" | "hero" | "settings";

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("channels");
  const logout = useServerFn(adminLogout);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">FlashSports HD — Admin</div>
          <div className="text-xs text-[var(--muted-foreground)]">Manage channels, schedules, stream sources</div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface)]">
            View site
          </a>
          <button
            onClick={async () => {
              await logout();
              onLogout();
            }}
            className="rounded-md bg-[var(--destructive)] px-3 py-1.5 text-xs font-medium text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {(["channels", "matches", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${
              tab === t ? "brand-gradient text-black" : "text-[var(--muted-foreground)] hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "channels" ? <ChannelsTab /> : tab === "matches" ? <MatchesTab /> : <SettingsTab />}
    </div>
  );
}

function SettingsTab() {
  const get = useServerFn(getSiteSettings);
  const save = useServerFn(adminUpdateSiteSettings);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    get().then((s) => {
      setOn(s.maintenance_mode);
      setMsg(s.maintenance_message);
      setLoaded(true);
    });
  }, [get]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const s = await save({ data: { maintenance_mode: on, maintenance_message: msg } });
      setOn(s.maintenance_mode);
      setMsg(s.maintenance_message);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="text-sm text-[var(--muted-foreground)]">Loading…</div>;

  return (
    <form onSubmit={submit} className="max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4">
        <div className="text-base font-bold">Site Maintenance Mode</div>
        <div className="mt-1 text-xs text-[var(--muted-foreground)]">
          When ON, visitors see a full-screen overlay with the logo and scrolling status message. Admin panel stays accessible.
        </div>
      </div>

      <label className="mb-4 flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-black/20 p-3">
        <div>
          <div className="text-sm font-semibold">Show maintenance overlay</div>
          <div className="text-xs text-[var(--muted-foreground)]">Visitors will see "Update in progress"</div>
        </div>
        <button
          type="button"
          onClick={() => setOn((v) => !v)}
          className={`relative h-7 w-12 rounded-full transition ${on ? "bg-[var(--brand)]" : "bg-white/15"}`}
          aria-pressed={on}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </label>

      <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Status message (scrolls under the logo)</label>
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        maxLength={300}
        placeholder="Updating channels…"
        className="mb-4 w-full rounded-md border border-[var(--border)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md brand-gradient px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs font-medium text-emerald-400">✓ Saved</span>}
      </div>
    </form>
  );
}

function ChannelsTab() {
  const list = useServerFn(adminListChannels);
  const save = useServerFn(adminSaveChannel);
  const del = useServerFn(adminDeleteChannel);
  const [items, setItems] = useState<AdminChannel[]>([]);
  const [editing, setEditing] = useState<Partial<AdminChannel> | null>(null);
  const [sourcesFor, setSourcesFor] = useState<AdminChannel | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await list();
    setItems(r);
    setLoading(false);
  }, [list]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startNew = () =>
    setEditing({
      name: "",
      stream_url: "",
      logo_url: "",
      category: "sports",
      sort_order: items.length,
      is_active: true,
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-[var(--muted-foreground)]">
          Total: <b className="text-foreground">{items.length}</b> channels
        </div>
        <button
          onClick={startNew}
          className="brand-gradient rounded-md px-3 py-1.5 text-sm font-semibold text-black"
        >
          + Add Channel
        </button>
      </div>

      {loading && <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">Loading…</div>}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Logo</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Stream URL (Source)</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{c.sort_order}</td>
                <td className="px-3 py-2">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[var(--surface-elevated)]" />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-xs">{c.category}</td>
                <td className="px-3 py-2">
                  <code className="block max-w-[420px] truncate rounded bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
                    {c.stream_url}
                  </code>
                </td>
                <td className="px-3 py-2 text-xs">{c.is_active ? "✅" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setSourcesFor(c)}
                    className="mr-1 rounded border border-[var(--brand)]/40 px-2 py-1 text-xs text-[var(--brand)] hover:bg-[var(--brand)]/10"
                    title="Manage SP-1, SP-2, Server 1..."
                  >
                    Sources
                  </button>
                  <button
                    onClick={() => setEditing(c)}
                    className="mr-1 rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${c.name}?`)) return;
                      await del({ data: { id: c.id } });
                      refresh();
                    }}
                    className="rounded bg-[var(--destructive)] px-2 py-1 text-xs text-white"
                  >
                    Del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ChannelModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await save({ data });
            setEditing(null);
            refresh();
          }}
        />
      )}

      {sourcesFor && (
        <SourcesModal channel={sourcesFor} onClose={() => setSourcesFor(null)} />
      )}
    </div>
  );
}

function SourcesModal({ channel, onClose }: { channel: AdminChannel; onClose: () => void }) {
  const list = useServerFn(adminListSources);
  const save = useServerFn(adminSaveSource);
  const del = useServerFn(adminDeleteSource);
  const [items, setItems] = useState<AdminSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AdminSource> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await list({ data: { channel_id: channel.id } });
    setItems(r);
    setLoading(false);
  }, [list, channel.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Stream Sources — {channel.name}</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              Add unlimited servers (SP-1, SP-2, Server 1...) — viewers can switch inside the player.
            </div>
          </div>
          <button
            onClick={() => setEditing({
              channel_id: channel.id,
              label: `SP-${items.length + 1}`,
              stream_url: "",
              sort_order: items.length,
              is_active: true,
            })}
            className="brand-gradient rounded-md px-3 py-1.5 text-sm font-semibold text-black"
          >
            + Add Source
          </button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] py-6 text-center text-sm text-[var(--muted-foreground)]">
            No sources yet. Add SP-1, SP-2, Server 1 etc.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Label</th>
                  <th className="px-3 py-2 text-left">Stream URL</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{s.sort_order}</td>
                    <td className="px-3 py-2 font-semibold">{s.label}</td>
                    <td className="px-3 py-2">
                      <code className="block max-w-[300px] truncate rounded bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
                        {s.stream_url}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-xs">{s.is_active ? "✅" : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditing(s)} className="mr-1 rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-elevated)]">Edit</button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete ${s.label}?`)) return;
                          await del({ data: { id: s.id } });
                          refresh();
                        }}
                        className="rounded bg-[var(--destructive)] px-2 py-1 text-xs text-white"
                      >Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">Close</button>
        </div>

        {editing && (
          <SourceEditor
            initial={editing}
            onClose={() => setEditing(null)}
            onSave={async (data) => {
              await save({ data });
              setEditing(null);
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function SourceEditor({
  initial, onClose, onSave,
}: { initial: Partial<AdminSource>; onClose: () => void; onSave: (d: any) => Promise<void> }) {
  const [f, setF] = useState({
    id: initial.id,
    channel_id: initial.channel_id!,
    label: initial.label ?? "",
    stream_url: initial.stream_url ?? "",
    sort_order: initial.sort_order ?? 0,
    is_active: initial.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 text-base font-semibold">{f.id ? "Edit Source" : "Add Source"}</div>
        <div className="space-y-3">
          <Field label="Label (SP-1, SP-2, Server 1, etc.)">
            <input className={inp} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          </Field>
          <Field label="Stream URL (m3u8)">
            <input className={inp} value={f.stream_url} onChange={(e) => setF({ ...f, stream_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort Order">
              <input type="number" className={inp} value={f.sort_order}
                onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) || 0 })} />
            </Field>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
              Active
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">Cancel</button>
          <button
            disabled={busy || !f.label || !f.stream_url}
            onClick={async () => {
              setBusy(true);
              try { await onSave(f); } finally { setBusy(false); }
            }}
            className="brand-gradient rounded-md px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          >{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function ChannelModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<AdminChannel>;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [f, setF] = useState({
    id: initial.id,
    name: initial.name ?? "",
    stream_url: initial.stream_url ?? "",
    logo_url: initial.logo_url ?? "",
    category: initial.category ?? "sports",
    sort_order: initial.sort_order ?? 0,
    is_active: initial.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 text-base font-semibold">{f.id ? "Edit Channel" : "Add Channel"}</div>
        <div className="space-y-3">
          <Field label="Name">
            <input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Stream URL (m3u8)">
            <input className={inp} value={f.stream_url} onChange={(e) => setF({ ...f, stream_url: e.target.value })} />
          </Field>
          <Field label="Logo URL">
            <input className={inp} value={f.logo_url ?? ""} onChange={(e) => setF({ ...f, logo_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                className={inp}
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })}
              >
                <option value="sports">sports</option>
                <option value="news">news</option>
                <option value="entertainment">entertainment</option>
                <option value="movies">movies</option>
                <option value="kids">kids</option>
              </select>
            </Field>
            <Field label="Sort Order">
              <input
                type="number"
                className={inp}
                value={f.sort_order}
                onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.is_active}
              onChange={(e) => setF({ ...f, is_active: e.target.checked })}
            />
            Active (visible on site)
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            disabled={busy || !f.name || !f.stream_url}
            onClick={async () => {
              setBusy(true);
              try {
                const payload: any = { ...f };
                if (!payload.logo_url) payload.logo_url = null;
                await onSave(payload);
              } finally {
                setBusy(false);
              }
            }}
            className="brand-gradient rounded-md px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchesTab() {
  const list = useServerFn(adminListMatches);
  const listChAdmin = useServerFn(adminListChannels);
  const save = useServerFn(adminSaveMatch);
  const del = useServerFn(adminDeleteMatch);
  const [items, setItems] = useState<any[]>([]);
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const refresh = useCallback(async () => {
    const [m, c] = await Promise.all([list(), listChAdmin()]);
    setItems(m);
    setChannels(c);
  }, [list, listChAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startNew = () =>
    setEditing({
      title: "",
      team_a: "",
      team_b: "",
      league: "",
      channel_id: channels[0]?.id ?? null,
      start_time: new Date().toISOString().slice(0, 16),
      is_live: false,
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-[var(--muted-foreground)]">
          Total: <b className="text-foreground">{items.length}</b> matches
        </div>
        <button onClick={startNew} className="brand-gradient rounded-md px-3 py-1.5 text-sm font-semibold text-black">
          + Add Match
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2 text-left">Title / Teams</th>
              <th className="px-3 py-2 text-left">League</th>
              <th className="px-3 py-2 text-left">Channel</th>
              <th className="px-3 py-2 text-left">Start</th>
              <th className="px-3 py-2 text-left">Live</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const ch = channels.find((c) => c.id === m.channel_id);
              return (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">
                    {m.team_a && m.team_b ? `${m.team_a} vs ${m.team_b}` : m.title}
                  </td>
                  <td className="px-3 py-2 text-xs">{m.league}</td>
                  <td className="px-3 py-2 text-xs">{ch?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{new Date(m.start_time).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{m.is_live ? "🔴" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing({ ...m, start_time: m.start_time.slice(0, 16) })}
                      className="mr-1 rounded border border-[var(--border)] px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete match?")) return;
                        await del({ data: { id: m.id } });
                        refresh();
                      }}
                      className="rounded bg-[var(--destructive)] px-2 py-1 text-xs text-white"
                    >
                      Del
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
                  No matches scheduled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <MatchModal
          initial={editing}
          channels={channels}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await save({ data });
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MatchModal({
  initial,
  channels,
  onClose,
  onSave,
}: {
  initial: any;
  channels: AdminChannel[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [f, setF] = useState({
    id: initial.id,
    title: initial.title ?? "",
    team_a: initial.team_a ?? "",
    team_b: initial.team_b ?? "",
    league: initial.league ?? "",
    channel_id: initial.channel_id ?? null,
    start_time: initial.start_time ?? new Date().toISOString().slice(0, 16),
    is_live: !!initial.is_live,
  });
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 text-base font-semibold">{f.id ? "Edit Match" : "Add Match"}</div>
        <div className="space-y-3">
          <Field label="Title (fallback if no teams)">
            <input className={inp} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team A"><input className={inp} value={f.team_a} onChange={(e) => setF({ ...f, team_a: e.target.value })} /></Field>
            <Field label="Team B"><input className={inp} value={f.team_b} onChange={(e) => setF({ ...f, team_b: e.target.value })} /></Field>
          </div>
          <Field label="League">
            <input className={inp} value={f.league} onChange={(e) => setF({ ...f, league: e.target.value })} />
          </Field>
          <Field label="Channel">
            <select
              className={inp}
              value={f.channel_id ?? ""}
              onChange={(e) => setF({ ...f, channel_id: e.target.value || null })}
            >
              <option value="">— None —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Start time (local)">
            <input
              type="datetime-local"
              className={inp}
              value={typeof f.start_time === "string" ? f.start_time.slice(0, 16) : ""}
              onChange={(e) => setF({ ...f, start_time: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.is_live} onChange={(e) => setF({ ...f, is_live: e.target.checked })} />
            Mark as live
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">Cancel</button>
          <button
            disabled={busy || !f.title || !f.start_time}
            onClick={async () => {
              setBusy(true);
              try {
                const payload = {
                  ...f,
                  start_time: new Date(f.start_time).toISOString(),
                  team_a: f.team_a || null,
                  team_b: f.team_b || null,
                  league: f.league || null,
                  channel_id: f.channel_id || null,
                };
                await onSave(payload);
              } finally {
                setBusy(false);
              }
            }}
            className="brand-gradient rounded-md px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}
