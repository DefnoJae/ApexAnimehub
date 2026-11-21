# Section Scroll & State Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Returning to Discover or My List restores scroll, loaded results, pagination and options; Discover never refetches on return.

**Architecture:** Render Discover and My List from first visit onward and hide them with `display:none` when inactive (keep-alive), so their component instances, fetched data and in-memory state survive navigation. Move all scroll authority to one App effect that restores a per-section scroll position; `usePageRoute` remembers the outgoing position before every route change and no longer force-resets scroll. Persist My List filter options to localStorage (migrating the legacy sort key), matching Discover's existing filter persistence.

**Tech Stack:** React 18 + TypeScript, `react-dom/client` + `react-dom/test-utils` `act` tests (Jest), plain CSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-21-section-scroll-state-design.md`

## Global Constraints

- Only Discover and My List are keep-alive. Details/player, Home, calendar and not-found keep their current conditional rendering and unmounting; a hidden video must never keep playing.
- First visit to any section starts at scroll top. Other sections always still scroll to top on entry.
- Studio deep links (`/discover?studio=...`) always start Discover at top, regardless of remembered scroll.
- Scroll memory is session-only module state (numbers keyed by `discover` / `my-list`). It is never written to storage. My List options persist in localStorage under `apex_my_list_filters_v1`; Discover keeps `apex_discovery_v2`.
- Avoid unnecessary AniList/MAL calls: Discover must not refetch when hidden/shown; My List keeps consuming the cached `accounts` from `useAccounts`.
- Do not modify, stage, or overwrite these unrelated uncommitted files: `docs/superpowers/plans/2026-11-17-anilist-browser-token.md`, `server/oauth.cjs`, `server/oauth.test.cjs`, `server/vercel.test.cjs`, `src/components/AccountSettings.tsx`, `src/hooks/useAccounts.notifications.test.tsx`, `src/hooks/useAccounts.ts`, `src/utils/anilistAuth.test.ts`, `src/utils/anilistAuth.ts`.
- No tokens/secrets in chat, source, commits or output. Do not deploy.
- Gate commands (all must pass): `npm run test:ci`, `npm run test:server`, `npm run typecheck`, `npm run build`.

## Review Focus

These are the behaviors the spec implies but no single task's happy-path test fully exercises. Each is pinned to a test in the owning task below.

- Browser Back/forward (`popstate`) into Discover/My List must restore scroll, not jump to top — Task 1 test + Task 2 test.
- Leaving a studio-filtered Discover and returning to plain Discover must not replay stale studio scroll — Task 2 test (studio deep link starts at top).
- Full browser refresh on My List (keep-alive gone) must still restore `status`, `provider`, `search`, `sort` — Task 3 remount test.
- Hidden keep-alive sections must be inert: wrapped in `.apex-section-hidden` so they are out of the accessibility tree and their observers cannot fire — Task 2 assertion on the hidden wrapper class.
- localStorage `getItem`/`setItem` throwing must not crash My List, and Discover must not refetch on hide/show — Task 3 storage-throw test; Task 2 instance-preservation test.

---

### Task 1: Session scroll memory and route hook integration

**Files:**
- Create: `src/utils/sectionScroll.ts`
- Modify: `src/hooks/usePageRoute.ts:93-144`
- Test: `src/hooks/usePageRoute.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (exported from `src/utils/sectionScroll.ts`):
  - `type ScrollSection = "discover" | "my-list"`
  - `scrollSection(view: string): ScrollSection | null`
  - `rememberScroll(view: string, y: number): void` — stores only for the two sections; no-op otherwise.
  - `takeScroll(view: ScrollSection): number` — returns the stored value or `0`, then deletes the entry.
  - `clearScroll(view: ScrollSection): void` — deletes the entry.
  - Backing store is a module-level `Map<ScrollSection, number>`; no storage access.

- [ ] **Step 1: Write the failing test**

Add to `src/hooks/usePageRoute.test.tsx` (import `takeScroll` from `./utils/sectionScroll`). Spy on `window.scrollTo` with `jest.spyOn(window, "scrollTo").mockImplementation(() => {})`; set `window.scrollY` via `Object.defineProperty(window, "scrollY", { value: y, configurable: true })`. Restore both in `finally`. Assert:

