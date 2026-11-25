# AniList Rate Limit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop browser-driven AniList 429s by sharing one request budget, making library imports on-demand and resumable, and reducing repeated Discovery/Search/poll traffic.

**Architecture:** Gate every `fetchAnilist` call through one in-memory scheduler and a global 429 cooldown. Keep saved libraries usable locally, verify/import only from My List or explicit retries, and cache successful Discovery/Search/rating reads with short TTLs. MAL paths and the countdown UI stay unchanged.

**Tech Stack:** React 18 / TypeScript frontend, Jest + React DOM test harnesses, Cloudflare Pages on `main`.

**Spec:** `docs/superpowers/specs/2026-11-25-anilist-rate-limit-fixes-design.md`

## Global Constraints

- AniList advertises 30 requests/minute; the browser budget allows **24 started requests per rolling 60 seconds** with **at least 1000 ms between starts**.
- A 429 sets the shared retry clock to the parsed reset, or `now + 60_000`; `fetchAnilist` rejects for all callers while that clock is future. It never transparently retries.
- `setRateLimitRetryAt` is called only on 429; successful responses with `X-RateLimit-Reset` must not extend cooldown.
- AniList library pages wait **4000 ms**; MAL pages keep **2200 ms**.
- Library refresh modes are exactly `"full"` (default) and `"resume"`.
- A resume checkpoint is eligible only when `complete === false`, zero confirmed changes exist, `nextPage` is an integer in `(1, 10000]`, and `updatedAt` is less than one hour old.
- AniList cache hydration on app mount requires `readAniListToken().identity === cached.identity`; MAL is not hydrated before page-1 verification.
- Discovery page cache TTL **600000 ms**, options cache TTL **1800000 ms**, studio pagination **one AniList request per page with perPage 50**.
- Search cache TTL **300000 ms**, at most **3** aliases per query.
- Latest Episodes interval **300000 ms**; Following Stories interval **900000 ms**; RatingPills score cache TTL **1800000 ms**.
- Do not expose tokens/secrets in chat, source, commits, command output, or tests; use obvious fake values only.
- Preserve Watch Later local-only behavior, countdown pill placement/seconds, MAL paths, poster/card/typography/colors, and list status dropdown ordering.
- Gates: `npm run test:ci`, `npm run test:server`, `npm run typecheck`, `npm run build`.
- Push directly to `main`; no PR unless explicitly requested.

## Review Focus

- **Two independent paginators racing:** concurrent Search/Discovery/library calls must share one 24-per-60s budget. Covered in Task 1 (rolling-window and spacing tests).
- **A success response carrying reset headers must not block the app:** the retry clock is set only on 429. Covered in Task 1 (`success response leaves shared cooldown untouched`).
- **Reopening My List with a complete cache must not page through the whole library, and a failed page must resume from its checkpoint:** covered in Task 2 (`resume stops after verified page 1`, `resume jumps to checkpoint`) and My List mount/rate-limit retry tests.
- **Discovery sentinel must not auto-chain pages even when the first page is short:** covered in Task 3 (`poster list waits for debounced intersection`) and cache tests proving repeat pages/options do not refetch.
- **Search/polls must not secretly keep the old request rate:** covered in Task 4 (3-alias/cache tests) and Task 5 (interval and score-TTL tests).

---

## File Structure

