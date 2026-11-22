# Continue Watching Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Continue Watching entries from being lost to the 15-title cap or to the 80% watched callback being mistaken for true completion.

**Architecture:** Keep `videasy_history` as browser-local storage. Raise its cap to 100. Keep the existing 80% `onWatched` sync, but add a separate optional `onCompleted` player callback fired only by real `ended` events in trustworthy players. `App` uses `onCompleted` only to remove a known final episode from Continue Watching.

**Tech Stack:** React 18, TypeScript 4.9, Jest + React DOM test utils, Cloudflare Pages SPA.

**Spec:** `docs/superpowers/specs/2026-11-21-continue-watching-hardening-design.md`

## Global Constraints

- Keep `videasy_history` browser-local; do not add server or account storage.
- Cap is exactly `100` titles.
- 80% playback remains the only automatic AniList status/progress sync trigger.
- Real `ended` events are the only automatic Continue Watching removal trigger.
- Embed-based players must not gain an auto-removal path.
- Manual X removal remains unchanged.
- Do not stage or deploy unrelated rate-limit changes in `src/components/RatingPills.tsx`, `src/components/RatingPills.test.tsx`, `src/components/AnimeBadges.tsx`, or `src/components/DiscoveryPage.tsx`.
- Do not commit, push, or deploy without explicit approval.
- Gates before final handoff: `npm run test:ci`, `npm run test:server`, `npm run typecheck`, `npm run build`.
- Keep tokens/secrets out of source, tests, chat, commits, and output.

## Review Focus

- Final episode at 80% from any player: entry remains in Continue Watching — pinned by Task 3 App routing test.
- Native player real `ended` on final episode: entry is removed only after `onCompleted` reaches `App` — pinned by Task 1 player test and Task 3 App routing test.
- Ani.pm real `ended` on final episode: completion fires once with explicit episode identity — pinned by Task 2 player test.
- 101st started title: only the oldest entry is evicted under cap 100 — pinned by Task 3 cap test.
- Refresh/OAuth return and storage failure: history remains readable and unchanged — pinned by Task 3 existing regression tests.

---

### Task 1: Add completion callback to player API and native playback

**Files:**
- Modify: `src/components/VideoPlayer.tsx:6-24`
- Modify: `src/components/NativeVideoPlayer.tsx:575-578`
- Test: `src/components/NativeVideoPlayer.test.tsx:22-33,92-93`

**Interfaces:**
- Consumes: existing `PlayerProps` shape and native `<video onEnded>` event.
- Produces: `onCompleted?: (episode?: number) => void` on `PlayerProps`; native playback calls it with the rendered `episode`.

- [ ] **Step 1: Write the failing test**

In `src/components/NativeVideoPlayer.test.tsx`, add `onCompleted: jest.fn()` to the `props` object. Extend the existing `ended` assertion block so that after `act(() => video.dispatchEvent(new Event("ended")))` the test asserts `props.onCompleted` was called once with `2`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- --testPathPattern=NativeVideoPlayer.test.tsx`
Expected: FAIL because `onCompleted` is never called.

- [ ] **Step 3: Implement the callback contract**

In `src/components/VideoPlayer.tsx`, add `onCompleted?: (episode?: number) => void;` to `PlayerProps`.

In `src/components/NativeVideoPlayer.tsx`, call `props.onCompleted?.(episode)` inside the existing `onEnded` handler before the existing `persist(true)` / auto-next logic. Do not change auto-next behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- --testPathPattern=NativeVideoPlayer.test.tsx`
Expected: PASS with 80% `onWatched` still called once and `onCompleted` called once on `ended`.

- [ ] **Step 5: Verify task boundary**

Run: `npm run typecheck`
Expected: PASS. Do not commit yet.

### Task 2: Fire completion from Ani.pm real ended events

**Files:**
- Modify: `src/components/AniPmPlayer.tsx:125-145,253-263`
- Test: `src/components/AniPmPlayer.test.tsx:33-48,71-89`

**Interfaces:**
- Consumes: `onCompleted?: (episode?: number) => void` from `PlayerProps`; existing validated Ani.pm state checks.
- Produces: one `onCompleted(episode)` call per episode mount when the SDK emits `ended`.

- [ ] **Step 1: Write the failing test**

