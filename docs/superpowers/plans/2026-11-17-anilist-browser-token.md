# AniList Browser Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AniList list reads and writes work from the user's browser using a session-delivered token, while leaving MAL behavior unchanged.

**Architecture:** Add one additive same-origin OAuth endpoint that returns the connected AniList access token. Store that token in `localStorage`, expose one async accessor/request wrapper, and route all browser AniList list and activity calls through the existing direct GraphQL transport. The server keeps the OAuth exchange, session, and client secret; existing server AniList proxy routes stay for compatibility but the frontend stops calling them.

**Tech Stack:** Node.js/CommonJS server tests, React 18/TypeScript frontend, Jest + React Testing Library-style harnesses, Cloudflare Worker/Pages deployment on `main`.

**Spec:** `docs/superpowers/specs/2026-11-17-anilist-browser-token-design.md`

## Global Constraints

- Token endpoint: `GET /api/oauth/anilist/token`.
- Token storage key: `apex_anilist_token_v1`; payload: `{ accessToken, expiresAt, identity }`.
- Invalid-token event: `apex:anilist-auth-invalid`.
- All authenticated browser AniList calls use `fetchAnilist(query, variables, signal, token)`.
- Server OAuth exchange, connected session, and client secret remain server-side.
- Existing `/api/oauth/anilist/graphql` and `/api/list/anilist` server routes remain for compatibility; frontend does not use them for AniList.
- MAL read/update/remove paths remain unchanged.
- No hosting changes, new paid infrastructure, or OAuth app re-registration.
- Do not reintroduce module-level cross-request Promise/Response sharing in `server/anilist-api.cjs`.
- Do not commit, deploy, or expose the existing uncommitted playback edits in `server/playback.cjs`, `server/reanime.cjs`, or `src/components/NativeVideoPlayer.tsx`.
- No real tokens, client secrets, or credentials in chat, source files, commits, or command output; tests may use obvious fake values such as `token-from-session`.
- Push directly to `main`; no PR unless explicitly requested.
- Deploy the additive server change first, then the frontend change.
- If live behavior is not fixed, revert the frontend change and push the revert as previously requested.

## Review Focus

- **Connected session but no usable local token before first import:** first AniList consumer must await token rehydration before any GraphQL request, and rehydration must fetch from the server once per page load even if stale local storage exists. Covered in Task 2 (`getAniListToken rehydrates...`, `getAniListToken rejects...`) and Task 4 (updated import tests).
- **Invalid token returned as GraphQL error with HTTP 400:** transport must expose the GraphQL message so the shared wrapper can invalidate and dispatch the event. Covered in Task 2 (`fetchAnilist exposes status...`) and Task 2 (`anilistRequest invalidates...`).
- **Reconnect as a different AniList user:** local token must be replaced and identity verified from `Viewer`; stale identity-keyed library caches must not be reused. Covered in Task 2 (`getAniListToken rehydrates...`, `getAniListToken reuses...`) and Task 4 (`account change cannot expose...`).
- **MAL must not change:** MAL still uses `/api/list/mal` and existing server behavior. Covered in Task 4, Task 5, and Task 6 tests that assert MAL fetch URLs/bodies.
- **Progress, score, completion, and removal parity:** automatic completion stays `COMPLETED`, progress never moves backward unless manual, scores round to POINT_100 and normalize back to 0–10, `updatedAt` becomes milliseconds, and removal deletes the media list entry id. Covered in Task 3 tests.

---

## File Structure

- `server/oauth.cjs` — add the additive AniList token endpoint only.
- `server/oauth.test.cjs` — cover token endpoint success, no session, expired account, and no refresh secret leakage.
- `src/utils/anilist.ts` — add a typed request error carrying HTTP status and GraphQL messages; keep `fetchAnilist` signature unchanged.
- `src/utils/anilistAuth.ts` — new token storage, accessor, request wrapper, invalidation event.
- `src/utils/anilistAuth.test.ts` — new tests for token lifecycle and direct GraphQL auth handling.
- `src/utils/sync/anilistList.ts` — new AniList-only read/update/remove port with validation and normalization.
- `src/utils/sync/anilistList.test.ts` — new parity tests for the port.
- `src/hooks/useLibrary.ts` — route AniList page reads to `readAniListList`; keep MAL fetch.
- `src/hooks/useLibrary.test.tsx` — mock the AniList client instead of `/api/list/anilist`.
- `src/hooks/useAccounts.ts` — route AniList update/remove to the browser client; listen for invalid-token event; clear token on disconnect.
- `src/hooks/useAccounts.notifications.test.tsx` and `src/components/VideoPlayer.test.tsx` — mock AniList write client while preserving MAL assertions.
- `src/components/ListEntryEditor.tsx` — route AniList single-entry reads to the browser client.
- `src/components/ListEntryEditor.test.tsx` — mock AniList entry reads while preserving MAL fetch assertions.
- `src/utils/followingStories.ts`, `src/utils/friendsActivity.ts` — replace proxied GraphQL fetches with `anilistRequest`.
- `src/utils/followingStories.test.ts`, `src/utils/friendsActivity.test.ts` — assert direct `anilistRequest` usage and identity checks.
- `src/utils/sync/aniListClient.ts` — use token accessor and `anilistRequest` for authenticated mutation; clear browser token on logout.
- `src/utils/sync/aniListClient.test.ts` — new tests for direct mutation and logout cleanup.
- `src/utils/cleanup.test.ts` — extend existing `fetchAnilist` failure test for typed status/GraphQL errors.

