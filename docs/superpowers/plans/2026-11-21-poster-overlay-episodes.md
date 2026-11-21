# Poster overlay with total episodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show title, year, type and total episode count in one shared poster overlay used by discovery, Related and More Like This.

**Architecture:** Extract the discovery caption into `PosterCaption` with a pure `posterMeta()` formatter and its own stylesheet. Extend the detail GraphQL selection with `seasonYear format` so catalog items can feed the same component, and remove the under-poster title/label from the detail grid. Discovery keeps its badges below the poster.

**Tech Stack:** React 18, TypeScript 4.9, CRA/Jest, plain CSS.

**Spec:** `docs/superpowers/specs/2026-11-21-poster-overlay-episodes-design.md`

## Global Constraints

- Metadata format is `2009 · TV · 175eps` — the original discovery caption's spaced centered dot between parts, `eps` immediately after the number.
- Episode value is the **total planned** count from `episodes`, never `nextAiringEpisode.episode`.
- Omit the `eps` chunk unless `episodes` is a positive finite integer.
- Missing year renders `TBA`; empty format is omitted; no dangling separators.
- The caption is `pointer-events: none`; clicking the poster still opens the anime.
- Do not touch login/account files that are already modified and uncommitted.
- Deploy **both** the Worker (`apexanime-backup`) and the Pages project (`apexanime`), since `apexanime.pages.dev` is served by Pages.

## Review Focus

- Airing anime with a known total and an in-progress `nextAiringEpisode`: still shows the total, not the aired count — pinned by the `posterMeta` total-vs-aired test in Task 1.
- Missing or zero/unknown episode totals: no `eps` chunk at all — pinned by the formatter edge-case test in Task 1.
- Missing year/type: renders `TBA` and omits type without stray separators — pinned by the formatter edge-case test in Task 1.
- Detail catalog cards: overlay present, no duplicate title under the poster, poster click still opens details — pinned by the extended navigation test in Task 2.
- Discovery and both detail tabs share the same component and keep badges below the poster — pinned by the discovery caption test in Task 3 and the detail overlay test in Task 2.

---

### Task 1: Shared `PosterCaption` component and formatter

**Files:**
- Create: `src/components/PosterCaption.tsx`
- Create: `src/components/posterCaption.css`
- Create: `src/components/PosterCaption.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `posterMeta(input: { year?: number | null; format?: string | null; episodes?: number | null }): string` and `PosterCaption(props: { title: string; year?: number | null; format?: string | null; episodes?: number | null }): JSX.Element`. `PosterCaption` renders `<div className="poster-caption"><strong>{title}</strong><small>{posterMeta(...)}</small></div>` and imports `./posterCaption.css`.

- [ ] **Step 1: Write the failing tests** in `src/components/PosterCaption.test.tsx`:
  - `posterMeta({ year: 2009, format: "TV", episodes: 175 })` is `"2009 · TV · 175eps"`.
  - `posterMeta({ year: 2026, format: "TV", episodes: 12, nextAiringEpisode aired = 5 })` — pass only `episodes: 12` plus an ignored extra property via a cast — is `"2026 · TV · 12eps"`, proving the total is used.
  - `posterMeta({ year: undefined, format: "", episodes: 0 })` is `"TBA"`, and `posterMeta({ year: 2020, format: null, episodes: null })` is `"2020"`.
  - Rendering `<PosterCaption title="Example" year={2009} format="TV" episodes={175} />` yields `.poster-caption strong` text `Example` and `.poster-caption small` text `2009 · TV · 175eps`.

- [ ] **Step 2: Run the tests to verify they fail**
  Run: `npx react-scripts test --watchAll=false --runInBand --testPathPattern="PosterCaption.test"`
  Expected: FAIL — module cannot be resolved.

- [ ] **Step 3: Implement `PosterCaption.tsx` and `posterCaption.css`**
  Use the signatures above. Move the gradient/absolute-position rules from `.discovery-poster-caption` in `discovery.css` into `.poster-caption` in the new stylesheet, keeping `pointer-events: none` and ellipsis on `strong`.

- [ ] **Step 4: Run the tests to verify they pass**
  Run: `npx react-scripts test --watchAll=false --runInBand --testPathPattern="PosterCaption.test"`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add src/components/PosterCaption.tsx src/components/posterCaption.css src/components/PosterCaption.test.tsx` and commit `feat: add shared poster caption with total episodes`.

### Task 2: Detail catalog cards use the shared overlay

**Files:**
- Modify: `src/utils/detailQuery.ts:47-48`
- Modify: `src/components/AnimeDetails.tsx:36-52, 432-475`
- Test: `src/components/AnimeDetails.test.tsx:168-238`

