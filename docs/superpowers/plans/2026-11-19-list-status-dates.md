# List status dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user first moves an anime to Watching or Completed on a connected provider, record the local calendar day as the provider's start or finish date, without touching any pre-existing entry or date.

**Architecture:** The browser computes one local `YYYY-MM-DD` string per sync and passes it to both providers. Each provider read-then-write: read the existing entry, decide whether this is a first transition into the target status with an empty date, and only then include the date in the same AniList `SaveMediaListEntry` mutation / MAL `PATCH`. No `today` value means no date-aware read and no date fields, so all existing behavior is byte-for-byte unchanged.

**Tech Stack:** TypeScript + React (browser AniList writes via `anilistRequest`), Node CommonJS (server MAL + AniList `/api/list/:provider`), Jest (`react-scripts test`), `node:test`, Wrangler Pages.

**Spec:** `docs/superpowers/specs/2026-11-19-list-status-dates-design.md`

## Global Constraints

- Write a start date **iff** target is Watching, the existing provider status is not already watching, and the existing start date is empty. Write a finish date **iff** target is Completed, the existing provider status is not already completed, and the existing finish date is empty. (design §Decisions)
- "No write when the entry is already in the target status" means **no date field** is sent; the existing status/progress/score mutation still runs exactly as before. (design §Goals, §Decisions)
- Normalize AniList `REPEATING` and MAL `rewatching` to watching for the "already watching" check. (design §Decisions)
- Progress-only and score-only updates (status unchanged) never write dates. Removal never changes dates. (design §Decisions)
- Never backfill, overwrite, or clear a provider date. Never write dates for planning/paused/dropped. (design §Intent, §Non-goals)
- One `YYYY-MM-DD` local date is computed in the browser per `sync()` call and passed unchanged to both providers; never use server/UTC time. (design §Decisions, §Anti-goals)
- Validate the `today` string before it reaches a provider: must match `/^\d{4}-\d{2}-\d{2}$/` and be a real calendar date; reject with `Error("Invalid date")`. Do this in both `validateAniListUpdate` and `validateUpdate`. (design §Constraints)
- AniList dates are `FuzzyDateInput` (`year`, `month`, `day`); the existing-entry read must return `status`, `startedAt{year month day}`, `completedAt{year month day}`. (design §Constraints)
- MAL dates are `start_date` / `finish_date` in `YYYY-MM-DD`; reading them requires `fields=my_list_status{status,num_episodes_watched,start_date,finish_date}`. (design §Constraints; MAL v2 spec, Update Entries + Fields)
- `server/list.cjs` must implement parity in **both** the AniList and MAL branches because `/api/list/anilist` also goes through `updateList`. (design §Constraints)
- Preserve the unrelated uncommitted login-fix work (`server/oauth.cjs`, `server/oauth.test.cjs`, `server/vercel.test.cjs`, `src/components/AccountSettings.tsx`, `src/hooks/useAccounts.ts`, `src/hooks/useAccounts.notifications.test.tsx`, `src/utils/anilistAuth.ts`, `src/utils/anilistAuth.test.ts`, `docs/superpowers/plans/2026-11-17-anilist-browser-token.md`). In particular, commit only the date-related hunks of `src/hooks/useAccounts.ts` — do not sweep the two `hasAniListToken` hunks into a feature commit. (design §Constraints)
- Keep tokens, secrets, and credentials out of chat, source, and command output. Wrangler is already authenticated; do not print its config.
- Push to `main` and deploy to Cloudflare Pages only after the final verification gates pass (user has already approved this feature's push/deploy).

## Review Focus

1. **An old entry already in the target status with an empty date** must not be backfilled — a reasonable person expects the feature to affect only entries watched from now on. Pinned by the "already watching / already completed" cases in Task 2 and Task 3.
2. **An entry with an existing provider date but a non-target status** must keep its real date — overwriting history is the stated anti-goal. Pinned by the "preserves an existing date" cases in Task 2 and Task 3.
3. **`REPEATING` / `rewatching` count as watching**, so resuming a rewatch must not write a fresh start date. Pinned by the rewatch cases in Task 2 and Task 3.
4. **A progress-only or score-only save that still carries `today`** must not write a date, because the status did not change. Pinned by the "progress-only with today" cases in Task 2 and Task 3.
5. **Local calendar day, not UTC/server day** — a save at 23:30 local must use the local date. Pinned by `localDate.test.ts` in Task 1 (construct with local `new Date(y, m, d, ...)`; implementation must use `getFullYear`/`getMonth`/`getDate`).

---

### Task 1: Local date helper

**Files:**
- Create: `src/utils/sync/localDate.ts`
- Test: `src/utils/sync/localDate.test.ts`
- Commit alongside: `docs/superpowers/specs/2026-11-19-list-status-dates-design.md`, `docs/superpowers/plans/2026-11-19-list-status-dates.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function localToday(now?: Date): string` — returns the local calendar day as `YYYY-MM-DD` with zero-padded month/day; defaults to `new Date()`.

- [ ] **Step 1: Write the failing test**

```ts
import { localToday } from "./localDate";

test("localToday formats the local calendar day as zero-padded YYYY-MM-DD", () => {
  expect(localToday(new Date(2026, 0, 2, 23, 30))).toBe("2026-01-02");
  expect(localToday(new Date(2026, 10, 19, 0, 5))).toBe("2026-11-19");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- --runTestsByPath src/utils/sync/localDate.test.ts`
Expected: FAIL — module `./localDate` not found.

- [ ] **Step 3: Implement `localToday` in `src/utils/sync/localDate.ts`**

Use `getFullYear()`, `getMonth() + 1`, `getDate()` (local getters, never UTC) and `String(...).padStart(2, "0")`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- --runTestsByPath src/utils/sync/localDate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-19-list-status-dates-design.md docs/superpowers/plans/2026-11-19-list-status-dates.md src/utils/sync/localDate.ts src/utils/sync/localDate.test.ts
git commit -m "feat: add local calendar-day helper for list status dates"
```

---

### Task 2: AniList browser write dates

**Files:**
- Modify: `src/utils/sync/anilistList.ts:12-32,44-50,93-118,178-217`
- Test: `src/utils/sync/anilistList.test.ts`

**Interfaces:**
- Consumes: nothing new (Task 1's `localToday` is used in Task 4, not here).
- Produces:
  - `AniListUpdateInput` gains `today?: string`.
  - `validateAniListUpdate(input)` rejects a malformed `today` with `"Invalid date"`.
  - `updateAniListEntry(input, signal?)` sends `startedAt`/`completedAt` in the same mutation only when the transition and empty-date rules in Global Constraints hold; a missing `today` causes no additional request and no date fields.

- [ ] **Step 1: Write the failing tests** in `src/utils/sync/anilistList.test.ts`

Add these tests (reuse the existing `jest.mock("../anilistAuth", ...)` and `beforeEach(jest.clearAllMocks)`):

```ts
const fuzzy = { year: 2026, month: 11, day: 19 };

test("with today, a first transition to watching writes startedAt", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: {
      progress: 0, status: "PLANNING", startedAt: null, completedAt: null,
    } } })
    .mockResolvedValueOnce({ SaveMediaListEntry: { id: 3, status: "CURRENT" } });
  await updateAniListEntry({ id: 3, status: "watching", today: "2026-11-19" });
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toMatchObject({
    startedAt: fuzzy,
  });
  expect("completedAt" in (anilistRequest as jest.Mock).mock.calls[1][1]).toBe(false);
});