- `src/utils/anilistBudget.ts` — new shared rolling-window scheduler; production singleton plus testable factory.
- `src/utils/anilistBudget.test.ts` — budget window, spacing, and abort tests.
- `src/utils/anilist.ts` — call scheduler before fetch; reject during cooldown; publish cooldown only on 429.
- `src/utils/anilist.budget.test.ts` — proves `fetchAnilist` acquires the budget before network.
- `src/utils/anilistRateLimit.test.ts` — updates cooldown behavior tests.
- `src/hooks/useLibrary.ts` — local hydration, `"full" | "resume"` import modes, AniList-only 4000 ms pacing, removal of automatic import/retry effects.
- `src/hooks/useLibrary.test.tsx` — explicit import, hydration, checkpoint, and no-mount-import tests.
- `src/components/MyList.tsx` — mount resume import and rate-limit retry with resume mode.
- `src/components/MyList.test.tsx` — resume-on-mount and retry-after-cooldown tests.
- `src/hooks/useMissingLibrary.ts` — user retry uses resume mode.
- `src/utils/discovery.ts` — page/options caches, one-request studio pages.
- `src/utils/discovery.test.ts` — cache reuse, failure non-caching, studio request count.
- `src/components/DiscoveryPage.tsx` — 160 px sentinel with 600 ms debounce.
- `src/components/DiscoveryPage.test.tsx` — debounced near-bottom loading.
- `src/utils/animeSearch.ts` — 3-alias cap and final-result cache.
- `src/utils/animeSearch.test.ts` — alias cap, cache reuse, failure/abort non-caching.
- `src/components/HomeDashboard.tsx` — 300000 ms Latest Episodes poll.
- `src/components/FollowingStories.tsx` — 900000 ms story poll.
- `src/components/RatingPills.tsx` — successful-score TTL cache.
- `src/components/HomeDashboard.test.tsx`, `src/components/FollowingStories.test.tsx`, `src/components/RatingPills.test.tsx` — interval and score-cache tests.
- `docs/superpowers/specs/2026-11-25-anilist-rate-limit-fixes-design.md`, `docs/superpowers/plans/2026-11-25-anilist-rate-limit-fixes.md` — committed with Task 1.

## Test Commands

- Single frontend file: `npm run test:ci -- <path>`
- Full frontend: `npm run test:ci`
- Server: `npm run test:server`
- Types: `npm run typecheck`
- Build: `npm run build`

---

### Task 1: Shared browser AniList budget and cooldown

**Files:**
- Create: `src/utils/anilistBudget.ts`
- Create: `src/utils/anilistBudget.test.ts`
- Create: `src/utils/anilist.budget.test.ts`
- Modify: `src/utils/anilist.ts`
- Modify: `src/utils/anilistRateLimit.test.ts`
- Modify: `src/utils/cleanup.test.ts`
- Commit docs: `docs/superpowers/specs/2026-11-25-anilist-rate-limit-fixes-design.md`, `docs/superpowers/plans/2026-11-25-anilist-rate-limit-fixes.md`

**Interfaces:**
- Consumes: existing `parseRateLimitHeaders`, `getRateLimitRetryAt`, `setRateLimitRetryAt` from `rateLimitClock.ts`.
- Produces:
  - `export interface AniListBudgetDeps { now: () => number; wait: (ms: number, signal?: AbortSignal) => Promise<void> }`
  - `export interface AniListBudget { acquire(signal?: AbortSignal): Promise<void> }`
  - `export function createAniListBudget(deps?: Partial<AniListBudgetDeps>): AniListBudget`
  - `export function acquireAniListRequest(signal?: AbortSignal): Promise<void>`

- [x] **Step 1: Write the failing budget tests**

Create `src/utils/anilistBudget.test.ts`:

```ts
import { createAniListBudget } from "./anilistBudget";

test("allows 24 starts in a rolling minute then delays the next start", async () => {
  let now = 0;
  const delays: number[] = [];
  const budget = createAniListBudget({
    now: () => now,
    wait: async (ms) => {
      delays.push(ms);
      now += ms;
    },
  });
  await Promise.all(Array.from({ length: 25 }, () => budget.acquire()));
  expect(delays[0]).toBe(0);
  expect(delays.slice(1, 24)).toEqual(Array(23).fill(1000));
  expect(delays[24]).toBe(37000);
});

test("stops an aborted waiter without consuming a slot", async () => {
  const controller = new AbortController();
  const budget = createAniListBudget({
    now: () => 0,
    wait: (_ms, signal) =>
      new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  });
  await budget.acquire();
  const pending = budget.acquire(controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});
```

- [x] **Step 2: Run budget tests to verify failure**

Run: `npm run test:ci -- src/utils/anilistBudget.test.ts`
Expected: FAIL because `anilistBudget.ts` does not exist.

- [x] **Step 3: Implement the budget**

Create `src/utils/anilistBudget.ts`. Use a FIFO waiter queue with three delay sources: rolling window (24 starts in 60000 ms), minimum spacing (1000 ms), and the caller's abort signal. Default `now` is `Date.now`; default `wait` resolves after `setTimeout` and rejects with `AbortError` on abort. Keep all state inside the factory; export one production singleton for the wrappers. Do not add a test-only reset method.

- [x] **Step 4: Run budget tests to verify pass**

Run: `npm run test:ci -- src/utils/anilistBudget.test.ts`
Expected: PASS.