## Test Commands

- Server: `npm run test:server`
- Frontend single files: `npm run test:ci -- <path> [<path> ...]`
- Full frontend: `npm run test:ci`
- Types: `npm run typecheck`
- Build: `npm run build`

---

### Task 1: Add AniList token endpoint

**Files:**
- Modify: `server/oauth.cjs:157-308`
- Test: `server/oauth.test.cjs`

**Interfaces:**
- Consumes: existing `sessions`, `accessAccount(session, provider)`, `send(status, data)`.
- Produces: `GET /api/oauth/anilist/token` returning `200 { accessToken, expiresAt, identity? }`, `401 { error: "Not connected" }`, or existing `502` error envelope. `identity` is `String(account.identity.id)` only when known. Never returns `refreshToken`, client secret, or session id.

- [ ] **Step 1: Write failing server tests**

Add to `server/oauth.test.cjs` using the existing `serve()` helper and exported `sessions`:

```js
test("AniList token endpoint returns only the connected access token", async () =>
  serve(async (base) => {
    const id = "a".repeat(64);
    const expiresAt = Date.now() + 3600000;
    sessions.set(id, {
      accounts: {
        anilist: {
          accessToken: "token-from-session",
          refreshToken: "refresh-from-session",
          expiresAt,
          identity: { id: 77, name: "Tester" },
        },
      },
      expiresAt: Date.now() + 3600000,
    });
    const response = await browserFetch(
      base + "/api/oauth/anilist/token",
      { headers: { Cookie: "apex_session=" + id } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accessToken: "token-from-session",
      expiresAt,
      identity: "77",
    });
  }));
test("AniList token endpoint rejects missing or expired sessions", async () =>
  serve(async (base) => {
    assert.equal(
      (await browserFetch(base + "/api/oauth/anilist/token")).status,
      401,
    );
    const id = "b".repeat(64);
    sessions.set(id, {
      accounts: {
        anilist: {
          accessToken: "expired-token",
          expiresAt: Date.now() - 1000,
        },
      },
      expiresAt: Date.now() + 3600000,
    });
    const expired = await browserFetch(
      base + "/api/oauth/anilist/token",
      { headers: { Cookie: "apex_session=" + id } },
    );
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { error: "Not connected" });
  }));
```

- [ ] **Step 2: Run server tests to verify failure**

Run: `npm run test:server`
Expected: FAIL with `404 Not found` for `/api/oauth/anilist/token`.

- [ ] **Step 3: Implement the token endpoint**

In `server/oauth.cjs`, extend the OAuth action regex to include `token`. For `provider === "anilist"`, `action === "token"`, and `GET`, use `await accessAccount(current, provider)`, then return `401 { error: "Not connected" }` when absent, otherwise return only `{ accessToken, expiresAt, identity? }`. Do not change OAuth start/callback/session/logout/graphql behavior. Do not add a MAL token route.

- [ ] **Step 4: Run server tests**

Run: `npm run test:server`
Expected: PASS, including the existing OAuth and list tests.

- [ ] **Step 5: Commit only this task**

```bash
git add server/oauth.cjs server/oauth.test.cjs
git commit -m "feat: expose connected AniList token to browser"
git rev-parse HEAD
```

Record the printed hash as `<task-1-commit>` for Task 8.

---

### Task 2: Add typed transport errors and browser token accessor

**Files:**
- Modify: `src/utils/anilist.ts`
- Create: `src/utils/anilistAuth.ts`
- Create: `src/utils/anilistAuth.test.ts`
- Modify: `src/utils/cleanup.test.ts`