test("with today, a first transition to completed writes completedAt", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: {
      progress: 11, status: "CURRENT", startedAt: { year: 2020, month: 1, day: 2 },
      completedAt: null,
    } } })
    .mockResolvedValueOnce({ SaveMediaListEntry: { id: 3, status: "COMPLETED" } });
  await updateAniListEntry({ id: 3, status: "completed", today: "2026-11-19" });
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toMatchObject({
    completedAt: fuzzy,
  });
  expect("startedAt" in (anilistRequest as jest.Mock).mock.calls[1][1]).toBe(false);
});

test.each([
  ["already watching", "CURRENT", null, null],
  ["rewatching counts as watching", "REPEATING", null, null],
  ["existing start date is preserved", "PLANNING", { year: 2020, month: 1, day: 2 }, null],
])("with today, %s writes no start date", async (_label, status, startedAt, completedAt) => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: {
      progress: 4, status, startedAt, completedAt,
    } } })
    .mockResolvedValueOnce({ SaveMediaListEntry: { id: 3, status: "CURRENT" } });
  await updateAniListEntry({ id: 3, status: "watching", today: "2026-11-19" });
  expect("startedAt" in (anilistRequest as jest.Mock).mock.calls[1][1]).toBe(false);
});

test("with today, an already completed entry writes no finish date", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: {
      progress: 12, status: "COMPLETED", completedAt: null,
    } } })
    .mockResolvedValueOnce({ SaveMediaListEntry: { id: 3, status: "COMPLETED" } });
  await updateAniListEntry({ id: 3, status: "completed", today: "2026-11-19" });
  expect("completedAt" in (anilistRequest as jest.Mock).mock.calls[1][1]).toBe(false);
});