```tsx
act(() => router.navigate("/discover"));
setY(640);
act(() => router.navigate("/anime/1"));          // leaves Discover
expect(takeScroll("discover")).toBe(640);
expect(scrollTo).not.toHaveBeenCalled();

act(() => {                                       // browser Back to Discover
  window.history.replaceState({ apexIndex: 0 }, "", "/discover");
  window.dispatchEvent(new PopStateEvent("popstate"));
});
expect(node.textContent).toContain("discover");
expect(scrollTo).not.toHaveBeenCalled();
setY(120);
act(() => router.navigate("/my-list"));          // leaves Discover again
expect(takeScroll("discover")).toBe(120);
expect(takeScroll("my-list")).toBe(0);            // nothing stored yet
```

Use the same `Harness` pattern already in that file (`let router!: ReturnType<typeof usePageRoute>`; `usePageRoute()` inside a component). Reset history to `/` in `finally`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/usePageRoute.test.tsx --runInBand`
Expected: FAIL — module `./utils/sectionScroll` cannot be found (and `scrollTo` still called by the current hook).

- [ ] **Step 3: Implement the utility and wire the hook**

`src/utils/sectionScroll.ts`: exact signatures from Interfaces; `scrollSection` is the single type guard used by both `rememberScroll` and App later.

`src/hooks/usePageRoute.ts`:
- Import `rememberScroll` and `scrollSection`.
- Add `const routeRef = useRef(route);` immediately after `closingPlayer`.
- Add a local `applyRoute = useCallback((next: PageRoute) => { rememberScroll(routeRef.current.view, window.scrollY); routeRef.current = next; setRoute(next); }, []);` — this captures the outgoing view before the ref is updated.
- In the `popstate` handler (line 103-107), keep `closingPlayer.current = false;` then replace `setRoute(readRoute())` with `applyRoute(readRoute())`; **delete** `window.scrollTo({ top: 0 })`.
- In `navigate()` (line 111-144), replace `setRoute(readRoute())` at line 142 with `applyRoute(readRoute())`; **delete** `window.scrollTo({ top: 0 })` at line 143.
- In the mount effect, before `addEventListener`, set `if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";` (guarded for jsdom/older browsers).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/usePageRoute.test.tsx --runInBand`
Expected: PASS — including the three pre-existing tests in that file (history counting, player close/back, route parsing).

- [ ] **Step 5: Commit**

```bash
git add src/utils/sectionScroll.ts src/hooks/usePageRoute.ts src/hooks/usePageRoute.test.tsx
git commit -m "feat: remember section scroll across route changes without forcing resets"
```

---

### Task 2: Keep-alive sections and single scroll owner in App

**Files:**
- Modify: `src/App.tsx:273-276` (scroll effect), `src/App.tsx:515-519` (nav handler), `src/App.tsx:731-747` (section render block)
- Modify: `src/components/dashboard.css:42-47` (new hidden-class rule near `.apex-scroll`)
- Test: `src/App.routing.test.tsx`

**Interfaces:**
- Consumes: `scrollSection`, `takeScroll`, `clearScroll` from Task 1's `src/utils/sectionScroll.ts`.
- Produces: two keep-alive wrappers in App's `.apex-scroll` container; CSS class `.apex-section-hidden`.

- [ ] **Step 1: Write the failing tests**

In `src/App.routing.test.tsx`, extend the existing `HomeDashboard` mock's `FloatingNavigation` to render three buttons calling `onView("all")`, `onView("discover")`, `onView("my-list")` (keep the existing `HomeDashboard` mock and its "Open anime" button untouched). Add mocks:

```tsx
jest.mock("./components/DiscoveryPage", () => {
  const R = require("react");
  return {
    DiscoveryPage: () => {
      const [count, setCount] = R.useState(0);
      return (
        <button data-testid="discovery" onClick={() => setCount(count + 1)}>
          discover {count}
        </button>
      );
    },
  };
});
jest.mock("./components/MyList", () => ({
  MyList: () => <div data-testid="mylist">my list</div>,
}));
```

