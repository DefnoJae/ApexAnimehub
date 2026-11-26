# Ani.pm Episode Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Episodes button beside Ani.pm's sync button that opens Apex Player's exact episode carousel and switches the embedded player to the chosen episode.

**Architecture:** Reuse the existing `PlayerEpisodeCarousel` and `apexPlayer.css` inside `AniPmPlayer` rather than reimplementing the overlay. The component fetches the same episode metadata Apex Player uses, renders the carousel over the Ani.pm stage, flushes progress, and calls `onEpisodeChange` so the existing route-driven `loadEpisode` effect switches episodes without remounting the SDK.

**Tech Stack:** React 18, TypeScript, lucide-react, Jest via react-scripts, existing Ani.pm SDK wrapper.

**Spec:** `docs/superpowers/specs/2026-11-25-anipm-episode-overlay-design.md`

## Global Constraints

- Reuse `PlayerEpisodeCarousel` and `apexPlayer.css`; do not create a second visual implementation.
- Do not change the resume prompt, header controls, fullscreen behavior, SDK cleanup, or route-based episode changes.
- Do not add dependencies and do not put tokens, secrets, or credentials in source, tests, logs, or commits.
- Keep `usePlayerKeyboard`'s `.apex-player-episodes` exclusion effective; overlay keys must not seek or trigger player shortcuts.
- Run `npm run test:ci`, `npm run test:server`, `npm run typecheck`, and `npm run build` before reporting completion.
- Do not push or deploy unless explicitly requested.

## Review Focus

- **Metadata unavailable:** numbered cards must still render from `episodeCount` — Task 1 pins this with `fetchEpisodeMetadata` resolving `{}` and `episodeCount: 3`.
- **Resume prompt still pending:** opening the overlay before a start choice must not construct the SDK — Task 1 pins this with `window.AniPM.Player` not called while `startChoice === null`.
- **Keyboard focus inside the overlay:** arrows and `X` must belong to the carousel, not global player shortcuts — Task 1 pins this by focusing the carousel, dispatching `ArrowRight` / `X`, and asserting no `seekBy` call and no unintended episode change.
- **Progress at the moment of selection:** the current `{ episode, position, duration }` must be saved before the route changes — Task 2 pins this with `onProgress` and `apex_episode_progress_v1` assertions after clicking an episode.
- **SDK identity across episode changes:** switching through the overlay must not destroy/recreate the player — Task 2 pins this with `window.AniPM.Player` called once, `destroy` not called, and `loadEpisode` called after the route change.

---

### Task 1: Open the Apex Player carousel from the Ani.pm header

**Files:**
- Modify: `src/components/AniPmPlayer.tsx`
- Modify: `src/components/AniPmPlayer.test.tsx`
- Commit docs already created: `docs/superpowers/specs/2026-11-25-anipm-episode-overlay-design.md`, `docs/superpowers/plans/2026-11-25-anipm-episode-overlay.md`

**Interfaces:**
- Consumes: `fetchEpisodeMetadata(id, props.episodeCount) => Promise<Record<string, EpisodeMetadata>>`; `PlayerEpisodeCarousel({ episode, numbers, episodes, watchedThrough, onSelect, onClose })`; `PlayerProps.watchedThrough`, `PlayerProps.episodeCount`, `PlayerProps.onEpisodeChange`.
- Produces: `episodesOpen: boolean`, `episodes: Record<string, EpisodeMetadata>`, `episodeNumbers: number[]`, `closeEpisodes(): void`, and a header button with `aria-label="Episodes"` immediately before `SignSync`.

- [ ] **Step 1: Write the failing tests**

Add a hoisted metadata mock to `src/components/AniPmPlayer.test.tsx` that keeps real helpers available:

```ts
import { fetchEpisodeMetadata } from "../utils/episodeMetadata";

jest.mock("../utils/episodeMetadata", () => ({
  ...jest.requireActual("../utils/episodeMetadata"),
  fetchEpisodeMetadata: jest.fn(),
}));
```

Define `const fetchMetadata = fetchEpisodeMetadata as jest.MockedFunction<typeof fetchEpisodeMetadata>;`, use `beforeEach` to set `fetchMetadata.mockResolvedValue({})`, and define a local `openEpisodes` helper in each test from the mounted `node`:

```ts
const openEpisodes = async () => {
  const button = Array.from(node.querySelectorAll("button")).find(
    (button) => button.getAttribute("aria-label") === "Episodes",
  )!;
  await act(async () => button.click());
};
```

Use the existing SDK mock pattern from the file, adding `seekBy: jest.fn()` to the mocked player. Then add these tests.

