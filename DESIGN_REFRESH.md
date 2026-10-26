# October 2026 design refresh

The home page follows the approved questionnaire: a moderate refresh with a cinematic, edge-to-edge artwork hero; purple accents; near-black surfaces; medium corners; glass controls; and heavy italic headings. The hero contains only its title and Watch/Resume and Add to Planning actions. It advances every eight seconds, temporarily pauses while its controls are hovered or keyboard-focused, and resumes after interaction. Hovering the artwork itself does not stop rotation. Manual dot selection restarts the interval rather than permanently disabling autoplay. Hidden tabs and reduced-motion preferences pause rotation.

## Hero backdrops

Desktop hero artwork prefers TheTVDB Fanart/backgrounds resolved by exact AniList ID through AniZip, sharing the metadata request and cache with title logos. A 1920×1080 background was verified for A Wild Last Boss Appeared! Season 2, whose AniList banner is missing. Loaded images must be at least 1280×720 with a landscape aspect ratio; thin banners, thumbnails, and portrait covers cannot fill the desktop hero. If no suitable landscape is available, the page shows a bounded poster against a gradient instead of stretching it across the screen. Mobile retains portrait artwork appropriate to the narrow display.

Desktop navigation floats at the top, uses accessible icon buttons with tooltips, hides when scrolling down and returns on upward scrolling. On mobile it becomes a bottom bar. Search opens a large panel with keyboard focus containment and Escape dismissal.

Continue Watching appears first, using landscape cards with saved episode numbers and real playback progress when the embedded provider supplies it. Old history without duration/position does not show fabricated progress. The 80% threshold for external watched-episode syncing remains in place.

Latest Episodes uses recent AniList airing schedules for Sub and the existing AsunaTracks timetable/cache for Dub. The language choice persists in local storage. Unmapped dub entries lead to the calendar instead of opening an incorrect anime. Release-source failures are visible with retry and calendar navigation.

Discovery uses horizontal portrait rows (seven posters across on wide desktop, fewer on tablets and mobile), titles below, hover/focus detail hints, and list status menus connected to the existing AniList/MAL sync path. There is no Top Airing side panel. Native scrolling remains available, with scrollbar tracks hidden throughout the first-party app.

## Anime title logos

