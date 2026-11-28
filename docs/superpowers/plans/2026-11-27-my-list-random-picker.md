# My List Random Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dice button beside My List's sort dropdown that opens a blurred, cinema-style overlay which spins through the currently open list's posters and settles on one pick.

**Architecture:** My List already computes a de-duplicated, filtered `unique` array for its grid. Pass that array into a self-contained `RandomAnimePicker` overlay; it uses a timer to swap the displayed poster during a ~2.2s spin, then settles on a random entry. No network calls originate from the picker. Format and start year are added as fields on the list query that already runs, so the metadata row is real without extra requests.

**Tech Stack:** React 18 + TypeScript, `react-scripts` (CRA) Jest tests, `lucide-react` icons, plain CSS in `dashboard.css`.

**Spec:** `docs/superpowers/specs/2026-11-27-my-list-random-picker-design.md`

## Global Constraints

- Keep tokens/secrets/credentials out of chat, source, commits, logs, and output.
- The picker makes **zero** API requests; it must not add tokens or rate-limit pressure.
- No autoplay: playback starts only on an explicit `Play` click.
- Do not change the existing sort dropdown, status filters, or card overlays.
- Run `npm run typecheck`, `npm run test:ci`, and `npm run build` before any push/deploy.
- Ask the user before pushing, merging, or deploying.

## Review Focus

1. An entry with no `format`, no `startYear`, or no `averageScore` must not print "Anime", "undefined", or "NaN" — Task 2 test asserts unknown segments are omitted.
2. AniList `averageScore` is 0–100; `78` must render as `★ 7.8` — Task 2 test asserts one decimal place and the /10 scaling.
3. A list with one usable entry must settle on it without looping forever — Task 2 test uses a one-item list.
4. Closing via X or backdrop must cancel the pending spin timer so no late state update leaks — Task 2 test advances timers after close and asserts the selection callback is not invoked.
5. An empty list or a list with no cover images must not open a blank overlay — Task 2 test asserts the component renders nothing.

---

### Task 1: Carry format and start year through the list data

**Files:**
- Modify: `src/hooks/useLibrary.ts` (`LibraryAnime` interface)
- Modify: `src/utils/sync/anilistList.ts` (`AniListMedia`, `LIST_QUERY`)
- Modify: `server/list.cjs` (the identical AniList `LIST_QUERY` string)
- Test: `src/utils/sync/anilistList.test.ts`

**Interfaces:**
- Consumes: existing `readAniListList(page, signal): Promise<AniListListPage>`, which maps `anime: entry.media` verbatim.
- Produces: `LibraryAnime.format?: string` and `LibraryAnime.startYear?: number`; AniList entries carry them after a normal list load.

- [x] **Step 1: Write the failing test**

In `src/utils/sync/anilistList.test.ts`, add a test that mocks `anilistRequest` with one media list entry whose `media` has `format: "TV_SHORT"` and `startDate: { year: 2019 }`, calls `readAniListList`, and asserts:
- `page.entries[0].anime` matches `{ format: "TV_SHORT", startYear: 2019 }`
- the GraphQL query string passed to `anilistRequest` contains both `format` and `startDate{year}`.

- [x] **Step 2: Run the test to verify it fails**

Run: `npx react-scripts test --watchAll=false --runInBand src/utils/sync/anilistList.test.ts`
Expected: FAIL — fields are absent from both the mock result and the query.

- [x] **Step 3: Implement the field plumbing**

- Add `format?: string` and `startYear?: number` to `LibraryAnime` in `src/hooks/useLibrary.ts`.
- Add `format?: string` and `startDate?: { year?: number | null }` to `AniListMedia` in `src/utils/sync/anilistList.ts`.
- Change `LIST_QUERY` there so the `media{...}` selection ends with `... startDate{year} format` (keep the existing fields and request shape).
- Make the same field addition to the `LIST_QUERY` string in `server/list.cjs` (line ~246). Do not change the mapping — `anime: entry.media` already passes new fields through.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx react-scripts test --watchAll=false --runInBand src/utils/sync/anilistList.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/hooks/useLibrary.ts src/utils/sync/anilistList.ts src/utils/sync/anilistList.test.ts server/list.cjs
git commit -m "feat: carry anime format and start year in list entries"
```

---

### Task 2: Make the picker spin, settle, and describe the pick

**Files:**
- Modify: `src/components/RandomAnimePicker.tsx`
- Modify: `src/components/RandomAnimePicker.test.tsx`
- Create: `src/components/RandomAnimePicker.tsx` did not exist at the plan's base commit; build it test-first with the working spin behavior.

**Interfaces:**
- Consumes: `LibraryAnime[]`; `open: boolean`; `onPlay(anime)`, `onSelect(anime)`, `onClose()` callbacks (already present).
- Produces: the same component signature, with a working spin and correct metadata.

- [x] **Step 1: Write the failing tests**

In `src/components/RandomAnimePicker.test.tsx`, add/replace tests with these exact assertions:
- `advanceSpin()` uses `SPIN_DURATION_MS` from the component (export it) — define it in the test as `SPIN_DURATION_MS + 100` so fake timers cover the settle.
- "cycles posters during the spin": with fake timers, render open, advance ~500ms, read `img.random-picker-image` `src`, advance another ~500ms, read again, assert the two `src` values differ (seed `Math.random` deterministically if needed).
- "settles on a pick": after `advanceSpin()`, title is not `—` and `onPlay` is called with an item from the input list.
- "renders the type, year and scaled score": fixture `format: "TV_SHORT"`, `startYear: 2019`, `averageScore: 78`; after `advanceSpin()`, subtitle text is exactly `TV Short · 2019 · ★ 7.8`.
- "omits unknown metadata": fixture with all three fields absent; after `advanceSpin()`, subtitle does not contain `Anime`, `undefined`, or `NaN`.
- "settles with one entry": input list of one item; after `advanceSpin()`, title equals that item's display title.
- "closing cancels the spin": render open, advance 300ms, click `[aria-label="Close picker"]`, advance past the spin duration, assert `onClose` was called once and no selection is rendered (title stays `—`).
- "empty list renders nothing": keep the existing test.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/RandomAnimePicker.test.tsx`
Expected: FAIL — posters do not change, score is unscaled, format label is `Anime`, timer is not cancelled on close.