- [x] **Step 5: Write the failing `fetchAnilist` integration tests**

Create `src/utils/anilist.budget.test.ts`:

```ts
jest.mock("./anilistBudget", () => ({ acquireAniListRequest: jest.fn() }));

import { fetchAnilist } from "./anilist";
import { acquireAniListRequest } from "./anilistBudget";

test("waits for the shared budget before calling the network", async () => {
  const order: string[] = [];
  (acquireAniListRequest as jest.Mock).mockImplementation(async () => {
    order.push("acquire");
  });
  global.fetch = jest.fn(async () => {
    order.push("fetch");
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: {} }),
    } as unknown as Response;
  }) as jest.Mock;
  await fetchAnilist("query {}", {}, undefined, "token-from-session");
  expect(order).toEqual(["acquire", "fetch"]);
});
```

Update `src/utils/anilistRateLimit.test.ts`:

```ts
test("blocks every caller while the shared cooldown is active", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  setRateLimitRetryAt(1_800_000_000_000 + 30_000);
  global.fetch = jest.fn() as jest.Mock;
  await expect(
    fetchAnilist("query {}", {}, undefined, "token-from-session"),
  ).rejects.toThrow(ANILIST_RATE_LIMIT_MESSAGE);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a successful response leaves the shared cooldown untouched", async () => {
  const now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockReturnValue(now);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: limitedHeaders(12),
    json: async () => ({ data: {} }),
  } as unknown as Response);
  await fetchAnilist("query {}", {}, undefined, "token-from-session");
  expect(getRateLimitRetryAt()).toBe(0);
});
```

Replace the previous `publishes the reset time from a response received during the cooldown` test with the two tests above.

Update `src/utils/cleanup.test.ts` in `AniList rejects HTTP, GraphQL and missing-data failures`: after the first 429 assertion, call `setRateLimitRetryAt(0)` before the next `fetchAnilist`, importing it from `./rateLimitClock`.

- [x] **Step 6: Run integration tests to verify failure**

Run: `npm run test:ci -- src/utils/anilist.budget.test.ts src/utils/anilistRateLimit.test.ts src/utils/cleanup.test.ts`
Expected: FAIL because `fetchAnilist` does not acquire the budget and still publishes reset on success.

- [x] **Step 7: Implement `fetchAnilist` changes**

In `src/utils/anilist.ts`:
- Import `acquireAniListRequest`; remove `publicRetryAt`.
- At the start, if `getRateLimitRetryAt() > Date.now()`, throw `new AniListRequestError(ANILIST_RATE_LIMIT_MESSAGE, 429)` before creating the abort controller.
- `await acquireAniListRequest(signal)` before calling `fetch`.
- Parse headers and call `setRateLimitRetryAt(resetAt)` only when `response.status === 429`; when no future reset exists, use `Date.now() + 60000`.
- Do not retry the failed request.

- [x] **Step 8: Run integration tests to verify pass**

Run: `npm run test:ci -- src/utils/anilist.budget.test.ts src/utils/anilistRateLimit.test.ts src/utils/cleanup.test.ts`
Expected: PASS.

- [x] **Step 9: Run full gates and commit**

Run:

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

Expected: all PASS.

Commit:

```bash
git add docs/superpowers/specs/2026-11-25-anilist-rate-limit-fixes-design.md docs/superpowers/plans/2026-11-25-anilist-rate-limit-fixes.md src/utils/anilistBudget.ts src/utils/anilistBudget.test.ts src/utils/anilist.budget.test.ts src/utils/anilist.ts src/utils/anilistRateLimit.test.ts src/utils/cleanup.test.ts
git commit -m "feat: share one browser AniList request budget"
```

---

### Task 2: On-demand, resumable library import

**Files:**
- Modify: `src/hooks/useLibrary.ts`
- Modify: `src/hooks/useLibrary.test.tsx`
- Modify: `src/components/MyList.tsx`
- Modify: `src/components/MyList.test.tsx`
- Modify: `src/hooks/useMissingLibrary.ts`

**Interfaces:**
- Consumes: `readAniListList(page, signal?)`, `readAniListToken()`, `getRateLimitRetryAt()`, `isRateLimitError()`.
- Produces: `refreshLibrary(mode?: "full" | "resume"): Promise<void>` on `useLibrary`/`useAccounts`; default mode is `"full"`. Existing no-argument calls keep full-import behavior.