In `src/components/AniPmPlayer.test.tsx`, add `const completed = jest.fn()` and `onCompleted: completed` to the first test’s `props`. After the existing 80% assertions, dispatch `events.ended(player.state)` twice. Assert `completed` was called once with `2`, while `watched` remains at two calls.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- --testPathPattern=AniPmPlayer.test.tsx`
Expected: FAIL because `onCompleted` is never called.

- [ ] **Step 3: Implement completion de-duplication**

In `src/components/AniPmPlayer.tsx`, add a per-component ref that records completed episode numbers. Split the existing `ended` handler from `flush`: still call `flush()`, then, only when `validAniPmState(player.state, id)` passes and the episode has not already completed, mark it and call `callbacks.current.onCompleted?.(state.episode)`.

Keep `pause` using plain `flush`. Keep 80% tracking unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- --testPathPattern=AniPmPlayer.test.tsx`
Expected: PASS with 80% `onWatched` behavior unchanged and duplicate `ended` events producing one completion.

- [ ] **Step 5: Verify task boundary**

Run: `npm run typecheck`
Expected: PASS. Do not commit yet.

### Task 3: Apply App history cap and completion-only removal

**Files:**
- Modify: `src/App.tsx:110-121,349-370,550-596`
- Test: `src/App.routing.test.tsx:44-53,219-290`

**Interfaces:**
- Consumes: `onCompleted?: (episode?: number) => void` from `PlayerProps`.
- Produces: `markCompleted` behavior in `App`; `videasy_history` cap of 100; 80% watched no longer removes history.

- [ ] **Step 1: Write the failing App tests**

In `src/App.routing.test.tsx`, update the mocked `VideoPlayer` to render an extra `Complete` button that calls `onCompleted(episode)`.

Replace the test `"watching the final episode removes the anime from Continue Watching storage"` with `"watching the final episode at 80% keeps the anime in Continue Watching storage"` and change its assertion to expect the episode-12 entry to remain after clicking `Mark watched`.

Add `"completing the final episode removes the anime from Continue Watching storage"`: render `/anime/1/episode/12`, click `Complete`, expect `videasy_history` to be `[]`.

Add `"completing a non-final episode keeps the anime in Continue Watching"`: render `/anime/1/episode/3`, click `Complete`, expect the episode-3 entry to remain.

Add `"a 101st started title evicts only the oldest entry"`: seed `videasy_history` with 101 valid entries whose anime IDs are 1 through 101, render `/anime/102/episode/1`, then assert stored history has length 100, first entry anime ID 102, and no entry with anime ID 1.

Keep the existing refresh/OAuth storage regression test and storage-failure tests unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ci -- --testPathPattern=App.routing.test.tsx`
Expected: FAIL for final 80% retention, completion removal, and cap 100.

- [ ] **Step 3: Implement minimal App changes**

In `src/App.tsx`:
- Change `updateHistory` slice from `.slice(0, 15)` to `.slice(0, 100)`.
- Remove `removeFromHistory` from `markWatched`; that function only syncs progress/status.
- Add a `markCompleted(episode = activeEpisode)` function that removes `selectedAnime.id` from history only when `selectedAnime.episodes` is truthy and `episode >= selectedAnime.episodes`.
- Pass `onCompleted={(episode) => markCompleted(episode)}` to `VideoPlayer`.

Do not add another `accounts.sync` call to the completion path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:ci -- --testPathPattern=App.routing.test.tsx`
Expected: PASS for all routing/history tests, including refresh/OAuth preservation.

- [ ] **Step 5: Verify task boundary**

Run: `npm run typecheck`
Expected: PASS. Do not commit yet.

### Task 4: Full verification and handoff

**Files:**
- No production files. Review only.

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: verified working tree and explicit commit/push/deploy decision.

- [ ] **Step 1: Run all four gates**

Run each command separately and read the full result:
- `npm run test:ci`
- `npm run test:server`
- `npm run typecheck`
- `npm run build`

Expected: 51 suites / all tests pass; 43 server tests pass; typecheck exits 0; build exits 0.

- [ ] **Step 2: Review the scoped diff**

Run: `git diff -- src/App.tsx src/App.routing.test.tsx src/components/VideoPlayer.tsx src/components/NativeVideoPlayer.tsx src/components/NativeVideoPlayer.test.tsx src/components/AniPmPlayer.tsx src/components/AniPmPlayer.test.tsx docs/superpowers/specs/2026-11-21-continue-watching-hardening-design.md docs/superpowers/plans/2026-11-21-continue-watching-hardening.md`

Expected: only hardening-related files appear; the rate-limit files remain unstaged and untouched.

- [ ] **Step 3: Ask before integration**

Do not commit, push, or deploy. Ask the human partner whether to commit and, separately, whether to push/deploy.
