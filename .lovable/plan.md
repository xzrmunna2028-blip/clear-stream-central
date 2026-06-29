## Goal
Restructure the home page around admin-managed matches. Each match owns its team flags, status, scheduled time, server list (M3U), and an optional "Coming Soon" promo. Tabs filter by status. Live matches open the player with server pills; upcoming matches open the promo video + marquee.

## UI Changes

**Home (`src/routes/index.tsx`)**
- Remove the `LiveMatchHero` floating card and the standalone `MatchSchedule` row.
- Keep header + player area, but the player only mounts when the user picks a match/channel.
- Promote `WorldCupSection` to the primary list. Replace its empty state with admin matches when API has none, and merge admin matches into the same grid so everything (live/upcoming/completed) shows here.

**Match card (in `WorldCupSection`)**
- Flag chip next to each team name (use `team_a_iso` / `team_b_iso` → `https://flagcdn.com/w40/{iso}.png`).
- Date + time row.
- Corner badge: red pulsing "LIVE" when `is_live`, gold "UPCOMING", grey "COMPLETED".
- Click → opens player view inline.

**Player view**
- Live match → `Player` with server pills (from `match_streams`); first stream auto-plays, click another pill to switch.
- Upcoming match → render `<video>` with `hero_media.video_url` (first active) + marquee text below.
- Completed → show "Match ended" panel.

**Tabs (Live / Today / Upcoming / Recent / Completed / All)**
- Compute bucket per admin match using `is_live` + `start_time` (today = same calendar day; recent = last 24h ended; completed = past + not live).
- WorldCup API matches keep their existing bucket logic; merge both sources in each tab.

## Backend / Schema

- `site_settings`: add `marquee_text TEXT NOT NULL DEFAULT ''` (editable in admin Settings tab).
- Existing tables already cover the rest: `matches` (teams, ISOs, start_time, is_live), `match_streams` (server name + M3U), `hero_media` (promo video).
- Add `getMarqueeText` to `site-settings.functions.ts` and admin setter.
- Add public `listMatchStreamsForMatch(matchId)` and `listHeroMedia()` (already exist as `listMatchStreams` / `listHeroMedia` — reuse).

## Admin Panel
Already supports matches CRUD, per-match streams modal, hero media tab, settings. Add marquee text field to Settings tab.

## Files Touched
- `src/routes/index.tsx` — remove hero/schedule, wire match→player.
- `src/components/WorldCupSection.tsx` — merge admin matches, new card design w/ flags + status badges + click handler.
- New `src/components/MatchPlayerView.tsx` — player + server pills OR promo video + marquee.
- `src/lib/site-settings.functions.ts` — marquee getter/setter.
- `src/routes/admin.tsx` — marquee input in Settings tab.
- Migration: add `marquee_text` column.

## Out of Scope
Player internals (HLS, gestures, quality) — already built and unchanged.