Use `jest.spyOn(window, "scrollTo").mockImplementation(() => {})` and the `Object.defineProperty(window, "scrollY", ...)` helper from Task 1; restore in `finally`, reset history to `/`.

Test A — "Discover stays mounted, hidden while away, and its scroll is restored":

```tsx
window.history.replaceState({}, "", "/discover");
await act(async () => root.render(<App />));
const discover = () => node.querySelector('[data-testid="discovery"]') as HTMLElement;
act(() => discover().click());
expect(discover().textContent).toBe("discover 1");

setY(300);
act(() => Array.from(node.querySelectorAll("button"))
  .find((b) => b.textContent === "Home")!.click());
expect(window.location.pathname).toBe("/");
expect(discover()).not.toBeNull();
expect(discover().closest(".apex-section-hidden")).not.toBeNull();
expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

act(() => Array.from(node.querySelectorAll("button"))
  .find((b) => b.textContent === "Discover")!.click());
expect(scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: "instant" });
expect(discover().textContent).toBe("discover 1");  // same instance, no refetch/remount
```

Test B — "My List starts at top, is remembered, and a studio deep link starts Discover at top":

```tsx
window.history.replaceState({}, "", "/my-list");
await act(async () => root.render(<App />));
expect(node.querySelector('[data-testid="mylist"]')).not.toBeNull();
expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

const clickNav = (label: string) => act(() => {
  Array.from(node.querySelectorAll("button"))
    .find((b) => b.textContent === label)!.click();
});
setY(700);
clickNav("Discover");                             // remembers my-list: 700
clickNav("Home");
clickNav("My List");
expect(scrollTo).toHaveBeenLastCalledWith({ top: 700, behavior: "instant" });

setY(500);
act(() => {
  window.history.replaceState({ apexIndex: 1 }, "", "/discover?studio=14");
  window.dispatchEvent(new PopStateEvent("popstate"));
});
expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/App.routing.test.tsx --runInBand`
Expected: FAIL — Discover/My List unmount on leave (mock node disappears), and `scrollTo` is called with the old `{ top: 0 }` shape without `behavior`.

- [ ] **Step 3: Implement keep-alive rendering and the App scroll effect**

`src/App.tsx`:
- Import `clearScroll`, `scrollSection`, `takeScroll` from `./utils/sectionScroll`.
- Add two state flags near the other `useState` calls: `const [discoverVisited, setDiscoverVisited] = useState(false);` and `const [myListVisited, setMyListVisited] = useState(false);`.
- Replace the `[view]` effect at lines 273-276 with **two effects declared in this exact order** (React runs them in declaration order on the same commit, so clearing must come first):
  1. An effect on `[route.studioId, view]` that calls `clearScroll("discover")` only when `view === "discover" && route.studioId` is set.
  2. An effect on `[view, route.studioId]` that computes `const section = scrollSection(view)`, calls `window.scrollTo({ top: section ? takeScroll(section) : 0, behavior: "instant" })`, then `setNavHidden(false)`. This is now the only place App moves scroll.
- In the nav `onView` handler (515-519), keep `navigate(sectionPaths[next] || "/")` and `setNavHidden(false)`; **delete** `window.scrollTo({ top: 0 })`.
- Add an effect on `[view]` that sets `setDiscoverVisited(true)` when `view === "discover"` and `setMyListVisited(true)` when `view === "my-list"` (never resets them).
- Replace the `my-list` and `discover` render branches (731-747) with wrappers rendered when `(view === <section> || <section>Visited)`, each `<div className={"apex-keep-alive" + (view === <section> ? "" : " apex-section-hidden")}>` containing the existing component with all its current props and the existing `key={route.studioId || "all-studios"}` on `DiscoveryPage`.

`src/components/dashboard.css`, after `.apex-scroll` (line 42-44):
```css
.apex-section-hidden {
  display: none;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/App.routing.test.tsx --runInBand`