test.each(["planning", "paused", "dropped"] as const)(
  "with today, a %s save writes no date", async (status) => {
    (anilistRequest as jest.Mock)
      .mockResolvedValueOnce({ Media: { mediaListEntry: {
        progress: 0, status: "PLANNING", startedAt: null, completedAt: null,
      } } })
      .mockResolvedValueOnce({ SaveMediaListEntry: { id: 3, status } });
    await updateAniListEntry({ id: 3, status, today: "2026-11-19" });
    const variables = (anilistRequest as jest.Mock).mock.calls[1][1];
    expect("startedAt" in variables).toBe(false);
    expect("completedAt" in variables).toBe(false);
  },
);

test("with today, a progress-only update writes no date", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: {
      progress: 1, status: "CURRENT", startedAt: null, completedAt: null,
    } } })
    .mockResolvedValueOnce({ SaveMediaListEntry: { id: 3, status: "CURRENT", progress: 5 } });
  await updateAniListEntry({
    id: 3, status: "watching", progress: 5, today: "2026-11-19",
  });
  const variables = (anilistRequest as jest.Mock).mock.calls[1][1];
  expect("startedAt" in variables).toBe(false);
  expect("completedAt" in variables).toBe(false);
  expect(variables.progress).toBe(5);
});

test("without today, a status-only update makes no pre-read and sends no dates", async () => {
  (anilistRequest as jest.Mock).mockResolvedValueOnce({
    SaveMediaListEntry: { id: 3, status: "CURRENT" },
  });
  await updateAniListEntry({ id: 3, status: "watching" });
  expect(anilistRequest).toHaveBeenCalledTimes(1);
  expect("startedAt" in (anilistRequest as jest.Mock).mock.calls[0][1]).toBe(false);
});

