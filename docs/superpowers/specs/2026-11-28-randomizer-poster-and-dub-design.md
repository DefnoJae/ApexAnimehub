# Randomizer Poster, Dub Badge, and Glow Design

## Intent

The My List random picker should feel more poster-led when a pick lands. The
user asked for a larger poster, no `Tonight, watch` label at the top, a dub
badge beside the rating with a dot separator, and a blurred glow that uses the
poster's own colors. The spin animation must stay exactly as it is.

## Goals

- Give the picked poster more of the modal: visibly larger on desktop and mobile.
- Remove the `Tonight, watch` heading; keep the close button in the top-right.
- Show a small `Dub` badge after the rating, separated by ` · `, when the
  selected anime has an English dub in the existing MyDubList index.
- Add a soft blurred halo behind the poster that takes its colors from the
  poster image itself.

## Non-Goals

- Do not change the spin animation, timing, flicker keyframes, or selection logic.
- Do not change Play / Details / Spin again behavior or focus handling.
- Do not change account/API routing or add playback requests.
- Do not add a new dependency or a server-side color service.

## Constraints

- The existing dub source is `getDubIndex()` from `src/utils/animeMetadata.ts`,
  cached in localStorage for 24 hours and already used by `AnimeBadges`.
- `LibraryAnime` has `idMal` and `coverImage.extraLarge`, but no poster color
  field; a canvas color extraction would need CORS and extra code.
- The badge must be visible text `Dub`, separated from the rating by ` · `.
- CSS-only sizing keeps the change local to `src/components/dashboard.css`.

## Approaches

1. **Poster size** — (a) raise the CSS height cap and let flex layout keep the
   actions visible; (b) rebuild the modal as a grid/reflow. Chosen (a): the
   existing modal already scrolls on short viewports, so a height change is
   enough and touches no behavior.
2. **Glow** — (a) duplicate the same poster URL as a blurred CSS background
   behind the card; (b) extract a dominant color with canvas; (c) use a static
   purple glow. Chosen (a): it uses the poster's real colors, needs no CORS or
   new asset, and reuses the already-loaded image URL. (b) adds failure modes;
   (c) does not meet the request.
3. **Dub badge** — (a) read the cached MyDubList index by `idMal`; (b) query
   per-title episode availability. Chosen (a): no per-pick playback request and
   the same source already powers dub badges elsewhere. It may fetch the index
   once when it is not cached.

## Design

- Remove the `<h1 className="random-picker-tag">` element; keep
  `.random-picker-header` for the close button only.
- Raise the poster height from `min(32vh, 360px)` to `min(42vh, 440px)` on
  desktop and from `min(38vh, 320px)` to `min(46vh, 380px)` on small screens;
  reduce the top gap because the heading is gone.
- Wrap the poster in a frame containing an aria-hidden glow layer whose inline
  `backgroundImage` is the selected poster URL, blurred and saturated in CSS.
- Append a ` · ` separator and a compact `Dub` pill to the existing metadata
  line when `getDubIndex()` reports the selected `idMal` as dubbed or partial.
- Leave every spin-related class, keyframe, hook, and state transition untouched.
