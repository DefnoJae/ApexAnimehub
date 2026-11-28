# My List — Random Anime Picker (short design)

## Intent

Add a dice button beside the sort dropdown in My List. Clicking it opens a
centered, cinema-style recommendation overlay that spins through the posters in
the list the user currently has open (Planning, Watching, Completed, etc.),
then settles on one pick. The user wanted a polished, premium feel matching a
provided reference image, and explicitly required that the feature **not use
AniList tokens or cause rate limiting**.

## Goals

- Dice button immediately right of the sort dropdown.
- Overlay with a light translucent blurred backdrop; the card is the focus.
- Card matches the supplied description: ~35% viewport width / ~55% viewport
  height, 28–32px radius, near-black navy `#0B1020`, subtle top-center golden
  glow, centered amber `Tonight, watch` heading, large poster, bold title,
  metadata row, three pill buttons.
- During the spin, different posters from the open list actually flash by,
  then the animation settles on one random pick.
- Metadata row reads `<TYPE> · <YEAR> · ★ <SCORE>`, where `<TYPE>` is the
  anime's format (`TV`, `Movie`, `TV Short`, `OVA`, `ONA`, `Special`) instead
  of the word "Anime". Score is on a 10-point scale.
- Buttons: white primary `Play`, dark secondary `Details` and `Spin again`.
- No new API requests of any kind from the picker.

## Non-goals / anti-goals

- No AniList/MAL token use, no fresh queries, no Jikan calls, no retry loops.
- No changes to the existing sort dropdown, status filters, or card overlays.
- No global picker state; My List is the only caller.
- No autoplay without an explicit user click.

## Approaches considered

1. **Feed the overlay the already-filtered in-memory list.** Chosen. It is the
   only approach that satisfies the zero-request constraint and reuses the
   cards already on screen, including the current status/provider/search
   filters. Cost: metadata is limited to what the existing list query carries,
   so `format` and `startYear` must be added to that query's selected fields.
2. **Fetch a random anime from AniList on click.** Rejected: spends tokens and
   can rate-limit, the exact thing the user ruled out.
3. **Shared picker context/service.** Rejected for now: no second caller, so it
   adds indirection without benefit.

## Decisions (builder's calls)

- **Data source:** pass My List's `unique` array (the de-duplicated, filtered
  list already computed for the grid) into the overlay. This automatically
  makes it respect the open status tab, provider, and search box.
- **Metadata fields:** add `format` and `startDate{year}` to the *existing*
  AniList `LIST_QUERY` in both `src/utils/sync/anilistList.ts` and
  `server/list.cjs`, and add matching optional `format` / `startYear` to
  `LibraryAnime`. This changes no request count; it only adds fields to a
  request the list already makes. MAL's list endpoint does not supply these
  fields, so unknown values are omitted from the metadata row rather than
  guessed.
- **Format label:** map AniList enum values to readable labels
  (`TV_SHORT` → `TV Short`, `MOVIE` → `Movie`, `OVA`, `ONA`, `SPECIAL` →
  `Special`, `TV` → `TV`), falling back to the raw value.
- **Score:** divide AniList's 0–100 `averageScore` by 10, render one decimal
  place. Omit the score segment when unknown.
- **Spin animation:** a timer swaps the displayed poster every ~120ms for
  ~2.2s, then picks a random item from the filtered list and stops. Reduced
  motion skips the flashing and settles immediately.
- **Actions:** `Play` calls the existing `onSelect` (opens the anime/player),
  `Details` calls the same `onSelect` path used by a card click, `Spin again`
  restarts the animation. Close via the X button or backdrop click.
- **Empty/invalid list:** the dice button is disabled; the overlay renders
  nothing if it somehow receives no usable entries.
- **Styling:** new CSS in `src/components/dashboard.css`, scoped to
  `.random-picker-*` so nothing else is affected.

## What is left to the builder

- Fix the spin to display `filtered[spinIndex]` while spinning.
- Fix score scaling and add the year/format fields end to end.
- Style the dice button and the overlay per the description above.
- Update tests, run typecheck / test:ci / build, then ask before pushing or
  deploying.
