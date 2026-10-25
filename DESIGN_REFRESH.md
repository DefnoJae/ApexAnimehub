# October 2026 design refresh

The home page follows the approved questionnaire: a moderate refresh with a cinematic, edge-to-edge artwork hero; purple accents; near-black surfaces; medium corners; glass controls; and heavy italic headings. The hero contains only its title and Watch/Resume and Add to Planning actions. It rotates automatically, pauses on hover/focus, stops after manual slide selection, and respects reduced-motion preferences.

Desktop navigation floats at the top, uses accessible icon buttons with tooltips, hides when scrolling down and returns on upward scrolling. On mobile it becomes a bottom bar. Search opens a large panel with keyboard focus containment and Escape dismissal.

Continue Watching appears first, using landscape cards with saved episode numbers and real playback progress when the embedded provider supplies it. Old history without duration/position does not show fabricated progress. The 80% threshold for external watched-episode syncing remains in place.

Latest Episodes uses recent AniList airing schedules for Sub and the existing AsunaTracks timetable/cache for Dub. The language choice persists in local storage. Unmapped dub entries lead to the calendar instead of opening an incorrect anime. Release-source failures are visible with retry and calendar navigation.

Discovery uses horizontal portrait rows (seven posters across on wide desktop, fewer on tablets and mobile), titles below, hover/focus detail hints, and list status menus connected to the existing AniList/MAL sync path. There is no Top Airing side panel. Native scrolling remains available, with scrollbar tracks hidden throughout the first-party app.

## Optional anime title logos

AniList does not supply transparent title logos. Add approved title artwork under `public/`, then map AniList IDs to paths in `public/anime-logos.json`, for example:

```json
{ "16498": "/logos/attack-on-titan.png" }
```

The default catalog is empty. Missing or failed logo images fall back to readable italic title text. No third-party API key is required.

## Publishing

The existing `codex/apex-v1-cleanup` branch is linked to the user's Vercel deployment and its configured OAuth callback origin. Pushes update that hosted branch deployment. Keep that callback origin intact when publishing the refresh; moving to a different hostname also requires updating the OAuth app registrations and deployment configuration.
