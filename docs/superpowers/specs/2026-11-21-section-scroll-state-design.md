# Design: Remember Discover and My List position and options

Date: 2026-11-21
Status: awaiting approval

## Intent

When you leave Discover or My List and come back, the page should be exactly where you left it: same scroll position, same selected options, and — for Discover — no refetch/reload of its results. My List should also remember its filter options across a full browser refresh.

## Goals

- Returning to Discover restores scroll and keeps its loaded results, page number and filters; no refetch on return.
- Returning to My List restores scroll, status/provider/search filters and sort.
- Discover and My List options survive a full browser refresh (Discover filters already do; My List filters do not yet).
- Normal first visits still start at the top and fetch normally.

## Non-goals

- Details/player pages stay as they are (unmounted, start at top, no hidden video).
- Home, calendar and other sections keep their current behavior (reset to top).
- No new state library, no server changes, no deployment.

## Approaches considered

| Approach | Tradeoff | Verdict |
| --- | --- | --- |
| Keep-alive + per-view scroll memory | Both pages stay in memory after first visit; no refetch; scroll restored after render, when content is already present. | **Chosen.** Partner picked it. |
| Persist state and restore on remount | Survives refresh, but Discover still refetches and scroll restore can land short while content loads. | Rejected. |
| Lift all state into App | Clean ownership but large refactor of both components. | Rejected. |

## Current behavior this changes

- Sections are conditionally rendered and unmounted on switch (`src/App.tsx` view block).
- Scroll is force-reset in three places: `src/App.tsx` `[view]` effect, the nav `onView` handler, and `usePageRoute`'s `navigate()`/`popstate`.
- Discover (`src/components/DiscoveryPage.tsx`) already persists filters to `apex_discovery_v2`, but loses `items`, `page`, `nextPage` and scroll on unmount and refetches on mount.
- My List (`src/components/MyList.tsx`) persists only `sort` to `apex_my_list_sort_v1`; `status`, `provider`, `search` and `visibleCount` reset on unmount.

## Design

### 1. Lazy keep-alive for Discover and My List (in `src/App.tsx`)

- Track which of these two sections have been visited in App state.
- Render each one from its first visit onward, wrapped in a container that is `display: none` whenever it is not the active view. Use a dedicated CSS class (e.g. `apex-section-hidden`) so `display: none` wins over component styles.
- Other views (details, home, calendar, not-found) keep their current conditional rendering and unmounting.
- Keep `DiscoveryPage`'s existing `key={route.studioId || "all-studios"}` so studio deep links still remount with studio filters.

### 2. Single owner for scroll behavior (shared helper + App effect)

- Add a tiny session-only scroll memory (a module-level map keyed by `discover` / `my-list`) with `rememberScroll(view, y)` and `takeScroll(view)`. Module scope is used so `usePageRoute` and `App` can share it without prop drilling; it holds numbers only and is cleared when a key is consumed. It is not written to localStorage.
- In `usePageRoute`, before `setRoute` in both `navigate()` and the `popstate` handler, call `rememberScroll()` with the outgoing view and `window.scrollY` when that view is Discover or My List. Remove the `window.scrollTo({ top: 0 })` calls from both.
- Remove the `window.scrollTo({ top: 0 })` calls from App's nav `onView` handler and its `[view]` effect.
- App's effect (now the only place that moves scroll) runs on view change:
  - Discover / My List: `window.scrollTo({ top: saved ?? 0, behavior: "instant" })` using the stored value; consume it.
  - Any other view: scroll to top as today.
- Set `history.scrollRestoration = "manual"` once at startup so the browser doesn't fight the restore on back/forward.
- Studio deep links: when `route.studioId` changes, discard any stored Discover scroll so a studio page starts at the top; the existing `key` remount handles the data.

### 3. My List options persistence (in `src/components/MyList.tsx`)

- Add one localStorage key, `apex_my_list_filters_v1`, holding `{ status, provider, search }`. Read it in the lazy initializers of those three states (same defensive try/catch pattern already used for `apex_my_list_sort_v1`).
- Write all four values (`status`, `provider`, `search`, `sort`) to that key whenever any of them changes. Keep the existing `apex_my_list_sort_v1` key so existing users' sort choice still loads; migrate it into the new object on first read.
- Leave `visibleCount` in memory only — keep-alive already preserves it, and a persisted row count would go stale if the library changes.

### 4. Discover

- No changes to `src/components/DiscoveryPage.tsx` required: its filters already persist, and keep-alive preserves results, pagination and scroll.

## Tests

- `src/App.routing.test.tsx`: extend the navigation mock with Discover and My List buttons; assert that leaving Discover and returning preserves component instance state and restores the recorded scroll; assert first visit starts at top.
- `src/hooks/usePageRoute.test.tsx`: assert outgoing scroll is remembered before `navigate()`/`popstate` and that the hook no longer force-resets scroll.
- `src/components/MyList.test.tsx`: assert `status`, `provider`, `search` and `sort` are restored from storage on remount, and that legacy `apex_my_list_sort_v1` still migrates.
- Full gates: `npm run test:ci`, `npm run test:server`, `npm run typecheck`, `npm run build`.

## Risks / limitations

- Hidden pages remain mounted, so their timers/observers still exist; `display: none` prevents their intersection observers from firing and keeps them out of the accessibility tree.
- If a section is opened in a brand-new tab or after a full refresh, there is no in-memory scroll memory — it starts at the top (options are still restored). This matches the chosen in-app scope.
- Restoring scroll uses `"instant"` to override the app's global `scroll-behavior: smooth`; if a browser ignores it, restoration may animate briefly.
- Module-level scroll memory is shared across the app; it holds only numeric positions keyed by view, never user data or tokens.
