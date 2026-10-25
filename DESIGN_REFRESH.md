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
