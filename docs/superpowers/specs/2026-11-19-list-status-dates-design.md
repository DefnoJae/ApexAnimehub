# List status dates — design

Date: 2026-11-19

## Intent

When this site records a first Watching or Completed status for an anime on a connected
provider, also record the calendar day that happened. Do not backfill, rewrite, or clear
dates on entries that predate the feature.

## Goals

- Transition into `watching` (manual "Save to connected lists" or automatic at 80% playback)
  writes a start date if the provider entry has no start date.
- Transition into `completed` (manual selection or automatic on reaching the episode total)
  writes a finish date if the provider entry has no finish date.
- Same rule on AniList and MyAnimeList, using one local date computed in the browser.
- A provider read decides the transition; no write when the entry is already in the target
  status.

## Non-goals

- Backfilling or bulk-editing existing entries.
- Writing dates for planning, paused, or dropped statuses.
- Clearing dates on rewatch or status reversal; overwriting any date already set.
- Date-editing UI, Kitsu, or changes to progress/score behavior.

## Anti-goals

- Writing "today" to every entry on every save — that erases real provider history.
- Using the server's timezone, which may not match the user's calendar day.

## Constraints

- AniList is written from the browser in `src/utils/sync/anilistList.ts` via
  `SaveMediaListEntry`. It needs `startedAt` / `completedAt` as `FuzzyDateInput`, and the
  existing-entry query must return `status` and both dates.
- MAL is written server-side in `server/list.cjs` via `PATCH /anime/:id/my_list_status`,
  using `start_date` / `finish_date` in `YYYY-MM-DD`.
- The generic `/api/list/:provider` route also serves AniList, so `updateList` needs parity
  in both provider branches.
- `sendListUpdate` in `src/hooks/useAccounts.ts` is the single fan-out point for manual and
  automatic updates.
- The date string must be validated server-side before reaching a provider.
- The uncommitted AniList login-fix files are unrelated and out of scope.

## Approaches

- **A (chosen):** read the provider entry first, decide the transition, write the date in
  the same mutation/PATCH. Adds one read on manual status-only saves; reliable.
- **B (not chosen):** use the `useLibrary` local status snapshot to detect transitions. No
  extra request, but stale or missing imported entries can produce wrong dates.
- **Ruled out:** always include today's date on every watching/completed write — overwrites
  existing dates and backfills old entries.

## Decisions

- The browser computes one `YYYY-MM-DD` local date per sync and passes it to both providers.
- Transition rule. Let `existing` be the provider entry, or null. Normalize AniList
  `REPEATING` and MAL `rewatching` to watching.
  - Write start date iff target is `watching`, `existing.status` is not already watching,
    and `existing.startedAt` / `existing.start_date` is empty.
  - Write finish date iff target is `completed`, `existing.status` is not already completed,
    and `existing.completedAt` / `existing.finish_date` is empty.
- Progress-only updates (status unchanged) never write dates.
- Removal never changes dates.

## Left to builder

- Tests covering transition, preservation, and no-write cases on both providers.
- Full verification gates, then commit, push to `main`, and Pages deploy after approval.