- [x] **Step 1: Write the failing library tests**

Update `src/hooks/useLibrary.test.tsx`:
- Add `import { writeAniListToken } from "../utils/anilistAuth";` and keep `setRateLimitRetryAt` imported.
- Do **not** write a token in global `beforeEach`; write `{ accessToken: "token-from-session", expiresAt: Date.now() + 3600000, identity: "alice", name: "alice" }` only in tests that need hydration/resume.
- Keep `Harness` as-is.
- Change tests that currently rely on mount import to explicitly call `await act(async () => { await library.refreshLibrary(); })` after render before asserting provider data. Affected test names: `imports every page, retains successful provider when another fails, and records only confirmed updates`, `an account change cannot expose a previous account cache`, `confirmed status, progress and rating survive stale reimports and reload`, `a newer external edit supersedes a stale confirmed change`, `confirmed removals cannot be resurrected by stale imports`, `fresh first-page values replace old complete cache before a large import finishes`.
- In `confirmed status, progress and rating survive stale reimports and reload`, write the alice token before the simulated fresh mount so the journal repair can hydrate locally.
- Rename `resumes a verified account checkpoint instead of restarting a large import` to use `await library.refreshLibrary("resume")` after render and write the alice token before render; full refresh must no longer use checkpoints.

Add these tests:

```ts
test("does not import on mount but hydrates the matching AniList cache", async () => {
  writeAniListToken({ accessToken: "token-from-session", expiresAt: Date.now() + 3600000, identity: "alice", name: "alice" });
  localStorage.setItem(
    "apex_library_v1_anilist_alice",
    JSON.stringify({
      identity: "alice",
      name: "alice",
      complete: true,
      entries: [{ anime, status: "planning", progress: 0, updatedAt: 1 }],
      updatedAt: Date.now(),
    }),
  );
  await act(async () => root.render(<Harness mal={false} />));
  expect(readAniListList).not.toHaveBeenCalled();
  expect(library.libraryEntries).toHaveLength(1);
});

test("resume mode verifies page 1 then stops on a complete cache", async () => {
  writeAniListToken({ accessToken: "token-from-session", expiresAt: Date.now() + 3600000, identity: "alice", name: "alice" });
  localStorage.setItem(
    "apex_library_v1_anilist_alice",
    JSON.stringify({
      identity: "alice",
      name: "alice",
      complete: true,
      entries: [{ anime, status: "planning", progress: 0, updatedAt: 1 }],
      updatedAt: Date.now(),
    }),
  );
  setAniListPage(() => ({ ...page("alice", "planning"), hasNextPage: true }));
  await act(async () => root.render(<Harness mal={false} />));
  await act(async () => {
    await library.refreshLibrary("resume");
  });
  expect((readAniListList as jest.Mock).mock.calls.map(([p]) => p)).toEqual([1]);
});

test("resume mode verifies page 1 then jumps to an incomplete checkpoint", async () => {
  jest.useFakeTimers();
  try {
    writeAniListToken({ accessToken: "token-from-session", expiresAt: Date.now() + 3600000, identity: "alice", name: "alice" });
    localStorage.setItem(
      "apex_library_v1_anilist_alice",
      JSON.stringify({
        identity: "alice",
        name: "alice",
        complete: false,
        nextPage: 30,
        entries: [{ anime, status: "planning", progress: 0, updatedAt: 1 }],
        updatedAt: Date.now(),
      }),
    );
    setAniListPage((pageNumber) => ({
      ...page("alice", "planning", pageNumber === 1),
      entries: [],
    }));
    await act(async () => root.render(<Harness mal={false} />));
    await act(async () => {
      void library.refreshLibrary("resume");
    });
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect((readAniListList as jest.Mock).mock.calls.map(([p]) => p)).toEqual([1, 30]);
  } finally {
    jest.useRealTimers();
  }
});
```

Remove the two old `auto-retries...` tests from `useLibrary.test.tsx`; they move to `MyList.test.tsx`.

Update `src/components/MyList.test.tsx`:
- Add `refreshLibrary: jest.fn()` to every `accounts` mock (including `makeAccounts()`).
- Add:

```ts
test("starts a resume import when My List opens", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = { ...makeAccounts(), connected: { anilist: true, mal: false } } as ReturnType<typeof useAccounts>;
  try {
    await act(async () => root.render(<MyList accounts={accounts} onSelect={jest.fn()} onConnect={jest.fn()} />));
    expect(accounts.refreshLibrary).toHaveBeenCalledWith("resume");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("retries a rate limit from My List only after the reset", async () => {
  jest.useFakeTimers();
  setRateLimitRetryAt(Date.now() + 30_000);
  try {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const accounts = {
      ...makeAccounts(),
      connected: { anilist: true, mal: false },
      libraryErrors: { anilist: "AniList rate limit reached. Please try again later." },
    } as unknown as ReturnType<typeof useAccounts>;
    try {
      await act(async () => root.render(<MyList accounts={accounts} onSelect={jest.fn()} onConnect={jest.fn()} />));
      expect(accounts.refreshLibrary).not.toHaveBeenCalledWith("resume");
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(accounts.refreshLibrary).toHaveBeenCalledWith("resume");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  } finally {
    setRateLimitRetryAt(0);
    jest.useRealTimers();
  }
});
```

- [x] **Step 2: Run library tests to verify failure**

Run: `npm run test:ci -- src/hooks/useLibrary.test.tsx src/components/MyList.test.tsx`
Expected: FAIL because `refreshLibrary` has no mode, mount import still fires, and My List has no resume/retry effects.

- [x] **Step 3: Implement library changes**

In `src/hooks/useLibrary.ts`:
- Accept `mode: "full" | "resume" = "full"` in `refreshLibrary`.
- Add a local hydration effect on connected-provider change: for AniList, use `readAniListToken()?.identity` to load only the matching `apex_library_v1_anilist_<identity>` snapshot and merge the confirmation journal; for MAL, clear disconnected lists but do not hydrate; no network.
- Remove the mount effect that calls `refreshLibrary()` and the rate-limit retry effect.
- On page 1, after identity verification and cache load: in resume mode with a complete cached snapshot and no confirmed changes, save the fresh first-page values and stop; in resume mode with an eligible checkpoint, set `entries = cached.entries` and `page = cached.nextPage`; in full mode, ignore checkpoints.
- After a successful AniList page with more pages, wait 4000 ms; after a successful MAL page with more pages, keep 2200 ms.
- Keep generation preemption and all existing journal/merge behavior.

In `src/components/MyList.tsx`:
- Add a mount/connected-change effect calling `accounts.refreshLibrary("resume")` when any provider is connected, but skip when any current `accounts.libraryErrors` value satisfies `isRateLimitError` so cooldown retries are scheduled only by the retry effect.
- Add a rate-limit effect: when an AniList or MAL error satisfies `isRateLimitError`, wait `max(getRateLimitRetryAt() - Date.now(), 1000)` or 65000 ms, then call `accounts.refreshLibrary("resume")`.
- Keep the Refresh button calling `accounts.refreshLibrary()` (full mode).

In `src/hooks/useMissingLibrary.ts`, change `accounts.refreshLibrary()` in `retry()` to `accounts.refreshLibrary("resume")`.

- [x] **Step 4: Run library tests to verify pass**

Run: `npm run test:ci -- src/hooks/useLibrary.test.tsx src/components/MyList.test.tsx`
Expected: PASS.

- [x] **Step 5: Run full gates and commit**

Run:

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

Expected: all PASS.

Commit:

```bash
git add src/hooks/useLibrary.ts src/hooks/useLibrary.test.tsx src/components/MyList.tsx src/components/MyList.test.tsx src/hooks/useMissingLibrary.ts
git commit -m "feat: make AniList library import on demand and resumable"
```

---

### Task 3: Lighter Discovery pagination and cached pages

**Files:**
- Modify: `src/utils/discovery.ts`
- Modify: `src/utils/discovery.test.ts`
- Modify: `src/components/DiscoveryPage.tsx`
- Modify: `src/components/DiscoveryPage.test.tsx`

**Interfaces:**
- Consumes: existing `fetchDiscovery(filters, page, signal, preferred?)`, `fetchDiscoveryOptions(signal)`, `fetchStudioDiscovery`.
- Produces: unchanged public signatures; successful results are cached internally by `preferred + ":" + JSON.stringify(filters) + ":" + page`; options cached by module singleton.

- [x] **Step 1: Write the failing Discovery tests**

Add `fetchDiscoveryOptions` to the existing import from `./discovery` in `src/utils/discovery.test.ts`, then add these tests:

