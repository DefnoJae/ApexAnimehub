# Ani.pm episode overlay — design

## Intent

Add an **Episodes** button to the Ani.pm player header, immediately to the left of `SignSync`.
Clicking it opens the same scrollable episode carousel Apex Player uses. Choosing an episode
changes the route so the existing Ani.pm SDK instance loads that episode in place.

## Goals

- Pixel/behavior parity with Apex Player's episode overlay: same `PlayerEpisodeCarousel`,
  same `apexPlayer.css` carousel styles, same metadata, same watched markers, same wheel /
  arrow / focus behavior.
- Header order becomes: title, **Episodes**, `SignSync`, fullscreen, close.
- Selecting an episode flushes current progress, closes the overlay, and calls
  `onEpisodeChange(number, audio)` so the existing `player.loadEpisode` effect handles the
  switch without remounting the iframe.
- Resume prompt, fullscreen control, SDK cleanup, and route-driven episode changes remain
  unchanged.

## Non-goals

- No redesign of the carousel or a second visual language for Ani.pm.
- No new dependencies, no changes to the AniList/MAL rate-limit work, no deploy or push.
- No change to which playback source is used; this only affects the Ani.pm player.

## Approaches

1. **Reuse the exact carousel (chosen).** Add the header button to `AniPmPlayer.tsx`, import
   `apexPlayer.css`, render `PlayerEpisodeCarousel` over the Ani.pm stage, and pass the
   same metadata/number/watched props `NativeVideoPlayer` uses. User chose this for a
   faithful recreation.
2. Build an Ani.pm-specific overlay. More isolated, but a second implementation would drift
   from Apex Player and was rejected.

## Decisions

- `AniPmPlayer.tsx` imports `./apexPlayer.css` after `./nativeVideoPlayer.css`. The broad
  `.apex-cinema` rules do not match the Ani.pm root (`apex-native-player anipm-player`), so
  only the `.apex-player-episodes` / `.apex-carousel-*` overlay rules affect Ani.pm.
- State: one `episodesOpen` boolean plus an `episodes` metadata record; no general menu
  system is needed because Ani.pm has only this overlay.
- Metadata uses the existing `fetchEpisodeMetadata(id, props.episodeCount)` on
  `[id, props.episodeCount]`, matching Apex Player. Results are cached by the utility.
- Episode numbers use the same formula as Apex Player:
  `props.episodeCount || Math.max(episode, ...Object.keys(episodes).map(Number))`, capped at
  `2000`.
- The button uses the existing `ListVideo` icon and `.player-header-icon` styling, with
  `aria-label="Episodes"` and `title="Episodes"`.
- The overlay is rendered inside the player dialog so its absolute positioning and blur sit
  over the embedded player, not over the whole page.
- `watchedThrough` comes from `props.watchedThrough`; the carousel's current `episode` comes
  from `playingEntry.episode`, which is initialized from the parsed Ani.pm stream identity
  and updated by SDK state changes, so the carousel centers on the episode actually loaded.
- The close path mirrors Apex Player: the carousel's X button and `Escape` / `X` close it
  and return focus to the player dialog. `usePlayerKeyboard` already ignores keys targeted
  inside `.apex-player-episodes`, so overlay arrow keys do not seek the video.
- Before `onEpisodeChange`, the latest `{ episode, position, duration }` is saved with
  `saveEpisodeProgress` and reported through `onProgress`, equivalent to Apex Player's
  `persist(true)`.
- The selected audio is the SDK's current language (`playingEntry.lang`) when known,
  falling back to the language parsed from the Ani.pm URL.
- The resume prompt remains authoritative. The overlay can be opened before a start choice
  is made; selecting an episode updates the route, and playback still waits for the user's
  Continue / Restart choice.

## Tests

- Extend `src/components/AniPmPlayer.test.tsx` with mocked `fetchEpisodeMetadata`:
  - Episodes button is immediately before `SignSync` and opens the carousel with numbered,
    titled and watched episode cards.
  - X and `Escape` close the overlay and restore focus to the player dialog.
  - Clicking an episode flushes progress, calls `onEpisodeChange(number, audio)`, closes the
    overlay, and a subsequent route/prop change makes the existing SDK instance call
    `loadEpisode` for that episode.
  - Existing resume-prompt and SDK cleanup tests still pass.
- Run `npm run test:ci`, `npm run test:server`, `npm run typecheck`, and `npm run build`.
- Do not push or deploy unless explicitly requested.