**Interfaces:**
- Consumes: `fetchAnilist<T>(query, variables, signal, token)`.
- Produces from `src/utils/anilist.ts`: `AniListRequestError extends Error` with `status?: number` and `graphqlErrors: string[]`; existing `fetchAnilist` signature unchanged.
- Produces from `src/utils/anilistAuth.ts`:
  - `ANILIST_TOKEN_KEY = "apex_anilist_token_v1"`
  - `ANILIST_AUTH_INVALID_EVENT = "apex:anilist-auth-invalid"`
  - `interface AniListToken { accessToken: string; expiresAt: number; identity?: string }`
  - `class AniListAuthError extends Error`
  - `readAniListToken(): AniListToken | null`
  - `writeAniListToken(token: AniListToken): void`
  - `clearAniListToken(): void`
  - `invalidateAniListAuth(): void`
  - `getAniListToken(signal?: AbortSignal): Promise<AniListToken>`
  - `anilistRequest<T>(query: string, variables?: Record<string, unknown>, signal?: AbortSignal): Promise<T>`

- [ ] **Step 1: Write failing frontend tests**

In `src/utils/cleanup.test.ts`, extend the existing AniList failure test:

```ts
mock.mockResolvedValueOnce(response({ errors: [{ message: "Invalid token" }] }, 400));
await expect(fetchAnilist("query {}")).rejects.toMatchObject({
  status: 400,
  graphqlErrors: ["Invalid token"],
});
```

Create `src/utils/anilistAuth.test.ts` with these test names and assertions:

```ts
// mock ./anilist so getAniListToken's Viewer verification is deterministic
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));
import { fetchAnilist } from "./anilist";
import {
  ANILIST_AUTH_INVALID_EVENT,
  ANILIST_TOKEN_KEY,
  AniListAuthError,
  anilistRequest,
  clearAniListToken,
  getAniListToken,
  invalidateAniListAuth,
  readAniListToken,
} from "./anilistAuth";

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  invalidateAniListAuth(); // clears in-memory rehydration promise between tests
});

test("getAniListToken rehydrates from the token endpoint and verifies Viewer identity", async () => {
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "old-token",
    expiresAt: Date.now() + 3600000,
    identity: "1",
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      accessToken: "new-token",
      expiresAt: Date.now() + 3600000,
    }),
  });
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77 } });
  const token = await getAniListToken();
  expect(token).toMatchObject({ accessToken: "new-token", identity: "77" });
  expect(readAniListToken()).toMatchObject({ accessToken: "new-token", identity: "77" });
});

test("getAniListToken reuses the in-page rehydrated token without another endpoint call", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      accessToken: "token-from-session",
      expiresAt: Date.now() + 3600000,
    }),
  });
  (fetchAnilist as jest.Mock).mockResolvedValue({ Viewer: { id: 77 } });
  await getAniListToken();
  await getAniListToken();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("getAniListToken rejects and invalidates when token endpoint is 401", async () => {
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "stale-token",
    expiresAt: Date.now() - 1,
    identity: "1",
  }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Not connected" }),
  });
  await expect(getAniListToken()).rejects.toBeInstanceOf(AniListAuthError);
  expect(readAniListToken()).toBeNull();
});

test("anilistRequest invalidates on HTTP 401 or Invalid token GraphQL errors", async () => {
  (fetchAnilist as jest.Mock)
    .mockResolvedValueOnce({ Viewer: { id: 77 } })
    .mockRejectedValueOnce(Object.assign(new Error("Invalid token"), {
      status: 400,
      graphqlErrors: ["Invalid token"],
    }));
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "valid-token",
    expiresAt: Date.now() + 3600000,
    identity: "77",
  }));
  const listener = jest.fn();
  window.addEventListener(ANILIST_AUTH_INVALID_EVENT, listener);
  await expect(anilistRequest("query { Viewer { id } }")).rejects.toThrow(
    "reconnect",
  );
  expect(readAniListToken()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener(ANILIST_AUTH_INVALID_EVENT, listener);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:ci -- src/utils/anilistAuth.test.ts src/utils/cleanup.test.ts`
Expected: FAIL because `AniListRequestError` and `src/utils/anilistAuth.ts` do not exist.

- [ ] **Step 3: Add `AniListRequestError` to `src/utils/anilist.ts`**

Keep the public `fetchAnilist` signature and existing error messages. On `429`, throw `AniListRequestError(rateLimitMessage, 429)` after preserving the existing public backoff. On non-ok responses, try `response.json()` and pass any `errors[].message` values as `graphqlErrors` while keeping the existing `AniList request failed (status)` message when no GraphQL message exists. On GraphQL `errors`, throw `AniListRequestError(messages.join("; "), response.status, messages)`. On missing data, keep the existing no-data message.

- [ ] **Step 4: Implement `src/utils/anilistAuth.ts`**

