# Seanime AniList rate-limit countdown — research note

Date: 2026-11-25
Question: How does Seanime show a precise number of seconds left on an AniList
rate limit (5, 10, 25, 30, up to ~60), when ApexAnimehub can only say "about a
minute"?

Research was read-only; no application code was changed.

## Sources (primary)

- Seanime Go client: <https://github.com/5rahim/seanime/blob/main/internal/api/anilist/client.go>
- Seanime React loader: <https://github.com/5rahim/seanime/blob/main/seanime-web/src/app/(main)/_features/rate-limit-loader.tsx>
- Seanime websocket event name: <https://github.com/5rahim/seanime/blob/main/internal/events/events.go>
- Seanime MAL wrapper (negative check): <https://github.com/5rahim/seanime/blob/main/internal/api/mal/wrapper.go>
- AniList rate-limit docs: <https://docs.anilist.co/guide/rate-limiting>

## Finding

Seanime does not estimate the wait. Its **Go backend** reads AniList's own
rate-limit headers, converts them to an integer number of seconds, and pushes
that integer to the React UI over a websocket. The UI counts down locally.

### Header parsing (`internal/api/anilist/client.go`)

- `parseResponseDate` (L392-404) reads the `Date` header, falling back to local
  `time.Now()`, establishing the response-time baseline.
- `parseRateLimitResetTime` (L406-426) prefers `Retry-After`, then falls back
  to `X-RateLimit-Reset`.
- `parseRetryAfterTime` (L428-444) treats a numeric `Retry-After` as seconds:
  `now.Truncate(time.Second).Add(time.Duration(retryAfterSeconds+1) * time.Second)`.
  HTTP-date values are accepted too. The `+1` is a deliberate safety margin.
- `getRetryWindow` (L446-458) enters the rate-limit path on HTTP 429 **or**
  `X-Ratelimit-Remaining == "0"`, only when a reset/retry header parses.
- `X-Ratelimit-Remaining` is read at L509; `X-RateLimit-Limit` is not used by
  this mechanism.

### Storing and computing the wait

- A mutex-protected package-level `sharedAniListRateBlocker` holds
  `blockedUntil time.Time` in backend memory — not localStorage, not a DB, not
  React state. `BlockUntil` (L515) only accepts later timestamps, suppressing
  duplicate announcements for the same window.
- Seconds are computed at L516-522:

  ```go
  waitSeconds := int(resetAt.Sub(responseTime).Round(time.Second) / time.Second)
  if waitSeconds < 1 { waitSeconds = 1 }
  onRateLimited(waitSeconds)
  ```

  So `Retry-After: 30` displays 31 seconds (due to the `+1`), and a zero/negative
  wait is clamped to 1. When `X-RateLimit-Reset` is used, the value is
  `resetTimestamp - DateHeader`.

### Transport and UI

- `notifyAniListRateLimit()` (L551-567) sends websocket event
  `events.AnilistRateLimit` (`"anilist-rate-limit"` in `events.go`) with the
  integer payload, plus a throttled 10-second warning toast reading
  `anilist: Rate limited, retrying in N seconds`.
- `RateLimitLoader` in `rate-limit-loader.tsx` stores `totalSeconds` and
  `secondsRemaining` from the event, decrements once per second with
  `setInterval(..., 1000)`, and renders `AniList rate limit: retrying in Ns`
  with an orange top progress bar (`secondsRemaining / totalSeconds`). It is
  mounted globally in `MainLayout`.
- AniList calls are made by the Go client, so browser CORS header exposure is
  not involved — the browser only receives the websocket integer.

### Scope

Both authenticated and public AniList queries use the same generated client
and `CustomDo` retry function, so both get this behavior. MAL does not:
`internal/api/mal/wrapper.go` only checks status codes and never reads
rate-limit headers.

### Caveat

The number is header-derived, not a guess, but the frontend does **not**
recompute from an absolute reset timestamp after receipt — it trusts the single
integer and ticks down locally. Dropped websocket events or background-tab
timer throttling can make the display drift from AniList's true reset time.

## Relevance to ApexAnimehub

Our browser-side `fetchAnilist` reads `Retry-After` only for unauthenticated
requests into a private `publicRetryAt`, never exports it, never reads
`X-RateLimit-Reset`, and the UI uses fixed text/timers ("about a minute",
65s). Matching Seanime would require capturing the reset time on the server
proxy side (where CORS cannot hide headers), sharing an absolute timestamp,
and rendering a live countdown. No such change was made as part of this
research.
