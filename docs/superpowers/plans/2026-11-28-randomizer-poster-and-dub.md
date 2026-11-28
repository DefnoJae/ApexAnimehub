# Randomizer Poster, Dub Badge, and Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the random picker poster larger and poster-colored-glowing, remove the `Tonight, watch` label, and add a separated `Dub` pill beside the rating without touching the spin animation.

**Architecture:** Three small changes in one React component and its stylesheet: remove the heading, append an asynchronously resolved dub pill to the existing metadata string, and wrap the poster in a frame with a blurred duplicate of the same image behind it. No new dependencies, no server changes, no API changes.

**Tech Stack:** React 18, TypeScript, CSS, Jest with `react-dom/client` and `act`.

**Spec:** `docs/superpowers/specs/2026-11-28-randomizer-poster-and-dub-design.md`

## Global Constraints

- Do not change `SPIN_DURATION_MS`, `SPIN_INTERVAL_MS`, `random-picker-spinning`, `@keyframes random-picker-flicker`, or the selection/timer logic.
- Desktop poster height: `min(42vh, 440px)`; small-screen poster height: `min(46vh, 380px)`; aspect ratio stays `2 / 3`.
- The dub pill text is exactly `Dub`, preceded by the separator ` · `.
- Dub source is `getDubIndex()` from `src/utils/animeMetadata.ts`; failures are ignored and leave the subtitle unchanged.
- Glow source is the selected `coverImage.extraLarge` URL, reused as a CSS `backgroundImage`; no canvas, no new fetch, no new dependency.
- Run `npm run typecheck`, `npm run test:ci`, and `npm run build` before push/deploy.

## Review Focus

- Short viewport / narrow phone: the larger poster must not hide Play / Details / Spin again — verify in a real browser after deploy; modal already has `overflow-y: auto`.
- Dub index fetch fails or is uncached: subtitle must stay clean — `does not show a Dub pill when the MAL id has no dub` in Task 2.
- Partial dub, not just full dub: must still show the pill — `shows the Dub pill for a partial dub` in Task 2.
- No MAL id on the selected anime: no pill and no placeholder — `does not show a Dub pill without a MAL id` in Task 2.
- Spin behavior and reduced motion: all existing spin/settle tests stay green and no spin code changes.

---

### Task 1: Remove the `Tonight, watch` label

**Files:**
- Modify: `src/components/RandomAnimePicker.tsx:204-214`
- Modify: `src/components/dashboard.css:2265-2281`
- Test: `src/components/RandomAnimePicker.test.tsx:217-223`

**Interfaces:**
- Consumes: existing `.random-picker-header` and close button.
- Produces: header with only the close button; no `h1.random-picker-tag`.

- [ ] **Step 1: Replace the existing heading test with a failing absence test**

```tsx
test("does not render the Tonight, watch label", () => {
  jest.useFakeTimers();
  renderPicker();
  expect(host.querySelector("h1.random-picker-tag")).toBeNull();
  expect(host.textContent).not.toContain("Tonight, watch");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ci -- --testPathPattern=RandomAnimePicker.test.tsx -t "does not render the Tonight, watch label"`
Expected: FAIL because the `<h1>` is still present.

- [ ] **Step 3: Remove the heading and its CSS**

Delete `<h1 className="random-picker-tag">Tonight, watch</h1>` from the header and delete the `.random-picker-tag` rule from `dashboard.css`. Keep `.random-picker-header` and the close button exactly as they are.

- [ ] **Step 4: Run the picker tests to verify they pass**

Run: `npm run test:ci -- --testPathPattern=RandomAnimePicker.test.tsx`
Expected: PASS, including the new absence test and the unchanged focus-trap test.

- [ ] **Step 5: Commit**

```bash
git add src/components/RandomAnimePicker.tsx src/components/dashboard.css src/components/RandomAnimePicker.test.tsx
git commit -m "refactor: remove random picker heading"
```

---

### Task 2: Add the separated dub pill

**Files:**
- Modify: `src/components/RandomAnimePicker.tsx:36-45, 179-187, 226-229`
- Modify: `src/components/dashboard.css:2354-2359`
- Test: `src/components/RandomAnimePicker.test.tsx`

**Interfaces:**
- Consumes: `getDubIndex()` returning `{ dubbed: number[]; partial: number[] }`, and `selected?.idMal`.
- Produces: `.random-picker-dub` span appended to `.random-picker-subtitle` when dub is known; subtitle text ends with ` · Dub`.