Use the exact exports from the Interfaces block. Implement these rules:
- `readAniListToken` parses the single storage key and returns `null` for missing/corrupt data.
- `writeAniListToken`/`clearAniListToken` swallow `localStorage` failures.
- `invalidateAniListAuth` clears storage, clears any in-memory token promise, and dispatches `new Event(ANILIST_AUTH_INVALID_EVENT)` on `window` when `window` exists.
- `clearAniListToken` also clears any in-memory token promise so the next call rehydrates from the server.
- Keep a module-level in-memory `Promise<AniListToken>` so rehydration happens once per page load. `getAniListToken` returns its resolved value only while `expiresAt > Date.now() + 60000` and `identity` is non-empty; otherwise it clears the promise and fetches `/api/oauth/anilist/token` with `{ credentials: "same-origin", cache: "no-store", signal }`. This means the first call always fetches and replaces stale local storage, even when local data looks valid.
- A `401` token endpoint response or unusable payload calls `invalidateAniListAuth()` and throws `AniListAuthError("AniList connection required. Please reconnect.")`. A non-auth endpoint failure clears the in-memory promise so a later call may retry.
- Determine identity with one authenticated `fetchAnilist<{ Viewer: { id: number } }>("query{Viewer{id}}", {}, signal, accessToken)` call. If the endpoint supplied `identity`, require an exact string match or invalidate; then `writeAniListToken` the verified payload and return it.
- `anilistRequest` calls `getAniListToken(signal)`, then `fetchAnilist<T>(query, variables ?? {}, signal, token.accessToken)`. It treats `AniListRequestError` with `status === 401` or any `graphqlErrors` message matching `/invalid token/i` as auth invalid: call `invalidateAniListAuth()` and throw `AniListAuthError("AniList authorization expired. Please reconnect.")`. All other errors pass through unchanged.

- [ ] **Step 5: Run tests**

Run: `npm run test:ci -- src/utils/anilistAuth.test.ts src/utils/cleanup.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/anilist.ts src/utils/anilistAuth.ts src/utils/anilistAuth.test.ts src/utils/cleanup.test.ts
git commit -m "feat: add browser AniList token accessor"
```

---

### Task 3: Add AniList-only browser list client

**Files:**
- Create: `src/utils/sync/anilistList.ts`
- Create: `src/utils/sync/anilistList.test.ts`

**Interfaces:**
- Consumes: `anilistRequest<T>(query, variables?, signal?)` from Task 2.
- Produces:
  - `interface AniListListPage { identity: string; name: string; hasNextPage: boolean; entries: LibraryEntry[] }`
  - `interface AniListEntry { status: ListStatus; progress: number; score?: number }`
  - `interface AniListMutationEntry { id?: number; status: string; progress?: number; score?: number }`
  - `interface AniListUpdateInput { id: number; status: ListStatus; progress?: number; score?: number; automatic?: boolean; manualProgress?: boolean }`
  - `validateAniListUpdate(input: AniListUpdateInput): AniListUpdateInput`
  - `readAniListList(page: number, signal?: AbortSignal): Promise<AniListListPage>`
  - `readAniListEntry(animeId: number, signal?: AbortSignal): Promise<AniListEntry | null>`
  - `updateAniListEntry(input: AniListUpdateInput, signal?: AbortSignal): Promise<AniListMutationEntry>`
  - `removeAniListEntry(animeId: number, signal?: AbortSignal): Promise<boolean>`

- [ ] **Step 1: Write failing parity tests**

Mock `../anilistAuth` in `src/utils/sync/anilistList.test.ts`. Add these tests:

```ts
test("readAniListList normalizes identity, score, status and updatedAt", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Viewer: { id: 2, name: "Alice" } })
    .mockResolvedValueOnce({
      Page: {
        pageInfo: { hasNextPage: true },
        mediaList: [{
          status: "PAUSED", progress: 7, score: 850, updatedAt: 10,
          media: { id: 3, idMal: 4, title: { english: "Example" } },
        }],
      },
    });
  const page = await readAniListList(2);
  expect(page).toMatchObject({
    identity: "2", name: "Alice", hasNextPage: true,
    entries: [{ status: "paused", progress: 7, score: 8.5, updatedAt: 10000 }],
  });
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toEqual({
    user: 2, page: 2,
  });
});

test("updates preserve automatic completion, forward progress and POINT_100 scores", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({
      Media: { mediaListEntry: { progress: 9, status: "COMPLETED" } },
    })
    .mockResolvedValueOnce({
      SaveMediaListEntry: { id: 5, status: "COMPLETED", progress: 9, score: 90 },
    });
  const result = await updateAniListEntry({
    id: 3, status: "watching", progress: 4, score: 9, automatic: true,
  });
  expect(result).toMatchObject({ status: "COMPLETED", progress: 9, score: 90 });
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toMatchObject({
    id: 3, status: "COMPLETED", progress: 9, score: 90,
  });
});

test("removeAniListEntry finds the list entry id before deleting it", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: { id: 55 } } })
    .mockResolvedValueOnce({ DeleteMediaListEntry: { deleted: true } });
  expect(await removeAniListEntry(3)).toBe(true);
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toEqual({ id: 55 });
});

test("invalid updates are rejected before any request", async () => {
  await expect(validateAniListUpdate({
    id: 1, status: "watching", progress: -1,
  })).toThrow("Invalid episode progress");
  await expect(validateAniListUpdate({
    id: 1, status: "watching", score: 11,
  })).toThrow("Score must be a whole number from 0 to 10");
  expect(anilistRequest).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:ci -- src/utils/sync/anilistList.test.ts`
