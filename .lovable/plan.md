## What's broken (root cause)

`src/routes/api/stream/$id/playlist[.]m3u8.ts` runs a silent **fallback** (`fetchFallbackPlaylist`) — if your newly added M3U fails one 3-second fetch, it picks another channel in the same category and plays its stream instead. That's exactly why every new channel ends up showing T-Sport. We will **remove the silent fallback** so each channel only ever plays its own URL (and shows a clear "stream unavailable" message if the URL is bad).

## Plan

### 1. Streaming bug fixes
- Remove auto-fallback from `playlist.m3u8.ts`. Each channel plays only the URL admin entered.
- Raise per-attempt timeout to 6s and do 2 attempts before giving up.
- Player overlay shows "This stream is currently offline — try another source" instead of silently switching.
- Strip URL trimming / whitespace on save in admin so pasted M3U links work first try.

### 2. Player polish
- Start **unmuted** by default. Browsers block autoplay-with-sound on some, so: if blocked, autoplay muted and show a one-tap "Tap to unmute · 🔊" overlay (instead of permanently muted).
- Working **Settings → Quality** menu: Auto, 4K, 1440p, 1080p, 720p, 480p, 360p (only show levels the stream actually has; otherwise show "only Auto available").
- Keep gesture controls; add a small bottom bar (play/pause, mute, quality, fullscreen, rotate).

### 3. Live Match Hero (auto flags + click-to-watch)
- New section at the top: when any World Cup match is **LIVE**, show a big card — Country A flag · `VS` · Country B flag, score, minute, "Tap to Watch" CTA.
- Click → opens player with the stream admin assigned to that match.
- Flags auto-resolve from team name (use Country flag CDN — e.g. `flagcdn.com/w160/{iso}.png`, plus a name→ISO map for the 48 World Cup nations). No manual upload needed.
- When **no match is live**, the card shows the admin-uploaded **"Coming Soon" video** (looping, muted) with overlay text — users still see something engaging.

### 4. Match → stream binding (admin)
- New table `match_streams(match_id, label, stream_url, sort_order, is_active)` — unlimited M3U links per match.
- Admin Matches tab gets:
  - Team A / Team B (country dropdown auto-populates flag preview)
  - League, Kickoff, "Mark Live" toggle
  - **Sources** sub-modal: paste any number of M3U/HLS URLs with labels (SP-1, SP-2, …)
- Public Live Hero uses the first active source; player tabs let user switch.

### 5. Coming-Soon gallery (admin)
- New table `hero_media(id, title, video_url, poster_url, is_active, sort_order)`.
- Admin "Hero Media" tab: add unlimited promo videos (mp4/HLS URL or upload via storage).
- When nothing is live, the hero rotates through active media.

### 6. Channel grid polish
- Logo box becomes square with `object-contain` + soft white pad so any logo (wide or square) shows fully without cropping.
- Bigger touch targets, brand-color highlight on active card.

### 7. Admin upcoming-match editor (the empty "No matches" state)
- Inline "+ Add Match" button right inside the home section when admin is signed in.
- Same form as Admin → Matches, but in a modal — type two country names, see flag preview live, save, and it appears instantly on the home page.

## Technical notes (for reference)

- DB: 2 new tables (`match_streams`, `hero_media`) with grants + RLS (anon SELECT on `match_streams.label/id`, full admin CRUD via server functions).
- Server fns: `listLiveHeroMatch`, `listMatchSources`, `listHeroMedia`, plus admin equivalents.
- New files: `src/components/LiveMatchHero.tsx`, `src/components/FlagBadge.tsx`, `src/lib/countries.ts` (name→ISO map for 48 WC nations), `src/lib/hero.functions.ts`, `src/lib/match-streams.functions.ts`.
- Player: update `src/components/Player.tsx` — unmute-by-default + quality menu binding to `hls.levels`.

Approve this and I'll implement in one pass.