```ts
test("Ani.pm shows the Apex Player carousel from a button left of SignSync", async () => {
  fetchMetadata.mockResolvedValue({
    2: { title: "Episode 2" },
    3: { title: "The Rookie", image: "/ep3.jpg" },
  });
  // Props: title "Example", episode 2, episodeCount 3, watchedThrough 2,
  // stream url aniPmUrl(1, 2, "dub"), accounts { autoSync: true }, and the
  // usual no-op callbacks plus an onEpisodeChange spy.
  // Assertions:
  const buttons = Array.from(node.querySelectorAll("button"));
  const episodesButton = buttons.find(
    (button) => button.getAttribute("aria-label") === "Episodes",
  )!;
  const syncButton = buttons.find(
    (button) => button.getAttribute("aria-label") === "SignSync subtitle tools",
  )!;
  expect(buttons.indexOf(episodesButton)).toBe(buttons.indexOf(syncButton) - 1);

  await act(async () => episodesButton.click());
  const panel = node.querySelector(
    'section[aria-label="Episodes"]',
  ) as HTMLElement;
  expect(panel).not.toBeNull();
  expect(document.activeElement).toBe(panel);
  expect(fetchMetadata).toHaveBeenCalledWith(1, 3);
  expect(
    node.querySelector('[aria-label="Episode 3 · The Rookie"]'),
  ).not.toBeNull();
  expect(
    node.querySelector('[aria-label="Episode 2, watched"]'),
  ).not.toBeNull();
  expect(node.querySelectorAll(".apex-carousel-card")).toHaveLength(3);
});
```

```ts
test("Ani.pm overlay closes on X/Escape, ignores player shortcuts, and preserves the resume prompt", async () => {
  fetchMetadata.mockResolvedValue({});
  // Props: title "Resume anime", episode 2, episodeCount 3, watchedThrough 1,
  // stream url aniPmUrl(9, 2, "sub"), resume { position: 50, duration: 100 },
  // accounts { autoSync: true }, onEpisodeChange spy `changed`, and the usual
  // no-op callbacks. No start choice is made.
  expect(window.AniPM.Player).not.toHaveBeenCalled();
  await act(async () => openEpisodes());

  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    ),
  );
  expect(player.seekBy).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();

  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "x", bubbles: true }),
    ),
  );
  expect(node.querySelector('section[aria-label="Episodes"]')).toBeNull();
  expect(document.activeElement).toBe(dialog);

  await act(async () => openEpisodes());
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(node.querySelector('section[aria-label="Episodes"]')).toBeNull();
  expect(document.activeElement).toBe(dialog);
  expect(node.textContent).toContain("Continue from 0:50");
  expect(window.AniPM.Player).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/AniPmPlayer.test.tsx`
Expected: FAIL because the Episodes button, carousel, metadata fetch, and close handling do not exist.

- [ ] **Step 3: Implement the overlay shell**

In `src/components/AniPmPlayer.tsx`:

- Add imports for `ListVideo`, `fetchEpisodeMetadata`, `type EpisodeMetadata`, `PlayerEpisodeCarousel`, and `./apexPlayer.css`.
- Add `const [episodesOpen, setEpisodesOpen] = useState(false);` and `const [episodes, setEpisodes] = useState<Record<string, EpisodeMetadata>>({});`.
- Add an effect on `[id, props.episodeCount]` calling `fetchEpisodeMetadata(id, props.episodeCount)` with an `active` guard and `setEpisodes(items)`.
- Build `episodeNumbers` with the Apex Player formula from the spec, capped at `2000`.
- Add `closeEpisodes()` that sets `episodesOpen` false and calls `dialog.current?.focus({ preventScroll: true })`.
- Add `chooseEpisode(number: number)` that calls `closeEpisodes()` then `callbacks.current.onEpisodeChange?.(number, playingEntry.lang || lang)`. Progress flushing is added in Task 2.
- Insert the header button before `<SignSync>`:

```tsx
<button
  type="button"
  className="player-header-icon"
  onClick={() => setEpisodesOpen(true)}
  aria-label="Episodes"
  title="Episodes"
>
  <ListVideo size={18} aria-hidden="true" />
</button>
```

- Add `onKeyDown` to the player dialog: when `episodesOpen && (event.key === "Escape" || (event.key.toLowerCase() === "x" && !event.ctrlKey && !event.metaKey && !event.altKey))`, call `preventDefault()`, `stopPropagation()`, and `closeEpisodes()`.
- Render, inside the dialog after the resume prompt and before the stage:

```tsx
{episodesOpen && (
  <PlayerEpisodeCarousel
    episode={playingEntry.episode}
    numbers={episodeNumbers}
    episodes={episodes}
    watchedThrough={props.watchedThrough}
    onSelect={chooseEpisode}
    onClose={closeEpisodes}
  />
)}
```

Keep `startChoice` and all SDK initialization logic untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/AniPmPlayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-25-anipm-episode-overlay-design.md docs/superpowers/plans/2026-11-25-anipm-episode-overlay.md src/components/AniPmPlayer.tsx src/components/AniPmPlayer.test.tsx
git commit -m "feat: add Apex Player episode overlay to Ani.pm"
```

---

### Task 2: Flush progress and load the chosen episode in place

**Files:**
- Modify: `src/components/AniPmPlayer.tsx`
- Modify: `src/components/AniPmPlayer.test.tsx`

**Interfaces:**
- Consumes: Task 1's `chooseEpisode(number)`, `latest: React.MutableRefObject<{ episode: number; position: number; duration: number } | undefined>`, `id`, `saveEpisodeProgress`, and `callbacks.current.onProgress`.
- Produces: memoized `flushProgress(): void` (`useCallback` keyed on `id`) at component scope, used by both the SDK effect and `chooseEpisode`.

- [ ] **Step 1: Write the failing test**

Use the same `openEpisodes` helper from Task 1.

```ts
test("Ani.pm episode selection flushes progress and loads the chosen episode without remounting", async () => {
  fetchMetadata.mockResolvedValue({ 3: { title: "The Rookie" } });
  // Props: dub URL for anime 1 episode 2, episodeCount 4, watchedThrough 2,
  // onProgress and onEpisodeChange spies, and the usual no-op callbacks.
  await act(async () => events.ready(player.state));
  await act(async () => events.timeupdate({ currentTime: 1, duration: 100 }));
  await act(async () => events.timeupdate({ currentTime: 42, duration: 100 }));
  // The 5-second save throttle means the second timeupdate did not persist.
  expect(
    JSON.parse(localStorage.getItem("apex_episode_progress_v1")!)["1:2"].position,
  ).toBe(1);
  await act(async () => openEpisodes());
  await act(async () =>
    node
      .querySelector('[aria-label="Episode 3 · The Rookie"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );

  expect(onProgress).toHaveBeenLastCalledWith(42, 100, 2);
  expect(
    JSON.parse(localStorage.getItem("apex_episode_progress_v1")!)["1:2"].position,
  ).toBe(42);
  expect(changed).toHaveBeenCalledWith(3, "dub");
  expect(node.querySelector('section[aria-label="Episodes"]')).toBeNull();

  await act(async () =>
    root.render(
      <AniPmPlayer
        {...props}
        episode={3}
        stream={{ ...props.stream, url: aniPmUrl(1, 3, "dub") }}
      />,
    ),
  );
  expect(player.loadEpisode).toHaveBeenCalledWith(3, {
    lang: "dub",
    start: 0,
  });
  expect(window.AniPM.Player).toHaveBeenCalledTimes(1);
  expect(player.destroy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/AniPmPlayer.test.tsx`
Expected: FAIL because `chooseEpisode` does not flush progress yet (and therefore may not call `loadEpisode` with the expected saved-position behavior).

- [ ] **Step 3: Implement the progress flush**

In `src/components/AniPmPlayer.tsx`:

- Add `useCallback` to the React import. Move the SDK effect's `flush` body into a memoized component-scope `flushProgress = useCallback((): void => { ... }, [id])` that reads `latest.current`, calls `saveEpisodeProgress(id, value.episode, value.position, value.duration)`, and calls `callbacks.current.onProgress?.(value.position, value.duration, value.episode)`.
- Make the SDK effect use `flushProgress` wherever it currently uses its local `flush`, including `pause`, `ended`, `pagehide`, `fullscreenchange`, and cleanup, and add `flushProgress` to that effect's dependency array alongside `[id, startChoice, reload]`.
- At the start of `chooseEpisode(number)`, call `flushProgress()` before `closeEpisodes()` and `callbacks.current.onEpisodeChange?.(number, playingEntry.lang || lang)`.
- Do not call `player.loadEpisode` directly from `chooseEpisode`; the existing `[episode, lang]` effect remains the only episode-loading path.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npx react-scripts test --watchAll=false --runInBand src/components/AniPmPlayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run all gates**

Run each command separately and confirm all pass:
- `npm run test:ci`
- `npm run test:server`
- `npm run typecheck`
- `npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/AniPmPlayer.tsx src/components/AniPmPlayer.test.tsx
git commit -m "feat: switch Ani.pm episodes from the overlay"
```