Expected: FAIL because `src/utils/sync/anilistList.ts` does not exist.

- [ ] **Step 3: Implement the AniList list client**

Port only AniList behavior from `server/list.cjs` and `server/list.cjs:228-258` into `src/utils/sync/anilistList.ts`:
- Use type-only imports for `LibraryEntry` from `../../hooks/useLibrary` and `ListStatus` from `../../hooks/useAccounts`; do not add runtime imports back into the hooks.
- Use the exact GraphQL query strings from the server implementation.
- Use status maps `{ watching: CURRENT, planning: PLANNING, completed: COMPLETED, paused: PAUSED, dropped: DROPPED }` and reverse them for reads.
- Use `score(format:POINT_100) / 10` for reads, `(entry.score || 0) / 10` for entry reads, `Math.round(score * 10)` for writes, and `updatedAt * 1000` for list entries.
- Preserve validation messages from `server/list.cjs:33-58`.
- Preserve forward-progress and automatic-complete behavior from `server/list.cjs:67-100`.
- Preserve removal behavior: query media list entry id, return `true` if none exists, then delete and require `deleted === true`.
- Use a module-level `Map<string, Promise<unknown>>` keyed by `anilist:<id>` only to serialize update/remove operations for the same anime. Do not cache or share request results/Responses.

- [ ] **Step 4: Run test**

Run: `npm run test:ci -- src/utils/sync/anilistList.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sync/anilistList.ts src/utils/sync/anilistList.test.ts
git commit -m "feat: add browser AniList list client"
```

---

### Task 4: Route library imports through the browser client

**Files:**
- Modify: `src/hooks/useLibrary.ts:125-310`
- Test: `src/hooks/useLibrary.test.tsx`

**Interfaces:**
- Consumes: `readAniListList(page: number, signal?: AbortSignal)` from Task 3.
- Produces: unchanged `useLibrary(connected)` return shape and unchanged snapshot/cache behavior.

- [ ] **Step 1: Update failing tests to mock the AniList client**

At the top of `src/hooks/useLibrary.test.tsx`:

```ts
jest.mock("../utils/sync/anilistList", () => ({ readAniListList: jest.fn() }));
import { readAniListList } from "../utils/sync/anilistList";
```

In `beforeEach`, set `readAniListList` to a mock that returns the existing `page(identity, status, next)` shape based on the page argument. Replace fetch assertions with:

```ts
expect(readAniListList).toHaveBeenCalledWith(2, undefined);
expect(readAniListList).toHaveBeenCalledWith(30, undefined);
expect(global.fetch).toHaveBeenCalledWith(
  "/api/list/mal?page=1",
  expect.anything(),
);
```

Keep all existing identity/cache/confirmed-change assertions.

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:ci -- src/hooks/useLibrary.test.tsx`
Expected: FAIL because `useLibrary` still fetches `/api/list/anilist`.

- [ ] **Step 3: Implement routing**

In `useLibrary.ts`, import `readAniListList`. Inside `refreshLibrary`, replace only the AniList branch of the list fetch with `await readAniListList(page)`; keep the MAL `/api/list/mal?page=` fetch and `cache: "no-store"` unchanged. Keep the `data.entries`/`data.identity` validation, generation cancellation, pagination delay, and localStorage identity checks unchanged.

- [ ] **Step 4: Run test**

Run: `npm run test:ci -- src/hooks/useLibrary.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLibrary.ts src/hooks/useLibrary.test.tsx
git commit -m "feat: read AniList library from browser"
```

---

### Task 5: Route list updates/removes and handle invalid auth

**Files:**
- Modify: `src/hooks/useAccounts.ts:1-107`, `src/hooks/useAccounts.ts:148-198`, `src/hooks/useAccounts.ts:414-443`
- Test: `src/hooks/useAccounts.notifications.test.tsx`
- Test: `src/components/VideoPlayer.test.tsx`

**Interfaces:**
- Consumes: `updateAniListEntry`, `removeAniListEntry` from Task 3; `clearAniListToken` and `ANILIST_AUTH_INVALID_EVENT` from Task 2.
- Produces: unchanged `sendListUpdate` signature and `AccountResult` shape; unchanged `useAccounts()` return shape.

- [ ] **Step 1: Update failing tests**

In `src/components/VideoPlayer.test.tsx`, mock the AniList write client and replace the final AniList error setup with:

```ts
jest.mock("../utils/sync/anilistList", () => ({
  updateAniListEntry: jest.fn(),
  removeAniListEntry: jest.fn(),
}));
import { updateAniListEntry } from "../utils/sync/anilistList";