Hero title artwork is resolved automatically through [AniZip](https://api.ani.zip/mappings?anilist_id=16498), using the exact AniList ID. Its response supplies TheTVDB clearlogos and IMDb mappings. Explicitly English clearlogos are preferred, followed by Metahub's default logo and the remaining TVDB clearlogo. Metahub's English title treatment was verified for Attack on Titan. No API key is required. Artwork coverage and language vary by title, especially for upcoming seasons.

Lookups run only for the active hero, time out after 4.5 seconds, deduplicate requests, cache metadata for seven days, and reuse stale metadata on failure. Candidate image hosts are restricted. Missing images try the next candidate and finally fall back to readable text. Requests omit credentials and user account data.

For a curated override, add approved title artwork under `public/`, then map AniList IDs to paths in `public/anime-logos.json`, for example:

```json
{ "16498": "/logos/attack-on-titan.png" }
```

The default override catalog is empty; automatic sourcing remains active. A configured override takes priority. Clearlogos may identify the overall series when season-specific artwork is unavailable. Source records can mislabel covers as clearlogos: artwork remains hidden until its loaded dimensions confirm a wide title treatment. Square and portrait candidates are rejected, even when labeled Clearlogo. This deliberately favors readable text over uncertain artwork.

## Publishing

The existing `codex/apex-v1-cleanup` branch is linked to the user's Vercel deployment and its configured OAuth callback origin. Pushes update that hosted branch deployment. Keep that callback origin intact when publishing the refresh; moving to a different hostname also requires updating the OAuth app registrations and deployment configuration.

## Library and clearer glass
- My List replaces the external dub-tracker iframe in navigation. Authenticated imports read every provider page without writing to either list. Provider statuses/progress remain independently visible when they differ.
- Local library snapshots are versioned and keyed by provider + verified account ID. They contain anime metadata, status and progress, never OAuth credentials. Disconnect hides the library; reconnect/import retrieves the account's current list. Cross-device durability comes from AniList/MAL themselves; the app cache is device-local, not a new cloud database.
- Status icons: bookmark = Planning, play = Watching, check = Completed, pause = On hold, minus-circle = Dropped. Quick actions update only providers that confirmed success.
- Clearer controls use 5px blur, lighter tint and inset rims, inspired by https://github.com/seunghan91/ios27-design-system/blob/main/packages/tokens/src/materials.json. Existing purple identity retained; reduced-transparency and unsupported-filter fallbacks stay opaque.
- Metadata sources inspected in SeaKit's pinned payload (7a348e76513757447f07107e45d6ee49af5e7c11): MyDubList MAL-ID index for English dub/partial dub; Jikan for explicitly labeled MAL scores. New browser-native implementation; no Seanime runtime copied. Scores requested only for visible cards, deduplicated and serialized with 1.1s gaps, cached 24h with stale fallback. Missing metadata is omitted, never inferred as undubbed or shown as a zero rating. Direct MAL HTML scraping is deliberately avoided.
- Live provider rate-limit handling: imports pace pages, retain visible partial results, cache verified identity in the encrypted session, and retry HTTP 429 failures after 65 seconds. Successful list writes trigger a fresh provider import; MAL-only entries resolve their AniList mapping before cross-provider writes.

## Notifications, Discovery, and watched episodes
- Navigation now includes a compass for Discovery and a bell for real activity. Removed the homepage sync-feedback block. Notification history is capped at 50, saved locally by connected account identity, with unread filtering, mark-all-read, clear, Escape and outside-click dismissal. Provider failures remain explicit in the feed and list details.
- Discovery supports search, multiple genres, start/end years, season, minimum rating, audio, airing state, format and sorting. Desktop sidebar becomes a keyboard-contained mobile sheet. Preferences persist locally; fetches cancel on changed filters/navigation. Counts are loaded matches, not invented global totals. English dub filters use exact MyDubList MAL IDs, including partial dubs; Sub browsing never treats missing dub data as confirmed sub-only availability.
- Primary catalog and ratings: Jikan / MyAnimeList (https://docs.api.jikan.moe/). When unreachable, switch to AniList with an explicit catalog/rating notice and genuine AniList score filters; never relabel AniList ratings as MAL. Stay on the selected fallback catalog during pagination to avoid mixing source pages. Missing IDs stay unmapped until exact lookup.
- EpisodePicker highlights episodes at or below the highest imported watched count for that exact anime, matches AniList/MAL IDs, and shows both source counts. Watched uses a green tint/checkmark; selected uses purple. Choosing an episode does not mark it watched. The existing 80% playback threshold still controls automatic tracking.

## Compact anime detail layout
- Extracted AnimeDetails into a typed component and separate stylesheet. Full-width, quality-checked hero artwork with a modest portrait, real metadata, plain-text synopsis expansion, Continue, and a compact status dropdown replaces the oversized poster/description and duplicated source boxes.
- One playback card selects Sub/Dub and MegaPlay, plays the selected episode, and remembers the audio preference. The existing player, N/B navigation, fullscreen and 80% watch-tracking threshold are preserved.
- Initial episode and Continue use imported progress and unfinished local history, with Watch again for a completed known-length series. Per-provider status/progress labels describe actual imported entries; connected accounts are not falsely labeled synced.
- Watched episode grid and progress meter are separate from selection. Actual related anime and studio/status metadata are rendered without fabricated values. The mobile order places Playback before episodes and keeps Anime info available at the bottom.
- Provider synopsis HTML is converted to plain text before rendering; script/style elements are discarded. No provider HTML is injected into the detail page.

## Personal progress and scoring
- Added the watched/total pencil control beside detail rating/dub badges. Its dialog refreshes the selected entry through authenticated read-only endpoints, accepts explicit watched-count corrections, and edits AniList/MAL personal scores separately. Blank fields preserve scores; explicit 0 clears. MAL requires whole numbers; AniList supports one decimal on a normalized /10 scale.
- AniList imports and individual reads request score(format:POINT_100); writes use scoreRaw (0–100), independent of account display format. MAL scores use 0–10 integers. Community averages are not reused as personal scores. Imported personal ratings appear in My List and beside the detail edit control.
- Automatic tracking remains forward-only and does not alter scores. Explicit editor requests can decrease watched progress. Score-only requests leave progress untouched, preserve each provider's own status, and only update the provider whose score changed. Successful provider responses update the local cache; failures stay visible in the dialog and notifications.
- Removed detail view's shared 100px top offset. Artwork now begins at the viewport top under the floating pill, with internal hero content spacing on desktop and the existing bottom-nav spacing on mobile.