- [ ] **Step 1: Add the failing dub tests**

Add the mock import at the top of `src/components/RandomAnimePicker.test.tsx`:

```tsx
import { getDubIndex } from "../utils/animeMetadata";
jest.mock("../utils/animeMetadata", () => ({ getDubIndex: jest.fn() }));
```

Add `(getDubIndex as jest.Mock).mockResolvedValue({ dubbed: [], partial: [] });` to `beforeEach`.

Add these tests:

```tsx
test("shows a Dub pill after the rating when the MAL id is dubbed", async () => {
  jest.useFakeTimers();
  (getDubIndex as jest.Mock).mockResolvedValue({ dubbed: [42], partial: [] });
  const item: LibraryAnime = {
    id: 9,
    idMal: 42,
    title: { english: "Example" },
    coverImage: { extraLarge: "https://example.com/example.jpg" },
    format: "TV",
    startYear: 2019,
    averageScore: 78,
  };
  renderPicker({ anime: [item] });
  await act(async () => {
    jest.advanceTimersByTime(SPIN_DURATION_MS + 200);
    await Promise.resolve();
  });
  expect(host.querySelector<HTMLElement>(".random-picker-subtitle")?.textContent).toBe(
    "TV · 2019 · ★ 7.8 · Dub",
  );
  expect(host.querySelector(".random-picker-dub")).not.toBeNull();
});

test("shows the Dub pill for a partial dub", async () => {
  jest.useFakeTimers();
  (getDubIndex as jest.Mock).mockResolvedValue({ dubbed: [], partial: [44] });
  const item: LibraryAnime = {
    id: 12,
    idMal: 44,
    title: { english: "Partial" },
    coverImage: { extraLarge: "https://example.com/partial.jpg" },
    averageScore: 70,
  };
  renderPicker({ anime: [item] });
  await act(async () => {
    jest.advanceTimersByTime(SPIN_DURATION_MS + 200);
    await Promise.resolve();
  });
  expect(host.querySelector<HTMLElement>(".random-picker-subtitle")?.textContent).toBe(
    "★ 7.0 · Dub",
  );
});

test("does not show a Dub pill when the MAL id has no dub", async () => {
  jest.useFakeTimers();
  const item: LibraryAnime = {
    id: 13,
    idMal: 45,
    title: { english: "Sub only" },
    coverImage: { extraLarge: "https://example.com/sub.jpg" },
    format: "TV",
    startYear: 2019,
    averageScore: 78,
  };
  renderPicker({ anime: [item] });
  await act(async () => {
    jest.advanceTimersByTime(SPIN_DURATION_MS + 200);
    await Promise.resolve();
  });
  expect(host.querySelector<HTMLElement>(".random-picker-subtitle")?.textContent).toBe(
    "TV · 2019 · ★ 7.8",
  );
  expect(host.querySelector(".random-picker-dub")).toBeNull();
});

test("does not show a Dub pill without a MAL id", async () => {
  jest.useFakeTimers();
  const item: LibraryAnime = {
    id: 14,
    title: { english: "No MAL" },
    coverImage: { extraLarge: "https://example.com/nomal.jpg" },
    averageScore: 80,
  };
  renderPicker({ anime: [item] });
  await act(async () => {
    jest.advanceTimersByTime(SPIN_DURATION_MS + 200);
    await Promise.resolve();
  });
  expect(host.querySelector(".random-picker-dub")).toBeNull();
  expect(getDubIndex).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:ci -- --testPathPattern=RandomAnimePicker.test.tsx -t "Dub pill"`
Expected: FAIL — subtitle has no `Dub` and `.random-picker-dub` does not exist.

- [ ] **Step 3: Implement the dub lookup and pill**

In `src/components/RandomAnimePicker.tsx`:

- Import `getDubIndex` from `../utils/animeMetadata`.
- Add `const [dub, setDub] = useState(false);`.
- Add an effect keyed on `[open, selected?.idMal]` that resets `dub` to `false`, returns early when `open` is false or `selected?.idMal` is missing, guards updates with an `active` flag, calls `getDubIndex()`, sets `dub` when `index.dubbed.includes(idMal) || index.partial.includes(idMal)`, and swallows errors.
- Render the existing `subtitle` string, then when `dub` is true append `<span className="random-picker-dot"> · </span>` and `<span className="random-picker-dub" title="English dub available · MyDubList">Dub</span>` inside the same `.random-picker-subtitle` paragraph.