```ts
test("reuses a successful AniList page for ten minutes", async () => {
  jest.useFakeTimers();
  try {
    (fetchAnilist as jest.Mock).mockReset().mockResolvedValue({
      Page: { pageInfo: { hasNextPage: false }, media: [] },
    });
    const filters = { ...defaultFilters, search: "cache-window" };
    await fetchDiscovery(filters, 1, new AbortController().signal, "anilist");
    await fetchDiscovery(filters, 1, new AbortController().signal, "anilist");
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(600_000);
    await fetchDiscovery(filters, 1, new AbortController().signal, "anilist");
    expect(fetchAnilist).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test("does not cache failed or aborted Discovery pages", async () => {
  (fetchAnilist as jest.Mock)
    .mockReset()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({
      Page: { pageInfo: { hasNextPage: false }, media: [] },
    });
  const filters = { ...defaultFilters, search: "cache-failure" };
  await expect(
    fetchDiscovery(filters, 1, new AbortController().signal, "anilist"),
  ).rejects.toThrow("offline");
  await fetchDiscovery(filters, 1, new AbortController().signal, "anilist");
  expect(fetchAnilist).toHaveBeenCalledTimes(2);
});

test("reuses Discovery options for thirty minutes", async () => {
  jest.useFakeTimers();
  try {
    (fetchAnilist as jest.Mock).mockReset().mockResolvedValue({
      GenreCollection: ["Action"],
      MediaTagCollection: [{ name: "Super Power", isAdult: false }],
    });
    await fetchDiscoveryOptions(new AbortController().signal);
    await fetchDiscoveryOptions(new AbortController().signal);
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1_800_000);
    await fetchDiscoveryOptions(new AbortController().signal);
    expect(fetchAnilist).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
```

Update the existing studio test `studio catalog is ID-based, paginated and retains genre filters` so it expects one `fetchAnilist` call whose query contains `perPage:50` and variables `{ id: 14, page: 1, sort: [...] }`, not two calls.

Update `src/components/DiscoveryPage.test.tsx` test `loads 50 posters, keeps quick list controls, and appends on near-bottom intersection`: after the initial render, assert `fetchDiscovery` was called once; after calling `intersect(...)`, advance timers by 599 ms and assert the last call is still page 1, then advance 1 ms and assert page 2.

- [x] **Step 2: Run Discovery tests to verify failure**

Run: `npm run test:ci -- src/utils/discovery.test.ts src/components/DiscoveryPage.test.tsx`
Expected: FAIL because caches and the debounce do not exist and studio still makes two calls.

- [x] **Step 3: Implement Discovery changes**

In `src/utils/discovery.ts`:
- Add in-memory maps with TTLs and a small max size (24 pages, 8 option entries); evict oldest entries.
- Wrap `fetchDiscovery`: validate year range first, compute key from `preferred + ":" + JSON.stringify(filters) + ":" + page`, return a cached copy on hit unless `signal.aborted`, otherwise call the existing provider selection and store only successful non-aborted results.
- Wrap `fetchDiscoveryOptions` in the same way with a 30-minute TTL.
- Replace `fetchStudioDiscovery`'s two 25-item requests with one request using `perPage:50` and `page` directly.
- Preserve all filter semantics, MAL fallback behavior, and error messages.

In `src/components/DiscoveryPage.tsx`:
- Change sentinel `rootMargin` from `800px 0px` to `160px 0px`.
- In the observer callback, start a 600 ms `setTimeout` before `setPage(nextPage)`; clear it on effect cleanup.
- Do not add any eager page loading beyond the existing page-1 effect.

- [x] **Step 4: Run Discovery tests to verify pass**

Run: `npm run test:ci -- src/utils/discovery.test.ts src/components/DiscoveryPage.test.tsx`
Expected: PASS.

- [x] **Step 5: Run full gates and commit**

Run:

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

Expected: all PASS.

Commit:

```bash
git add src/utils/discovery.ts src/utils/discovery.test.ts src/components/DiscoveryPage.tsx src/components/DiscoveryPage.test.tsx
git commit -m "feat: cache Discovery pages and slow automatic loading"
```

---

### Task 4: Cap and cache title search

**Files:**
- Create: `src/utils/animeSearch.test.ts`
- Modify: `src/utils/animeSearch.ts`