**Interfaces:**
- Consumes: `PosterCaption` and `posterMeta` from Task 1.
- Produces: recommendation and relation items carry `seasonYear?: number` and `format?: string`; no other task consumes them.

- [ ] **Step 1: Write the failing test** by extending the existing `detail navigation contains only episodes, related anime and recommendations` test in `AnimeDetails.test.tsx`: give the recommendation node `id: 3, seasonYear: 2009, format: "TV", episodes: 175` and the relation node `id: 2, seasonYear: 2020, format: "MOVIE", episodes: 1`; after clicking each tab assert `node.querySelector(".detail-poster-grid .poster-caption small")!.textContent` is `"2009 · TV · 175eps"` / `"2020 · MOVIE · 1eps"`, and assert `node.querySelector(".detail-poster-grid .poster-title")` is `null`. Keep the existing poster-click assertion.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `npx react-scripts test --watchAll=false --runInBand --testPathPattern="AnimeDetails.test"`
  Expected: FAIL — no `.poster-caption` in the detail grid.

- [ ] **Step 3: Implement the change**
  Add `seasonYear format` to both `mediaRecommendation` and `relations.edges.node` selections in `detailQuery.ts`. Extend the recommendation/relation item types in `AnimeDetails.tsx` with `seasonYear?: number; format?: string`. In the catalog card map, render `<PosterCaption title={getDisplayTitle(item)} year={item.seasonYear} format={item.format} episodes={item.episodes} />` inside `.poster-art`; remove the `<small>{label}</small>` and `.poster-title` button, and drop the now-unused `label` from the mapped objects. Keep `AnimeBadges` beneath the poster.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `npx react-scripts test --watchAll=false --runInBand --testPathPattern="AnimeDetails.test"`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add src/utils/detailQuery.ts src/components/AnimeDetails.tsx src/components/AnimeDetails.test.tsx` and commit `feat: show discovery-style overlay on detail catalog posters`.

### Task 3: Discovery reuses the same caption

**Files:**
- Modify: `src/components/DiscoveryPage.tsx:418-436`
- Modify: `src/components/discovery.css:173-194`
- Test: `src/components/DiscoveryPage.test.tsx:60-82`

**Interfaces:**
- Consumes: `PosterCaption` from Task 1.
- Produces: nothing.

- [ ] **Step 1: Write the failing test** in `DiscoveryPage.test.tsx`: set the first mocked poster to `{ id: 1, title: { english: "Anime 1" }, malScore: null, year: 2009, format: "TV", episodes: 175 }`; after rendering assert `node.querySelector(".poster-card .poster-caption small")!.textContent` is `"2009 · TV · 175eps"`.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `npx react-scripts test --watchAll=false --runInBand --testPathPattern="DiscoveryPage.test"`
  Expected: FAIL — no `.poster-caption`.

- [ ] **Step 3: Implement the change**
  Replace the inline `.discovery-poster-caption` markup with `<PosterCaption title={anime.title.english || anime.title.romaji} year={anime.year} format={anime.format} episodes={anime.episodes} />`, import it, and delete the five `.discovery-poster-caption*` rules from `discovery.css` (the component stylesheet now owns them). Leave `AnimeBadges` below the poster untouched.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `npx react-scripts test --watchAll=false --runInBand --testPathPattern="DiscoveryPage.test"`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add src/components/DiscoveryPage.tsx src/components/discovery.css src/components/DiscoveryPage.test.tsx` and commit `feat: reuse poster caption in discovery`.

### Task 4: Verification, push and deploy

**Files:** none (verification and release only).

- [ ] **Step 1: Run full gates**
  Run `npm run test:ci`, `npm run test:server`, `npm run typecheck`, `npm run build`. Expected: all pass, zero failures.

- [ ] **Step 2: Review the diff**
  Run `git diff --stat` and confirm only the files from Tasks 1–3 are committed and the pre-existing uncommitted login files are still untouched.

- [ ] **Step 3: Push**
  Run `git push`.

- [ ] **Step 4: Deploy the Worker**
  Run `npx --yes wrangler deploy --config wrangler.jsonc`. Expected exit 0.

- [ ] **Step 5: Deploy Pages**
  From `cloudflare-pages`, run `npx wrangler pages deploy ../build --project-name apexanime --branch main --commit-hash <HEAD> --commit-message "<message>"`. Expected: Production deployment URL returned.

- [ ] **Step 6: Verify live in Edge**
  Hard-refresh `https://apexanime.pages.dev/anime/182060`, open More Like This and Related, confirm overlay text includes totals (e.g. `2009 · TV · 175eps`), no title below the poster, and clicking a poster still navigates.
