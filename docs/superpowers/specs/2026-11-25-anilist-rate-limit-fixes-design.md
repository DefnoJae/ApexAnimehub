# AniList rate-limit fixes — design

Date: 2026-11-25

## Intent

Live Edge tracing showed 35 AniList requests in 39 seconds: 16 My List library
pages and 19 Discovery pages. AniList's current advertised budget is 30
requests per minute, so two concurrent paginators exhaust it while the user is
just browsing. Search aliases add another burst. The countdown work made the
429 visible; this change stops causing it.

## Goals

- Keep total browser AniList traffic under the shared limit even when several
  features run at once.
- Remove unprompted background library imports; use saved data first and import
  only when My List actually needs it.
- Resume a failed library import from the page that failed, not page 1.
- Reduce Discovery's automatic pagination, its per-page request count, and
  repeated option fetches.
- Cap search alias expansion and reuse recent search results.
- Lengthen background polls and reuse already-known ratings.
- Preserve the existing Watch Later behavior, countdown pill, list status UX,
  MAL behavior, and visual design.

## Non-goals

- No new server proxy, paid infrastructure, or change to the OAuth flow.
- No redesign of cards, typography, colors, posters, or status dropdowns.
- No provider sync for Watch Later and no entry limit.
- No attempt to solve MAL's separate `/api/list/mal` traffic; it does not use
  AniList quota.
- No change to how the countdown is rendered or positioned.

## Anti-goals

- A "fix" that only makes 429s look nicer while still sending 35 requests in
  39 seconds.
- A per-feature throttle where Search, Discovery, and My List each believe they
  have a full budget.
- An import that restarts at page 1 after every rate-limit reset.
- Caches that hide rate-limit failures as successful empty results.

## Constraints

- AniList advertises `X-RateLimit-Limit: 30`; CORS exposes
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
  `Retry-After` is not reliably readable in the browser.
- `X-RateLimit-Reset` sometimes equals the response second; the existing
  `parseRateLimitHeaders` fallback to a synthetic 60-second cooldown remains.
- All browser AniList calls go through `fetchAnilist`, including authenticated
  list reads/writes and public Discovery/Search/rating calls.
- The existing library snapshot format
  (`apex_library_v1_<provider>_<identity>`) with `complete` and `nextPage` is
  the resume source; no new persisted schema.
- The existing global retry clock (`rateLimitClock.ts`) drives the countdown
  and must also drive request scheduling.
- Tests use Jest; frontend gates are `npm run test:ci`, `npm run typecheck`,
  and `npm run build`. Server gate remains `npm run test:server`.
- No real tokens, client secrets, or credentials in chat, source, commits, or
  output.

## Approaches

1. **Per-feature throttles.** Each caller would wait its own interval. Rejected:
   the live incident was caused by independent paginators racing; separate
   budgets still add up to the same burst.
2. **Move all AniList traffic through a server proxy that owns the budget.**
   Rejected: the app deliberately uses a browser-delivered token for direct
   GraphQL calls; this would be a larger architecture change and would not
   help other browser tabs.
3. **One shared browser budget plus demand-driven imports and caches.**
   Chosen. A single scheduler gates every `fetchAnilist` call, a 429 pauses all
   callers, and the noisiest workflows stop asking for pages unless the user
   asks or there is a verified checkpoint to finish.

## Decided design

### Shared request budget

- Add one in-memory scheduler used by `fetchAnilist` for every browser AniList
  request, authenticated or public.
- Allow **24 started requests per rolling 60 seconds** and enforce **at least
  1000 ms between starts**. The margin below 30 leaves room for other tabs.
- A 429 calls the existing `setRateLimitRetryAt` with the parsed reset time,
  or `now + 60_000` when no future reset is available. While that clock is in
  the future, `fetchAnilist` rejects immediately for every caller instead of
  queueing a burst for the reset.
- `setRateLimitRetryAt` is set only on 429, not on successful responses that
  merely carry `X-RateLimit-Reset`. A normal success must never extend a
  cooldown or gate the next request.
- `fetchAnilist` does **not** transparently replay a failed request. The failed
  caller surfaces the error; My List's retry effect resumes from the saved
  checkpoint, Search/Discovery show their existing error UI, and RatingPills
  leaves failures uncached.
- Aborted requests stop waiting for a slot without consuming one.
- The scheduler is in-memory and per browser tab, like the current countdown.

### Library import

- App mount no longer starts an import. It hydrates an AniList cached snapshot
  only when the locally stored AniList token identity matches; MAL has no safe
  local identity, so it stays empty until My List verifies it.
- Opening My List starts a **resume** import. After page 1 verifies the account,
  it uses a complete cached snapshot and stops, or jumps to a saved incomplete
  checkpoint. It never pages through a complete list just because My List
  opened.
- The **Refresh lists** button always starts a **full** import from page 1 for
  connected providers.
- Consecutive AniList library pages are separated by **4000 ms**; MAL's
  existing 2200 ms cadence is unchanged because it uses a separate quota.
- A page is considered attempted once requested; the saved `nextPage` from the
  last successful page remains the retry point. A checkpoint is eligible only
  with `complete === false`, zero pending confirmed changes, an integer
  `nextPage` in `(1, 10000]`, and `updatedAt` less than one hour old.
- Resuming still fetches page 1 first to verify identity and apply any fresh
  first-page values, then jumps to the checkpoint. If the verified snapshot is
  complete, resume stops after page 1.
- Hydration on app mount uses only an AniList cache whose identity matches
  `readAniListToken()`; MAL is loaded after My List verifies it via page 1.
- Full refresh preempts an older import through the existing generation
  counter and ignores checkpoints.
- Any user-initiated retry outside My List (for example Missing Library) also
  uses resume mode. There are no automatic import triggers outside My List.
- Cached complete AniList lists remain usable immediately, including on other
  pages, so removing the unprompted import does not blank the UI.

### Discovery

- Cache successful `fetchDiscovery` results by provider + filters + page for
  **10 minutes** (max 24 entries). Failures and aborted requests are not
  cached.
- Cache successful `fetchDiscoveryOptions` for **30 minutes**.
- Studio Discovery fetches one AniList page of 50 items instead of two pages of
  25.
- The infinite-scroll sentinel uses a **160 px** root margin and a **600 ms**
  debounce instead of 800 px with immediate advancement. An initial filter
  change loads one page unless the user scrolls.

### Search

- `searchVariants` emits at most **3** aliases, keeping the current priority
  order.
- Successful `searchAnimeTitles` results are cached by normalized query for
  **5 minutes** (max 30 entries). The cache stores the final ranked results,
  after `rankAnimeSearch`, so equivalent raw spelling cannot change ranking.
  Failures and aborted requests are not cached.

### Polls and ratings

- Latest Episodes polls every **300000 ms** instead of 60000 ms.
- Following Stories polls every **900000 ms** instead of 300000 ms.
- RatingPills keeps in-flight deduplication and adds a successful-score cache
  with a **30 minute** TTL and a 500-entry cap. Rate-limit failures are not
  cached.

## Builder latitude

- Internal queue, cache-eviction, and key-serialization mechanics are the
  implementer's choice as long as the observable behavior and exact values
  above hold.
- Existing public signatures should stay compatible unless the plan pins a
  new optional parameter (`refreshLibrary("resume" | "full")`).
- Tests must prove request counts, retry points, cache reuse, non-caching of
  failures, and the unchanged local-only MAL and Watch Later paths.