Expected: PASS — including all five pre-existing tests in that file.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/dashboard.css src/App.routing.test.tsx
git commit -m "feat: keep Discover and My List alive and restore section scroll"
```

---

### Task 3: My List filter persistence

**Files:**
- Modify: `src/components/MyList.tsx:10`, `:28-39`, `:125-178`
- Test: `src/components/MyList.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `apex_my_list_filters_v1` localStorage key holding `{ status, provider, search, sort }`; legacy `apex_my_list_sort_v1` read as a sort fallback only.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/MyList.test.tsx` (reuse the existing `accounts` fixture shape; mock `AnimeBadges`/`HomeDashboard` are already in place). Define `const FILTERS_KEY = "apex_my_list_filters_v1";`.

Test A — "restores and persists all four filters":

```tsx
localStorage.clear();
localStorage.setItem(FILTERS_KEY, JSON.stringify({
  status: "completed", provider: "mal", search: "Naruto", sort: "title",
}));
// render, then assert:
expect((host.querySelector('[aria-label="Search my list"]') as HTMLInputElement).value).toBe("Naruto");
expect((host.querySelector('[aria-label="List provider"]') as HTMLSelectElement).value).toBe("mal");
expect((host.querySelector('[aria-label="Filter list status"]') as HTMLSelectElement).value).toBe("completed");
expect((host.querySelector('[aria-label="Sort my list"]') as HTMLSelectElement).value).toBe("title");
// change status to "watching" via change event, then:
expect(JSON.parse(localStorage.getItem(FILTERS_KEY)!)).toEqual({
  status: "watching", provider: "mal", search: "Naruto", sort: "title",
});
// unmount and render a fresh root on the same host; assert the four values again
```

Test B — "migrates the legacy sort key": `localStorage.clear(); localStorage.setItem("apex_my_list_sort_v1", "highest");` render; assert sort select value `"highest"` and `JSON.parse(localStorage.getItem(FILTERS_KEY)!).sort === "highest"`.

Test C — "storage failures do not crash": spy `Storage.prototype.getItem` and `Storage.prototype.setItem` to throw a `DOMException`, render, assert the default inputs are present (`status === "all"`, `sort === "updated"`) and no error is thrown; restore spies in `finally`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/MyList.test.tsx --runInBand`
Expected: FAIL — localStorage key is ignored; selects stay at defaults; no write on filter change.

- [ ] **Step 3: Implement filter persistence in MyList**

`src/components/MyList.tsx`:
- Add module-level `type MyListFilters = { status: ListStatus | "all"; provider: string; search: string; sort: string }`, `const FILTERS_KEY = "apex_my_list_filters_v1"`, `const LEGACY_SORT_KEY = "apex_my_list_sort_v1"`.
- Add `readFilters(): MyListFilters` with fallback `{ status: "all", provider: "all", search: "", sort: "updated" }`. Parse the new key inside `try/catch`; validate `status` ∈ `{all, watching, planning, completed, paused, dropped}`, `provider` ∈ `{all, anilist, mal}`, `sort` ∈ `{updated, highest, lowest, progress, title}` (invalid values fall back individually). If the new key is absent, fall back to `LEGACY_SORT_KEY` for `sort` only.
- Add `saveFilters(next: MyListFilters): void` that writes `JSON.stringify(next)` to `FILTERS_KEY` inside `try/catch`.
- Replace lines 28-33 with `const [initial] = useState(readFilters);` followed by four `useState` initializers seeded from `initial.status`, `initial.provider`, `initial.search`, `initial.sort`.
- Add `useEffect(() => saveFilters({ status, provider, search, sort }), [status, provider, search, sort])`.
- Remove the inline `localStorage.setItem("apex_my_list_sort_v1", ...)` block from the sort handler (lines 168-171); leave `setSort` and `setVisibleCount(batchSize)` intact. Leave every other handler and `visibleCount` in memory only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/MyList.test.tsx --runInBand`
Expected: PASS — including the three pre-existing tests in that file.

- [ ] **Step 5: Run all four gates, then commit**

```bash
npm run test:ci
npm run test:server
npm run typecheck
npm run build
```

All must pass. Then:

```bash
git add src/components/MyList.tsx src/components/MyList.test.tsx
git commit -m "feat: persist My List filters across refresh and migrate legacy sort"
```