test("rejects an invalid today before any request", () => {
  expect(() => validateAniListUpdate({
    id: 3, status: "watching", today: "2026-2-30",
  })).toThrow("Invalid date");
  expect(anilistRequest).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ci -- --runTestsByPath src/utils/sync/anilistList.test.ts`
Expected: FAIL — date variables absent, no extra read, and `today` not rejected.

- [ ] **Step 3: Implement in `src/utils/sync/anilistList.ts`**

  - Add `today?: string` to `AniListUpdateInput`.
  - Add `today` validation to `validateAniListUpdate` using the format/roundtrip check from Global Constraints; throw `Error("Invalid date")`.
  - Add constants mirroring `server/list.cjs`:
    - `EXISTING_ENTRY_WITH_DATES_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{progress status startedAt{year month day} completedAt{year month day}}}}"`
    - `SAVE_MUTATION_WITH_DATES = "mutation($id:Int,$status:MediaListStatus,$progress:Int,$score:Int,$startedAt:FuzzyDateInput,$completedAt:FuzzyDateInput){SaveMediaListEntry(mediaId:$id,status:$status,progress:$progress,scoreRaw:$score,startedAt:$startedAt,completedAt:$completedAt){id status progress score(format:POINT_100)}}"`
  - Inside `serialize`, extend the read condition to `(progress !== undefined && !input.manualProgress) || input.automatic || input.today !== undefined`, and pick `EXISTING_ENTRY_WITH_DATES_QUERY` when `input.today` is set (otherwise the existing `EXISTING_ENTRY_QUERY`).
  - Keep the existing forward-progress and automatic-completion status logic unchanged. Compute the date variables from the **final** `status`: `startedAt: {year, month, day}` when `status === "CURRENT"` and `existing?.status` is neither `"CURRENT"` nor `"REPEATING"` and `existing?.startedAt` has no truthy component; `completedAt: {year, month, day}` when `status === "COMPLETED"` and `existing?.status !== "COMPLETED"` and `existing?.completedAt` has no truthy component. Parse `today` with `slice(0,4)/slice(5,7)/slice(8,10)` → `Number`.
  - Use `SAVE_MUTATION_WITH_DATES` and spread `startedAt`/`completedAt` into the variables only when a date variable was computed; otherwise use the existing `SAVE_MUTATION` and variables exactly as today (never pass `null`, which would clear a date).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:ci -- --runTestsByPath src/utils/sync/anilistList.test.ts`
Expected: PASS, including all pre-existing tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sync/anilistList.ts src/utils/sync/anilistList.test.ts
git commit -m "feat: write AniList start and finish dates on first status change"
```

---

### Task 3: Server write dates for AniList and MAL

**Files:**
- Modify: `server/list.cjs:33-133` (`validateUpdate`, `updateList`)
- Test: `server/oauth.test.cjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `updateList(provider, account, input)` accepts `input.today?: string`, validates it, and includes the correct date field only on a first transition into the target status with an empty date. `validateUpdate` rejects a malformed `today` with `"Invalid date"`.

- [ ] **Step 1: Write the failing tests** in `server/oauth.test.cjs`

```js
test("dates are written only on first transitions, on both server providers", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("graphql")) {
      const input = JSON.parse(options.body);
      return json({
        data: input.query.startsWith("mutation")
          ? { SaveMediaListEntry: { id: 1, status: input.variables.status } }
          : { Media: { mediaListEntry: {
              status: "PLANNING", progress: 0, startedAt: null, completedAt: null,
            } } },
      });
    }
    return json({ my_list_status: {
      status: "plan_to_watch", num_episodes_watched: 0,
      start_date: null, finish_date: null,
    } });
  };
  try {
    await updateList("anilist", { accessToken: "t" }, {
      id: 1, status: "watching", today: "2026-11-19",
    });
    const aniVariables = JSON.parse(calls.at(-1).options.body).variables;
    assert.deepEqual(aniVariables.startedAt, { year: 2026, month: 11, day: 19 });
    assert.equal("completedAt" in aniVariables, false);

    await updateList("mal", { accessToken: "t" }, {
      id: 1, status: "watching", today: "2026-11-19",
    });
    const malFields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(malFields.get("start_date"), "2026-11-19");
    assert.equal(malFields.has("finish_date"), false);
    assert.match(calls.at(-2).url, /start_date,finish_date/);
  } finally {
    global.fetch = browserFetch;
  }
});

