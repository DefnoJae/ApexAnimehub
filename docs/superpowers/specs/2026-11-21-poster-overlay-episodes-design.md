# Poster overlay with total episodes — design

## Intent

Discovery posters show the title and metadata over the artwork. The detail page's catalog
posters ("Related" and "More Like This") show the title *under* the artwork instead. Make
the detail catalog posters use the same overlay treatment, and show the anime's **total
planned episode count** in the metadata line in both places.

## Goals

- A single shared caption component renders title + year + type (+ episodes) over the poster
  in discovery, Related, and More Like This.
- Metadata line format: `2009 · TV · 175eps` — the original discovery caption's spaced centered dot between each part, now extended to the total.
- Episode count comes from AniList's `episodes` field (total planned), never from
  `nextAiringEpisode.episode` (aired so far).
- Detail cards no longer repeat the title under the poster; badges remain beneath it.

## Non-goals

- No changes to playback, list status, filtering, or the home dashboard rows.
- No change to how aired/progress episode counts are displayed elsewhere.
- No new dependencies.

## Constraints / findings

- `episodes` is already present on `ListAnime`, on `DiscoveryAnime`, and on both
  recommendation and relation nodes in `detailQuery.ts`.
- The recommendation and relation selections in `detailQuery.ts` do **not** request
  `seasonYear` or `format`; these must be added so the overlay can show year and type.
- Discovery titles come from `anime.year` / `anime.format`; detail items will supply the
  same values via `seasonYear` / `format` mapped into the shared component's props.
- Clicking the poster must still open the anime; the caption is non-interactive and sits
  above the existing `.poster-open` button (CSS `pointer-events: none`).

## Approaches

1. **Shared `PosterCaption` component (chosen).** Extract the discovery caption markup and
   styles into one component + stylesheet, used by discovery and the detail catalog grid.
   Trades a slightly wider diff for one source of truth; user chose this.
2. Detail-only duplicate markup/CSS. Smaller diff, but two copies to keep in sync — rejected.
3. Keep the title below the poster and append metadata there. Does not satisfy the overlay
   request — rejected.

## Decisions (builder's calls where not specified)

- New `src/components/PosterCaption.tsx` exports `PosterCaption` and a pure
  `posterMeta({ year, format, episodes })` formatter. The formatter joins non-empty parts
  with the original discovery separator, a spaced centered dot: `2009 · TV · 175eps`; uses
  `TBA` for a missing year; omits an empty format; omits
  the episode chunk unless `episodes` is a positive finite integer.
- Caption markup: `<div className="poster-caption"><strong>{title}</strong><small>{meta}</small></div>`.
- Styles move from `.discovery-poster-caption` in `discovery.css` into a new
  `posterCaption.css` imported by the component; the old selector is removed rather than
  left as a dead duplicate.
- `AnimeDetails.tsx` removes the under-poster `small` label and `poster-title` button from
  the catalog cards, keeps `AnimeBadges` beneath the poster, and renders `PosterCaption`
  inside `.poster-art`.
- `detailQuery.ts`: add `seasonYear format` to both `recommendations.nodes.mediaRecommendation`
  and `relations.edges.node`; extend the related/recommendation item types in
  `AnimeDetails.tsx` with `seasonYear?: number` and `format?: string`.
- Tests: formatter unit tests (including unknown totals and airing anime with a
  `nextAiringEpisode` but a known total) and a render test that the detail catalog card
  contains the overlay and no separate title button.

## What's left to the builder

Follow the repo's existing TDD workflow, run all gates (`test:ci`, `test:server`,
`typecheck`, `build`), commit only the files for this change, push, then deploy **both**
the `apexanime-backup` Worker (`wrangler deploy --config wrangler.jsonc`) **and** the
`apexanime` Cloudflare Pages project (from `cloudflare-pages`,
`wrangler pages deploy ../build --project-name apexanime --branch main ...`), because
`apexanime.pages.dev` is served by Pages, not the Worker.