- [x] **Step 3: Rework the component**

- Export `SPIN_DURATION_MS = 2200` and keep `SPIN_INTERVAL_MS = 120`.
- While `spinning`, render `filtered[spinIndex]?.coverImage?.extraLarge` as the image source, so posters visibly change; render the settled `selected` image only after spinning stops.
- Add a `formatLabel(value?: string): string` helper inside the file mapping `TV_SHORT → TV Short`, `MOVIE → Movie`, `SPECIAL → Special`, and `TV`, `OVA`, `ONA` unchanged; unknown/absent returns `""`.
- Build the subtitle from non-empty parts: `formatLabel(selected?.format)`, `String(selected?.startYear)`, and `★ ${(averageScore / 10).toFixed(1)}` when `averageScore` is a finite number. Join with ` · `. Render nothing when all parts are empty.
- In `handleClose`, clear `timerRef.current` before calling `onClose()`.
- Honor `prefers-reduced-motion` by settling immediately (skip the timer loop) when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` is true.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/RandomAnimePicker.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/RandomAnimePicker.tsx src/components/RandomAnimePicker.test.tsx
git commit -m "fix: spin through real posters and show accurate picker metadata"
```

---

### Task 3: Style the overlay and dice button

**Files:**
- Modify: `src/components/dashboard.css`

**Interfaces:**
- Consumes: class names already emitted by `RandomAnimePicker` and the dice button in `MyList`.
- Produces: visual styles only; no JS interface changes.

- [x] **Step 1: Replace the current `.random-picker-*` CSS block**

Match the supplied description: card ~35vw wide / ~55vh tall (with sensible min/max for small screens), `border-radius: 30px`, background `#0B1020`, subtle radial golden glow near top center, light translucent backdrop (`rgba(10,7,20,.55)` + `blur(6px)`), centered amber `#F0A43A` `Tonight, watch` heading with faint glow, poster with 18–20px radius and soft shadow occupying ~55–60% of card height, 32–36px bold white title, `#AAB0C0` 14–16px metadata row, and a centered horizontal row of three pill buttons ~46px tall with 12–16px gaps: white primary `Play`, dark translucent `Details` and `Spin again`. Keep existing reduced-motion and `@supports not (backdrop-filter)` fallbacks.

- [x] **Step 2: Style the dice button**

Give the `.library-filters` dice button a square glass pill matching neighbouring selects, ~44px, with visible focus ring and a disabled state.

- [x] **Step 3: Verify compilation**

Run: `npm run build`
Expected: succeeds (the pre-existing CSS-order warnings are known and acceptable).

- [x] **Step 4: Commit**

```bash
git add src/components/dashboard.css
git commit -m "style: match the random picker overlay to the reference design"
```

---

### Task 4: Wire the dice button and run all gates

**Files:**
- Modify: `src/components/MyList.tsx`
- Test: `src/components/MyList.test.tsx`

**Interfaces:**
- Consumes: `<RandomAnimePicker anime={unique} open={pickerOpen} onPlay={...} onSelect={...} onClose={...} />`.
- Produces: dice button opens the overlay with the current filtered list.

- [x] **Step 1: Write the failing test**

In `src/components/MyList.test.tsx`, add a test that renders My List with at least one entry, clicks `[aria-label="Pick a random anime from this list"]`, and asserts a `[role="dialog"]` appears containing the `Tonight, watch` heading. Add a second test asserting the dice button is disabled when the list is empty.

- [x] **Step 2: Run the test to verify it fails**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/MyList.test.tsx`
Expected: FAIL.

- [x] **Step 3: Wire the button**

Ensure the dice button sits immediately after the sort `StyledSelect` inside `.library-filters`, is disabled when `accounts.busy || accounts.checking || !unique.length`, sets `pickerOpen` true on click, and that `<RandomAnimePicker>` receives `anime={unique}` and `open={pickerOpen}`. Both `onPlay` and `onSelect` call the existing `onSelect(anime)` and set `pickerOpen` false.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/MyList.test.tsx`
Expected: PASS.

- [x] **Step 5: Run all gates**

Run each and confirm:
- `npm run typecheck` — no errors
- `npm run test:ci` — all suites pass
- `npm run build` — succeeds (known CSS-order warnings only)

- [x] **Step 6: Commit**

```bash
git add src/components/MyList.tsx src/components/MyList.test.tsx
git commit -m "feat: open the random picker from My List's dice button"
```

Then ask the user before pushing or deploying.
