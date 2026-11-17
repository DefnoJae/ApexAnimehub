# AniList browser-token list access — design

## Intent and why

AniList reads and writes currently go through the Cloudflare Worker and then
either the Vercel relay or a direct request to `graphql.anilist.co`. Live
instrumentation during a failing import showed:

```text
relayStatus=502   (Vercel relay → AniList)
directStatus=403  (Cloudflare Worker → AniList)
retryStatus=502
finalStatus=502
```

AniList itself is healthy: an unauthenticated GraphQL request from a normal
environment returns `200`. The problem is the origin of the server-side
requests. AniList rejects the Worker's egress IP with `403`, and the Vercel
relay is getting `502` from AniList. The backend therefore returns
`Provider request failed (502)`, and AniList lists cannot be imported or
updated. MyAnimeList keeps working because it is called from the browser using
a client-side token.

The goal is to make AniList reads and updates as reliable as MAL reads and
updates, for both new and already-connected users.

## Goals

- AniList list import, single-entry read, status/progress/score update, and
  entry removal work from the user's browser.
- Authenticated AniList features currently using `/api/oauth/anilist/graphql`
  (following activity, friends activity, detail-page status) also work from the
  browser.
- MAL behavior is unchanged.
- The OAuth authorization-code exchange and the "connected" session stay on
  the server. The client secret is never exposed to the browser.
- Existing saved-library identity checks, optimistic update flow, and
  notification behavior are preserved.

## Non-goals

- No hosting changes, new paid infrastructure, or OAuth app re-registration.
- No redesign of the MAL token flow.
- No immediate removal of the existing server-side AniList proxy; it stays for
  backward compatibility and can be cleaned up in a later change.
- No attempt to "fix" the Worker/Vercel egress problem. It is an upstream IP
  restriction, not a code bug.

## Anti-goals

- Do not reintroduce module-level cross-request Promise/Response sharing in the
  Worker.
- Do not present stale cached list data as the primary fix. Caching may remain
  as an offline convenience, but the live import must actually succeed.
- Do not hide authentication errors behind generic success messages.

## Constraints and verified facts

- AniList GraphQL supports CORS from `https://apexanime.pages.dev`, including
  the `Authorization` header. Verified live from the app origin: unauthenticated
  query returned `200`, authenticated query with an invalid token returned a
  GraphQL `400 Invalid token` rather than a CORS failure.
- The browser has no AniList token today. The server session holds it.
- `src/utils/anilist.ts` already accepts an optional token and posts directly
  to `https://graphql.anilist.co`, so the transport layer mostly exists.
- Users already have connected sessions and saved libraries; recovery must not
  force everyone to reconnect.
- Storing a provider token in browser storage is already the established
  pattern for MAL in this app.

## Approaches considered

### 1. Browser-side AniList token and direct GraphQL (chosen)

Add a small read-only server endpoint that returns the connected account's
AniList access token to the same-origin browser. Store it locally, then call
AniList GraphQL directly from the browser for all authenticated operations.

- Pros: bypasses both blocked server IPs; uses proven client transport; works
  for existing sessions; no new infrastructure; reads and updates both fixed.
- Cons: the AniList token is readable by page JavaScript and lives in
  `localStorage`; this is the same tradeoff already accepted for MAL.

### 2. Move the relay to a different host or IP

Keep the token server-side and point the relay at infrastructure whose IP is
not blocked by AniList.

- Pros: token remains out of browser JavaScript.
- Cons: new infrastructure/cost, no guarantee AniList will not block the new
  IP, and the current Vercel relay already receives `502`. This is a slower,
  less certain path.

### 3. Cache last-known-good list and queue writes

Show cached entries when the backend fails and retry writes later.

- Pros: improves the appearance of My List during outages.
- Cons: does not reliably update lists now, which is the actual requirement.
  Useful only as a secondary resilience measure.

## Decisions

- **Token delivery:** add `GET /api/oauth/anilist/token` to the OAuth service.
  It returns `{ accessToken, expiresAt }` only for the current same-origin
  session. No token is placed in a redirect URL or fragment.
- **Token storage:** `localStorage` key `apex_anilist_token_v1`, holding the
  access token and expiry. A helper rehydrates it from the server endpoint when
  the server reports AniList connected but no local token exists.
- **Transport:** all browser AniList calls use
  `fetchAnilist(query, variables, signal, token)`.
- **Server proxy:** the existing `/api/oauth/anilist/graphql` and
  `/api/list/anilist` routes remain for compatibility, but the frontend stops
  calling them for AniList.
- **Failure handling:** a `401` or GraphQL "Invalid token" clears the local
  token and surfaces a reconnect prompt. `429` keeps the existing rate-limit
  message and backoff behavior.
- **MAL:** all MAL read/update/remove paths remain unchanged.

## Implementation outline

- `server/oauth.cjs`: add the additive token endpoint; no change to the OAuth
  exchange, callback, logout, or connected-state logic.
- `src/utils/anilistAuth.ts` (new): token read/write/clear, expiry check,
  rehydration from the server endpoint, and a thin authenticated request
  wrapper.
- `src/utils/sync/anilistList.ts` (new): AniList-only port of the relevant
  `server/list.cjs` behavior, preserving the exact GraphQL queries,
  `MediaListStatus` ↔ app status mapping, `score(format:POINT_100) / 10`,
  `updatedAt * 1000`, and `Viewer`-derived identity.
- `src/hooks/useLibrary.ts`: route AniList page reads through the browser
  client; leave MAL reads unchanged.
- `src/hooks/useAccounts.ts`: route AniList update and remove through the
  browser client while keeping the existing `AccountResult` shape.
- `src/components/ListEntryEditor.tsx`: route AniList single-entry reads
  through the browser client.
- `src/utils/followingStories.ts`, `src/utils/friendsActivity.ts`,
  `src/utils/sync/aniListClient.ts`: replace the proxied GraphQL calls with
  authenticated direct calls.
- App startup: after `/api/accounts` reports AniList connected, ensure a local
  token exists before any AniList work starts.
- Tests: server test for the token endpoint; unit tests for token storage and
  normalization parity; update hook/util tests that currently mock server
  AniList routes.

## Rollout and verification

1. Deploy the additive server change first.
2. Deploy the frontend change.
3. Verify live in the browser:
   - two concurrent AniList list reads return real `entries`, with no `502`;
   - **Refresh lists** imports AniList status/progress;
   - an anime detail page shows AniList status/progress instead of "Connected";
   - an AniList update and removal succeed;
   - MAL import/update still works;
   - following/friends activity and entry editor still work.
4. Rollback: revert the frontend commit. The server token endpoint is additive
   and harmless if unused.

## Risks

- The AniList token becomes accessible to page JavaScript. This matches the
  existing MAL design and is the accepted tradeoff for bypassing the blocked
  server IPs.
- Users can hit AniList's public rate limit from their own IP. The existing
  `429` handling remains.
- Existing tests that mock `/api/list/anilist` and
  `/api/oauth/anilist/graphql` need to be updated to mock the browser client.

## Left to the builder

Exact helper filenames, the startup hook location, and test file organization
are builder choices as long as the behavior and boundaries above are followed.