(updateAniListEntry as jest.Mock).mockRejectedValueOnce(
  new Error("Please reconnect"),
);
expect((await sendListUpdate("anilist", anime, "watching", 3)).error).toBe(
  "Please reconnect",
);
expect(global.fetch).not.toHaveBeenCalled();
```

Keep the MAL fetch assertions unchanged.

In `src/hooks/useAccounts.notifications.test.tsx`, mock `updateAniListEntry`/`removeAniListEntry`. Return `{ status: "CURRENT", progress: 4, score: body.score * 10 }` for AniList updates and `true` for AniList removals. Update the removal assertions so `removeAniListEntry` is called with `anime.id` for AniList, while MAL still fetches `/api/list/mal` and returns the reconnect error.

Add one new test in `src/hooks/useAccounts.notifications.test.tsx`:

```ts
test("invalid AniList token disconnects AniList locally without changing MAL", async () => {
  // Use the same /api/accounts mock as the existing test, with both providers connected.
  let accounts!: ReturnType<typeof useAccounts>;
  function Harness() {
    accounts = useAccounts();
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Harness />));
    expect(accounts.connected).toEqual({ anilist: true, mal: true });
    await act(async () => {
      window.dispatchEvent(new Event(ANILIST_AUTH_INVALID_EVENT));
    });
    expect(accounts.connected).toEqual({ anilist: false, mal: true });
    expect(accounts.accountError).toContain("Reconnect AniList");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:ci -- src/hooks/useAccounts.notifications.test.tsx src/components/VideoPlayer.test.tsx`
Expected: FAIL because `sendListUpdate` and `remove` still fetch `/api/list/*` for AniList.

- [ ] **Step 3: Implement AniList write routing**

In `useAccounts.ts`:
- Import `updateAniListEntry`, `removeAniListEntry` from `../utils/sync/anilistList`, and `clearAniListToken`, `ANILIST_AUTH_INVALID_EVENT` from `../utils/anilistAuth`.
- In `sendListUpdate`, keep all validation and normalization. For `provider === "anilist"`, call `updateAniListEntry({ id, status, progress, automatic, manualProgress: edit?.manualProgress, score: edit?.score })` and use its raw result as `data.entry`; for `mal`, keep the existing `/api/list/mal` fetch unchanged.
- In `remove`, for `provider === "anilist"`, call `removeAniListEntry(id)`; for `mal`, keep the existing `/api/list/mal` POST unchanged.
- In `disconnect`, after a successful logout for `anilist`, call `clearAniListToken()`; do not change server logout behavior.
- Add a `useEffect` listener for `ANILIST_AUTH_INVALID_EVENT` that sets `connected.anilist` to `false` and sets `accountError` to `AniList authorization expired. Reconnect AniList to continue.`; remove the listener on cleanup.

No separate startup token fetch is needed: the first AniList request awaits `getAniListToken()` before GraphQL work starts.

- [ ] **Step 4: Run tests**

Run: `npm run test:ci -- src/hooks/useAccounts.notifications.test.tsx src/components/VideoPlayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAccounts.ts src/hooks/useAccounts.notifications.test.tsx src/components/VideoPlayer.test.tsx
git commit -m "feat: send AniList list writes from browser"
```

---

### Task 6: Route entry-editor AniList reads

**Files:**
- Modify: `src/components/ListEntryEditor.tsx:129-209`
- Test: `src/components/ListEntryEditor.test.tsx`

**Interfaces:**
- Consumes: `readAniListEntry(animeId: number, signal?: AbortSignal)` from Task 3.
- Produces: unchanged dialog UI and `{ provider, entry }` result shape used by the existing normalization code.

- [ ] **Step 1: Update failing tests**

In `src/components/ListEntryEditor.test.tsx`:

```ts
jest.mock("../utils/sync/anilistList", () => ({ readAniListEntry: jest.fn() }));
import { readAniListEntry } from "../utils/sync/anilistList";
```

Set `readAniListEntry` to resolve `{ status: "watching", progress: 3, score: 8.5 }` in the first test and `{ status: "watching", progress: 3, score: 8 }` in the rating-clear tests. Adjust the MAL fetch mock so only `/api/list/mal?...` returns entries; the AniList path must come from the mocked client. Keep all UI assertions unchanged.

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:ci -- src/components/ListEntryEditor.test.tsx`
Expected: FAIL because the editor still fetches `/api/list/anilist?animeId=`.

- [ ] **Step 3: Implement routing**

In the editor effect, for `provider === "anilist"` replace the fetch with `const entry = await readAniListEntry(id, controller.signal)`. For `mal`, keep the existing fetch and error handling unchanged. Keep the shared validation (`progress` integer and numeric `score`), `accounts.record` behavior, and retry state unchanged.

- [ ] **Step 4: Run test**

Run: `npm run test:ci -- src/components/ListEntryEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListEntryEditor.tsx src/components/ListEntryEditor.test.tsx
git commit -m "feat: read AniList editor entries from browser"
```

---

### Task 7: Route authenticated activity and legacy AniList client

**Files:**
- Modify: `src/utils/followingStories.ts:103-128`
- Modify: `src/utils/friendsActivity.ts:90-127`
- Modify: `src/utils/sync/aniListClient.ts`
- Test: `src/utils/followingStories.test.ts`
- Test: `src/utils/friendsActivity.test.ts`
- Create: `src/utils/sync/aniListClient.test.ts`

**Interfaces:**
- Consumes: `anilistRequest`, `AniListAuthError`, `getAniListToken`, `clearAniListToken` from Task 2.
- Produces: unchanged `fetchFollowingStories(identity, signal, force?)`, `fetchFriendsActivity(mediaId, identity, page, signal)`, and `aniListClient.updateAnimeProgress(...)` signatures.

- [ ] **Step 1: Update failing tests**

In `src/utils/followingStories.test.ts`, mock `./anilistAuth`:

```ts
jest.mock("./anilistAuth", () => ({
  anilistRequest: jest.fn(),
  AniListAuthError: class AniListAuthError extends Error {},
}));
import { anilistRequest } from "./anilistAuth";
```

Replace response envelopes with raw GraphQL data (`{ Viewer, Page }`) and replace URL assertions with:

```ts
expect(anilistRequest).toHaveBeenCalledWith(
  expect.stringContaining("isFollowing:true"),
  expect.anything(),
  signal,
);
```

Make the mock reject with `new Error("unavailable")` for the wrong-identity case.

In `src/utils/friendsActivity.test.ts`, apply the same mock pattern, return raw GraphQL data, assert `anilistRequest` is called with the `FriendsActivity` query and `{ mediaId: 888, page: 1 }`, and preserve the wrong-identity rejection.

Create `src/utils/sync/aniListClient.test.ts`:

```ts
jest.mock("../anilistAuth", () => ({
  anilistRequest: jest.fn(),
  getAniListToken: jest.fn().mockResolvedValue({ accessToken: "token-from-session" }),
  clearAniListToken: jest.fn(),
}));

test("legacy client sends progress through direct AniList request", async () => {
  // mock anilistRequest resolving SaveMediaListEntry
  const result = await aniListClient.updateAnimeProgress(10, 12, 12);
  expect(result.success).toBe(true);
  expect(anilistRequest).toHaveBeenCalledWith(
    expect.stringContaining("SaveMediaListEntry"),
    { mediaId: 10, progress: 12, status: "COMPLETED" },
    undefined,
  );
});

test("legacy logout clears the browser AniList token", () => {
  aniListClient.logout();
  expect(clearAniListToken).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:ci -- src/utils/followingStories.test.ts src/utils/friendsActivity.test.ts src/utils/sync/aniListClient.test.ts`
Expected: FAIL because production code still fetches `/api/oauth/anilist/graphql`.

- [ ] **Step 3: Implement direct activity requests**

For `followingStories.ts` and `friendsActivity.ts`:
- Replace the `fetch("/api/oauth/anilist/graphql", ...)` calls with `anilistRequest<T>(query, variables, signal)`.
- Keep `Viewer.id` identity verification and existing user-facing error text. If `anilistRequest` throws `AniListAuthError`, rethrow with the module's existing reconnect message (`Reconnect AniList to view following activity.` or `Reconnect AniList to see following activity.`).
- Keep caches, batching, TTLs, normalization, and abort behavior unchanged.

For `aniListClient.ts`:
- Import `anilistRequest`, `getAniListToken`, `clearAniListToken`.
- Keep the constructor's existing removal of the old `anilist_access_token` key; do not clear the new token at construction time.
- Change `authenticate()` to await `getAniListToken()` and return `true`/`false`, replacing the `/api/oauth/anilist/session` probe.
- Change `updateAnimeProgress()` to call `anilistRequest` with the existing mutation, variables, and `CURRENT`/`COMPLETED` status logic. Keep the existing `SyncStatus` result shape and catch behavior.
- Change `logout()` to call `clearAniListToken()` before the existing server logout fetch.

- [ ] **Step 4: Run tests**

Run: `npm run test:ci -- src/utils/followingStories.test.ts src/utils/friendsActivity.test.ts src/utils/sync/aniListClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/followingStories.ts src/utils/friendsActivity.ts src/utils/sync/aniListClient.ts src/utils/followingStories.test.ts src/utils/friendsActivity.test.ts src/utils/sync/aniListClient.test.ts
git commit -m "feat: use direct AniList activity sync"
```

---

### Task 8: Full verification, deploy, and live gate

**Files:**
- No new source files expected. If a live failure requires a fix, create a separate commit rather than folding it into earlier task commits.

**Interfaces:**
- Consumes: all task interfaces above.
- Produces: verified live AniList and MAL behavior, or a documented rollback/revert.

- [ ] **Step 1: Run full local checks**

Run:

```bash
npm run test:server
npm run test:ci
npm run typecheck
npm run build
```

Expected: all pass. Confirm `git status --short` still shows only the original uncommitted playback edits and untracked deployment directory/files; do not add them.

- [ ] **Step 2: Deploy server first**

Push only the Task 1 commit first, using its recorded hash:

```bash
git push origin <task-1-commit>:main
```

Expected: server/OAuth deployment receives the token endpoint while the frontend still uses the old list routes. Wait for the deployment to become live, then push the remaining commits with `git push origin main`.

- [ ] **Step 3: Verify token endpoint in the real browser without displaying the token**

In the existing connected browser session, evaluate only the status:

```js
async () => {
  const r = await fetch('/api/oauth/anilist/token', { credentials: 'same-origin' });
  return { ok: r.ok, status: r.status };
}
```

Expected: `{ ok: true, status: 200 }`. Do not print or copy the response body.

- [ ] **Step 4: Deploy frontend and verify My List**

Wait for Pages production to show the new bundle. Open `/my-list` and verify:
- two concurrent AniList reads return real `entries` with no `Provider request failed (502)`;
- Network shows AniList GraphQL calls to `https://graphql.anilist.co` and no `/api/list/anilist` calls;
- MAL entries still load through `/api/list/mal`;
- **Refresh lists** imports AniList status/progress and does not show the 502 error.

- [ ] **Step 5: Verify detail and activity paths**

In the browser verify:
- an anime detail page shows AniList status/progress instead of only "Connected";
- the entry editor refreshes both AniList and MAL entries;
- an AniList update succeeds and appears after refresh;
- an AniList removal succeeds;
- MAL import/update still works;
- following/friends activity loads or reports the existing reconnect/unavailable message without proxy 502s.

- [ ] **Step 6: Rollback gate**

If any live AniList read/update path still fails with the original 502 behavior, revert the frontend commits, push the revert, and report the exact failing browser flow. The server token endpoint is additive and may remain unless the user asks otherwise.

---

## Follow-up (approved after live gate): AniList rate-limit gap

Live verification confirmed the original 502 is gone, but exposed a separate pre-existing gap: AniList allows 30 requests/min/IP, and `readAniListList` used two GraphQL requests per page (`Viewer` + list), so a large list aborts around page 15 with `AniList rate limit reached. Please try again later.` The existing 65s auto-retry and the My List hint check the literal `"429"`, which that message does not contain, so the retry never fires. The controller approved a focused fix; execute it as Task 9 with a fresh TDD implementer and a separate fresh reviewer before redeploying.

Amendments to earlier steps (these supersede the earlier wording only where they conflict):

- Task 2 Step 4 (plan line 312): rehydration still performs exactly one authenticated `fetchAnilist` call, but it now requests `query{Viewer{id name}}` instead of `query{Viewer{id}}`. The verified `id` and `name` are stored in the token record so list reads do not need their own viewer request. Identity matching and all auth/abort behavior are unchanged.
- Task 3 Step 1 / `readAniListList`: the list query string (`LIST_QUERY`) stays byte-for-byte identical for server parity; the separate per-page `VIEWER_QUERY` call is removed. `readAniListList` derives `identity` and `name` from the rehydrated token and issues exactly one `anilistRequest` per page with `{ user: Number(identity), page }`.
- Task 8 gate: the rate-limit alert on a large AniList list is now a defect to fix, not an accepted limitation. Re-run the full local checks and the entire real-browser gate after the Task 9 deployment; the original 502 rollback gate remains unchanged.

The existing `useLibrary` checkpoint resume (`complete === false` + valid `nextPage` + no pending confirmed changes + fresh `updatedAt`) is retained unchanged; with the 65s retry now firing, it resumes the import instead of restarting it.
