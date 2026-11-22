# Continue Watching hardening design

## Intent

A friend’s in-progress Continue Watching entries disappeared. Investigation proved that refresh and AniList login/OAuth return do not clear `videasy_history`; those paths now have a regression test. The old entries are gone from the browser profile and cannot be recovered by the app. This change prevents two remaining in-app loss paths from causing the same problem again:

1. the hard 15-title history cap, and
2. deleting a final episode from Continue Watching when the player reports 80% watched, which is not true completion.

## Goals

- Keep more in-progress titles: raise the `videasy_history` cap from 15 to 100 titles.
- Keep the 80% `onWatched` callback for AniList progress/status syncing.
- Remove a title from Continue Watching only when a player reports a real `ended` event and the episode is the known final episode.
- Preserve manual removal via the X button.
- Keep existing behavior for non-final episodes: they remain in Continue Watching so the next episode is easy to resume.

## Non-goals

- No account-backed restore of lost Continue Watching entries.
- No import/export UI for old local data.
- No change to AniList/MAL sync status rules.
- No UI redesign or new user-facing settings.

## Anti-goals

- Do not delete history on refresh, OAuth return, or token validation failure.
- Do not treat 80% playback as “finished.”
- Do not auto-remove final episodes from embed sources that cannot report a trustworthy `ended` event.

## Constraints

- `videasy_history` remains browser-local, session-independent storage.
- Existing uncommitted rate-limit work in `RatingPills`, `AnimeBadges`, and `DiscoveryPage` must stay untouched and unstaged.
- All four gates must pass before any commit/push/deploy: `npm run test:ci`, `npm run test:server`, `npm run typecheck`, `npm run build`.
- No secrets or tokens in source, tests, chat, commits, or output.
- Do not commit, push, or deploy without explicit approval.

## Approaches considered

### A. Split watched from completed (chosen)

Raise the cap to 100. Add a separate `onCompleted` callback to `PlayerProps`; native playback and Ani.pm call it only on their real `ended` events. `App` uses that callback only to remove a known final episode from history. Embed-based players continue to sync at 80% but never auto-remove.

Tradeoff: small cross-player API/type change, but it preserves “remove when actually finished” without false positives.

### B. Never auto-remove on watched

Raise the cap to 100 and delete the final-episode removal from `markWatched`. Finished final episodes would remain until manually removed.

Tradeoff: simplest, but completed titles accumulate in Continue Watching.

### C. Move the watched threshold to 99%

Raise the cap to 100 and remove at 99% instead of 80%.

Tradeoff: smaller change, but an iframe postMessage near the end is still not proof of completion and can still remove an unfinished episode.

## Design

### History cap

In `src/App.tsx`, `updateHistory` changes `.slice(0, 15)` to `.slice(0, 100)`. Existing storage migration is unnecessary: older arrays are simply valid, shorter histories.

### Completion signal

`PlayerProps` in `src/components/VideoPlayer.tsx` gains:

```ts
onCompleted?: (episode?: number) => void;
```

`App` passes a handler that removes `selectedAnime.id` from history only when the supplied episode is the known final episode. It does not call `accounts.sync`; the existing 80% `onWatched` path remains the only automatic status/progress sync.

`markWatched` no longer calls `removeFromHistory`. It only decides whether to sync `"completed"` or `"watching"`.

### Player wiring

- `NativeVideoPlayer`: call `props.onCompleted?.(episode)` from the existing `<video onEnded>` handler. Keep auto-next behavior unchanged.
- `AniPmPlayer`: on the SDK’s `ended` event, call `callbacks.current.onCompleted?.(state.episode)` using the same validated Ani.pm state check already used for progress. Ensure a single completion per episode mount.
- `EmbedVideoPlayer` and ReAnime: do not add a completion signal. They keep the existing 80% `onWatched` sync but no longer cause final-episode removal.

### Tests

Test-first with focused red/green cycles:

1. `src/App.routing.test.tsx`: 80% watched on a final episode keeps history; real completion on a final episode removes it; real completion on a non-final episode keeps it.
2. `src/App.routing.test.tsx`: a 101st title evicts only the oldest entry under the new cap of 100.
3. Player tests: native `onEnded` and Ani.pm `ended` call `onCompleted` once; 80% still calls `onWatched`.
4. Keep the new refresh/OAuth storage regression test.

### Verification

Run all four gates after implementation and review the final diff to confirm the unrelated rate-limit files are unchanged. Ask before committing, pushing, or deploying.