In `src/components/dashboard.css`, add `.random-picker-subtitle { white-space: normal; }` and `.random-picker-dub { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: #b887ff26; color: #dfcaff; font-size: 12px; font-weight: 700; white-space: nowrap; vertical-align: middle; }` near the existing subtitle rule. Do not change the dot separators already inside `subtitle`.

- [ ] **Step 4: Run the picker tests to verify they pass**

Run: `npm run test:ci -- --testPathPattern=RandomAnimePicker.test.tsx`
Expected: PASS, including the new dub tests and all unchanged spin tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/RandomAnimePicker.tsx src/components/dashboard.css src/components/RandomAnimePicker.test.tsx
git commit -m "feat: show dub badge in random picker metadata"
```

---

### Task 3: Enlarge the poster and add the poster-colored glow

**Files:**
- Modify: `src/components/RandomAnimePicker.tsx:215-225`
- Modify: `src/components/dashboard.css:2312-2328, 2450-2452`
- Test: `src/components/RandomAnimePicker.test.tsx`

**Interfaces:**
- Consumes: `poster` (selected or spinning `coverImage.extraLarge`).
- Produces: `.random-picker-poster-frame` wrapping an aria-hidden `.random-picker-poster-glow` and the existing `.random-picker-poster`.

- [ ] **Step 1: Add the failing glow test**

```tsx
test("uses the picked poster as the blurred glow source", async () => {
  jest.useFakeTimers();
  const item: LibraryAnime = {
    id: 15,
    title: { english: "Glow" },
    coverImage: { extraLarge: "https://example.com/glow.jpg" },
  };
  renderPicker({ anime: [item] });
  await act(async () => {
    jest.advanceTimersByTime(SPIN_DURATION_MS + 200);
    await Promise.resolve();
  });
  const glow = host.querySelector<HTMLElement>(".random-picker-poster-glow")!;
  expect(glow.style.backgroundImage).toBe('url("https://example.com/glow.jpg")');
  expect(glow.getAttribute("aria-hidden")).toBe("true");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ci -- --testPathPattern=RandomAnimePicker.test.tsx -t "blurred glow source"`
Expected: FAIL because `.random-picker-poster-glow` does not exist.

- [ ] **Step 3: Wrap the poster and size it up**

In `src/components/RandomAnimePicker.tsx`, replace the bare `.random-picker-poster` div with:

```tsx
<div className="random-picker-poster-frame">
  <div
    className="random-picker-poster-glow"
    aria-hidden="true"
    style={{ backgroundImage: poster ? `url("${poster}")` : undefined }}
  />
  <div className="random-picker-poster">
    {poster ? (
      <img
        className={`random-picker-image${spinning ? " random-picker-spinning" : ""}`}
        src={poster}
        alt={spinning ? "" : selected ? getDisplayTitle(selected) : ""}
        loading="lazy"
        decoding="async"
      />
    ) : null}
  </div>
</div>
```

Do not change the `img` class names, `alt`, `loading`, `decoding`, or the spin class expression.

In `src/components/dashboard.css`:

- Replace the `.random-picker-poster` block with: `.random-picker-poster-frame { position: relative; margin-top: 18px; flex-shrink: 0; }`, `.random-picker-poster-glow { position: absolute; inset: -14px; z-index: 0; border-radius: 34px; background-size: cover; background-position: center; filter: blur(24px) saturate(170%); opacity: 0.62; transform: scale(1.04); pointer-events: none; }`, and `.random-picker-poster { position: relative; z-index: 1; height: min(42vh, 440px); aspect-ratio: 2 / 3; border-radius: 20px; overflow: hidden; background: #16121c; box-shadow: 0 18px 40px #0009; flex-shrink: 0; }`.
- Change the mobile `.random-picker-poster` height to `min(46vh, 380px)`.
- Leave `.random-picker-image`, `.random-picker-spinning`, and `@keyframes random-picker-flicker` byte-for-byte unchanged.

- [ ] **Step 4: Run the picker tests to verify they pass**

Run: `npm run test:ci -- --testPathPattern=RandomAnimePicker.test.tsx`
Expected: PASS, including the glow test and every spin test.

- [ ] **Step 5: Commit**

```bash
git add src/components/RandomAnimePicker.tsx src/components/dashboard.css src/components/RandomAnimePicker.test.tsx
git commit -m "feat: enlarge random picker poster with poster-colored glow"
```