test("existing dates, target status, rewatch and progress-only saves write no date", async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("graphql")) {
      const input = JSON.parse(options.body);
      return json({
        data: input.query.startsWith("mutation")
          ? { SaveMediaListEntry: { id: 1, status: input.variables.status } }
          : { Media: { mediaListEntry: {
              status: "REPEATING", progress: 5,
              startedAt: { year: 2020, month: 1, day: 2 }, completedAt: null,
            } } },
      });
    }
    return json({ my_list_status: {
      status: "rewatching", num_episodes_watched: 5, start_date: "2020-01-02",
      finish_date: null,
    } });
  };
  try {
    await updateList("anilist", { accessToken: "t" }, {
      id: 1, status: "watching", today: "2026-11-19",
    });
    let variables = JSON.parse(calls.at(-1).options.body).variables;
    assert.equal("startedAt" in variables, false);

    await updateList("anilist", { accessToken: "t" }, {
      id: 1, status: "watching", progress: 6, today: "2026-11-19",
    });
    variables = JSON.parse(calls.at(-1).options.body).variables;
    assert.equal("startedAt" in variables, false);
    assert.equal(variables.progress, 6);

    await updateList("mal", { accessToken: "t" }, {
      id: 1, status: "watching", today: "2026-11-19",
    });
    let fields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(fields.has("start_date"), false);

    await updateList("mal", { accessToken: "t" }, {
      id: 1, status: "completed", today: "2026-11-19",
    });
    fields = new URLSearchParams(calls.at(-1).options.body);
    assert.equal(fields.get("finish_date"), "2026-11-19");
  } finally {
    global.fetch = browserFetch;
  }
});