**Interfaces:**
- Consumes: existing `fetchAnilist(query, variables, signal)`, `rankAnimeSearch`.
- Produces: unchanged `searchAnimeTitles(input, signal?)` signature; successful final ranked results cached by normalized input for 300000 ms.

- [x] **Step 1: Write the failing search tests**

Create `src/utils/animeSearch.test.ts`:

```ts
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));

import { fetchAnilist } from "./anilist";
import { searchAnimeTitles } from "./animeSearch";

function pageWith(id: number) {
  return {
    media: [
      {
        id,
        idMal: id + 100,
        title: { english: "One Piece", romaji: "One Piece" },
        popularity: id,
      },
    ],
  };
}

test("asks for at most three aliases for a multi-word title", async () => {
  (fetchAnilist as jest.Mock).mockResolvedValue({
    q0: pageWith(1),
    q1: pageWith(2),
    q2: pageWith(3),
  });
  const results = await searchAnimeTitles("One Piece");
  const variables = (fetchAnilist as jest.Mock).mock.calls[0][1];
  expect(Object.keys(variables)).toEqual(["q0", "q1", "q2"]);
  expect(results.map((anime) => anime.id)).toContain(1);
});

test("reuses the final ranked results for five minutes", async () => {
  jest.useFakeTimers();
  try {
    (fetchAnilist as jest.Mock).mockReset().mockResolvedValue({ q0: pageWith(9) });
    await searchAnimeTitles("Cache Me");
    await searchAnimeTitles("cache me");
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300_000);
    await searchAnimeTitles("Cache Me");
    expect(fetchAnilist).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test("does not cache failed searches", async () => {
  (fetchAnilist as jest.Mock)
    .mockReset()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ q0: pageWith(4) });
  await expect(searchAnimeTitles("No Cache")).rejects.toThrow("offline");
  await searchAnimeTitles("No Cache");
  expect(fetchAnilist).toHaveBeenCalledTimes(2);
});
```

- [x] **Step 2: Run search tests to verify failure**

Run: `npm run test:ci -- src/utils/animeSearch.test.ts`
Expected: FAIL because aliases are not capped and no cache exists.

- [x] **Step 3: Implement search changes**

In `src/utils/animeSearch.ts`:
- Change `searchVariants(...).slice(0, 7)` to `.slice(0, 3)`.
- Add a module-level cache keyed by `normalize(input.trim().slice(0, 120))`, with 300000 ms TTL and a 30-entry cap.
- Check `signal.aborted` before returning a cached value; return the cached ranked array copy.
- Store the value returned by `rankAnimeSearch`, not raw candidates; do not store failures or aborted requests.

- [x] **Step 4: Run search tests to verify pass**

Run: `npm run test:ci -- src/utils/animeSearch.test.ts`
Expected: PASS.

- [x] **Step 5: Run full gates and commit**

Run:

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

Expected: all PASS.

Commit:

```bash
git add src/utils/animeSearch.ts src/utils/animeSearch.test.ts
git commit -m "feat: cap and cache AniList title search"
```

---

### Task 5: Longer polls and reusable rating scores

**Files:**
- Modify: `src/components/HomeDashboard.tsx`
- Modify: `src/components/FollowingStories.tsx`
- Modify: `src/components/RatingPills.tsx`
- Modify: `src/components/HomeDashboard.test.tsx`
- Modify: `src/components/FollowingStories.test.tsx`
- Modify: `src/components/RatingPills.test.tsx`

**Interfaces:**
- Consumes: existing `fetchAnilist` score query and component props.
- Produces: no public signature changes; RatingPills reuses successful scores for 1800000 ms while keeping in-flight deduplication.

- [x] **Step 1: Write the failing interval and score tests**

Add to `src/components/HomeDashboard.test.tsx`:

```ts
test("Latest Episodes polls every five minutes", async () => {
  jest.useFakeTimers();
  try {
    (fetchAnilist as jest.Mock).mockReset().mockResolvedValue({
      Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] },
    });
    await act(async () =>
      root.render(
        <LatestEpisodes language="sub" setLanguage={jest.fn()} onSelect={jest.fn()} onCalendar={jest.fn()} />,
      ),
    );
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(299_999);
    });
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(fetchAnilist).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
```

Add to `src/components/FollowingStories.test.tsx`:

```ts
test("Following Stories polls every fifteen minutes", () => {
  const spy = jest.spyOn(window, "setInterval");
  try {
    renderFollowingStories({ connected: false, identity: undefined });
    const delays = spy.mock.calls.map(([, delay]) => delay);
    expect(delays).toContain(900_000);
  } finally {
    spy.mockRestore();
  }
});
```

Use the file's existing render helper; if none exists, render `<FollowingStories connected={false} identity={undefined} onConnect={jest.fn()} />` with the same `createRoot` harness used by its other tests.

Add to `src/components/RatingPills.test.tsx`:

```ts
test("reuses a successful AniList score for thirty minutes", async () => {
  jest.useFakeTimers();
  localStorage.setItem("apex_rating_source_v1", "anilist");
  (fetchAnilist as jest.Mock).mockReset().mockResolvedValue({
    Media: { averageScore: 85 },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<RatingPills id={77} idMal={78} />));
    await act(async () => root.render(<RatingPills id={77} idMal={78} />));
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(1_800_000);
    });
    await act(async () => root.render(<RatingPills id={77} idMal={78} />));
    expect(fetchAnilist).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
    jest.useRealTimers();
  }
});
```

- [x] **Step 2: Run poll/rating tests to verify failure**

Run: `npm run test:ci -- src/components/HomeDashboard.test.tsx src/components/FollowingStories.test.tsx src/components/RatingPills.test.tsx`
Expected: FAIL because intervals are still 60000/300000 and successful scores have no TTL cache.

- [x] **Step 3: Implement poll and rating changes**

In `src/components/HomeDashboard.tsx`, change the `LatestEpisodes` interval from `60000` to `300000`.

In `src/components/FollowingStories.tsx`, change the closed-panel interval from `300000` to `900000`.

In `src/components/RatingPills.tsx`:
- Keep the existing `pending` in-flight map and 500-entry cap.
- Add a successful-score map with 1800000 ms TTL and 500-entry cap; evict oldest entries.
- On a cache hit, return the cached `number | null` without calling `fetchAnilist`.
- Store only successful values; delete in-flight entries on failure and never cache rate-limit errors.

- [x] **Step 4: Run poll/rating tests to verify pass**

Run: `npm run test:ci -- src/components/HomeDashboard.test.tsx src/components/FollowingStories.test.tsx src/components/RatingPills.test.tsx`
Expected: PASS.

- [x] **Step 5: Run full gates and commit**

Run:

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

Expected: all PASS.

Commit:

```bash
git add src/components/HomeDashboard.tsx src/components/FollowingStories.tsx src/components/RatingPills.tsx src/components/HomeDashboard.test.tsx src/components/FollowingStories.test.tsx src/components/RatingPills.test.tsx
git commit -m "feat: lengthen AniList polls and reuse cached scores"
```

---

### Task 6: Push, deploy, and verify production

**Files:**
- No source changes expected; record the final commit hash from Task 5.

**Interfaces:**
- Consumes: the commit created in Task 5.
- Produces: production deployment at `https://apexanime.pages.dev/` from `main` with no tokens in command output.

- [x] **Step 1: Re-run all gates on the final tree**

Run:

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

Expected: all PASS; report exact suite/test counts.

- [x] **Step 2: Push to `main`**

Run:

```bash
git push origin main
```

Expected: push succeeds; record the pushed short hash with `git rev-parse --short HEAD`.

- [x] **Step 3: Deploy the same hash**

From `cloudflare-pages`, run the established deploy command with the recorded hash and commit message:

```bash
npx -y wrangler@4.166.0 pages deploy ../build --project-name=apexanime --branch=main --commit-hash=<final-short-hash> --commit-message=<final-commit-message>
```

Expected: deployment URL is `https://apexanime.pages.dev/`.

- [x] **Step 4: Verify live behavior in Edge**

In the user's Edge browser, check:
- Opening My List loads from cache/immediately and any import resumes without restarting at page 1.
- Search for `One Piece` sends three aliases in the GraphQL query.
- Discovery shows one initial page and only loads the next after near-bottom scroll; repeat visits reuse cached options/pages.
- The countdown pill still sits 12 px from the top and 16 px from the left and ticks in exact seconds.
- No AniList 429 occurs during a short Search → Discovery → My List walkthrough.

- [x] **Step 5: Report**

Report the commit hash, deployment URL, gate results, and any remaining server-only approximate countdown text. Never include tokens or header values from live traffic.
