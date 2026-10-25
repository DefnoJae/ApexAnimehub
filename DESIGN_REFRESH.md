# October 2026 design refresh

The home page follows the approved questionnaire: a moderate refresh with a cinematic, edge-to-edge artwork hero; purple accents; near-black surfaces; medium corners; glass controls; and heavy italic headings. The hero contains only its title and Watch/Resume and Add to Planning actions. It rotates automatically, pauses on hover/focus, stops after manual slide selection, and respects reduced-motion preferences.

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

The default override catalog is empty; automatic sourcing remains active. A configured override takes priority. Clearlogos may identify the overall series when season-specific artwork is unavailable.

## Publishing

The existing `codex/apex-v1-cleanup` branch is linked to the user's Vercel deployment and its configured OAuth callback origin. Pushes update that hosted branch deployment. Keep that callback origin intact when publishing the refresh; moving to a different hostname also requires updating the OAuth app registrations and deployment configuration.