test("validateUpdate rejects a malformed today", () => {
  assert.throws(
    () => validateUpdate({ id: 1, status: "watching", today: "2026-02-30" }),
    /Invalid date/,
  );
  assert.doesNotThrow(() =>
    validateUpdate({ id: 1, status: "watching", today: "2026-11-19" }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:server`
Expected: FAIL — no date fields/variables and no `today` validation.

- [ ] **Step 3: Implement in `server/list.cjs`**

  - Extend `validateUpdate` with the same `/^\d{4}-\d{2}-\d{2}$/` format + real-calendar-day check from Global Constraints; throw `Error("Invalid date")`.
  - Add a small helper used by both branches: given `today`, the final provider target status, the existing entry, and provider field names, return the date field to write, or `null`. Treat AniList `CURRENT`/`REPEATING` and MAL `watching`/`rewatching` as watching; treat `COMPLETED`/`completed` as completed; treat `startedAt` with no truthy `year`/`month`/`day` and `start_date`/`finish_date` that are null/empty as empty.
  - AniList branch: extend the read condition with `|| input.today !== undefined` and use `"query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{progress status startedAt{year month day} completedAt{year month day}}}}"` when `today` is set. Keep forward-progress and automatic-completion logic unchanged. When a date field is due, use a mutation declaring `$startedAt:FuzzyDateInput,$completedAt:FuzzyDateInput` and passing `startedAt:$startedAt,completedAt:$completedAt` to `SaveMediaListEntry`, with the variables built from `today`; otherwise use the existing mutation/variables untouched.
  - MAL branch: extend the read condition with `|| input.today !== undefined` and use `".../anime/" + input.id + "?fields=my_list_status{status,num_episodes_watched,start_date,finish_date}"` when `today` is set (keep the plain `my_list_status` URL otherwise). Keep forward-progress and automatic-completion logic unchanged. Set `start_date` or `finish_date` on the PATCH `URLSearchParams` only when the helper returns that field.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:server`
Expected: PASS, including all pre-existing tests unchanged (they send no `today`).

- [ ] **Step 5: Commit**

```bash
git add server/list.cjs server/oauth.test.cjs
git commit -m "feat: write provider start and finish dates on first status change"
```

Note: stage only the date-related hunks of `server/oauth.test.cjs` if unrelated login-fix hunks are present.

---

### Task 4: Wire the single sync fan-out point

**Files:**
- Modify: `src/hooks/useAccounts.ts` (imports, `sendListUpdate` signature + AniList call + MAL body, `sync`)

**Interfaces:**
- Consumes: `localToday()` from Task 1; `updateAniListEntry({ ..., today })` from Task 2; `/api/list/mal` accepting `today` from Task 3.
- Produces: every manual (`ListControls`) and automatic (`App.markWatched`) update receives one identical `today` string; no other call site changes.

- [ ] **Step 1: Add the failing contract test**

Because `src/hooks/useAccounts.notifications.test.tsx` is unrelated in-progress work, put this in a new file `src/hooks/useAccounts.dates.test.tsx` that mocks the provider modules and asserts the payloads. If a full hook render is impractical, test `sendListUpdate` directly with `today` and assert the MAL `fetch` body contains it and the AniList call receives it:

```tsx
test("sendListUpdate forwards today to both providers", async () => {
  // mock ../utils/sync/anilistList.updateAniListEntry -> { status: "CURRENT" }
  // mock global.fetch for /api/list/mal -> { success: true, entry: {...} }
  await sendListUpdate("anilist", { id: 1 }, "watching", undefined, false, undefined, "2026-11-19");
  expect(updateAniListEntry).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1, today: "2026-11-19" }),
  );
  await sendListUpdate("mal", { idMal: 2 }, "watching", undefined, false, undefined, "2026-11-19");
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls.at(-1)[1].body).today)
    .toBe("2026-11-19");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- --runTestsByPath src/hooks/useAccounts.dates.test.tsx`
Expected: FAIL — `sendListUpdate` takes no `today` argument.

- [ ] **Step 3: Wire `today` through `useAccounts.ts`**

  - Import `localToday` from `../utils/sync/localDate`.
  - Add a trailing `today?: string` parameter to `sendListUpdate` (after `edit`).
  - Pass `today` into `updateAniListEntry({ ..., today })` and include `...(today ? { today } : {})` in the `/api/list/mal` JSON body.
  - In `sync()`, compute `const today = localToday();` once at the top of the queued task (before the `Promise.allSettled` map) and pass it as the final argument to every `sendListUpdate` call. Do not recompute per provider.
  - Leave the `hasAniListToken` import and `setConnected` changes untouched — they are unrelated uncommitted work.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:ci -- --runTestsByPath src/hooks/useAccounts.dates.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit only the date-related hunks**

```bash
git add -p src/hooks/useAccounts.ts
git add src/hooks/useAccounts.dates.test.tsx
git commit -m "feat: pass one local date to both list providers on sync"
```

Stage only the `localToday` import, the `sendListUpdate` signature/body changes, and the `sync` call change. Do **not** stage the two `hasAniListToken` hunks.

---

### Task 5: Full verification, push, and deploy

**Files:** none (verification and release only).

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Run every gate and record the output**

```bash
npm run test:ci
npm run typecheck
npm run build
npm run test:server
```

Expected: all four exit 0. If any fails, fix the failure in the owning task before continuing.

- [ ] **Step 2: Confirm the working tree contains only the preserved unrelated work**

Run: `git status --short`
Expected: only the pre-existing login-fix files listed in Global Constraints remain modified/untracked; no feature files are left unstaged.

- [ ] **Step 3: Push the feature commits**

Run: `git push origin HEAD:main`
Expected: `origin/main` advances to the new HEAD. Confirm with `git log -1 --oneline` and `git rev-parse HEAD` (capture the full hash and the commit message for the deploy command).

- [ ] **Step 4: Deploy the built site to Cloudflare Pages**

From `cloudflare-pages`, using the full hash and message from Step 3:

```bash
npx wrangler pages deploy ../build --project-name apexanime --branch main --commit-hash <full-hash> --commit-message "<head-commit-message>"
```

Expected: a new production deployment URL is returned. Do not print or paste any credentials.

- [ ] **Step 5: Verify live**

Open the production URL and confirm the app loads and a status change still succeeds against the connected providers; confirm the deployed bundle filename differs from the previous `main.733a7116.js` (the build output directory is `build/` per `cloudflare-pages/wrangler.jsonc`).
