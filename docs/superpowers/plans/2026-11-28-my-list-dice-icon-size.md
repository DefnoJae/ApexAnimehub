# My List Dice Icon Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the My List random-picker dice icon from 20px to 26px without changing the button footprint or picker behavior.

**Architecture:** One React prop change in the existing My List button, guarded by one focused component test that reads the rendered SVG attributes. No CSS, API, or modal changes.

**Tech Stack:** React 18, TypeScript, lucide-react, Jest/React Testing Library-style component tests.

**Spec:** `docs/superpowers/specs/2026-11-28-my-list-dice-icon-size-design.md`

## Global Constraints

- `.library-filters > button` retains its current 44px minimum width/height.
- The My List trigger's `Dice5` SVG must render with width and height `26`.
- Do not change the picker modal icon, picker behavior, account/API routing, or add API requests.
- Run `npm run typecheck`, `npm run test:ci`, and `npm run build` before push/deploy.

## Review Focus

- Icon is larger but still fits the existing button: test asserts width/height `26`.
- Picker behavior unchanged: existing dice button tests remain green.
- Purple/glass button styling unchanged: no CSS file is modified.
- No new API requests: only a `size` prop changes.
- Account routing untouched: no files under `server/` or `cloudflare-pages/` are modified.

---

### Task 1: Enlarge the My List dice trigger

**Files:**
- Modify: `src/components/MyList.tsx:308`
- Test: `src/components/MyList.test.tsx`

**Interfaces:**
- Consumes: existing `Dice5` import from `lucide-react` and existing `MyList` props.
- Produces: `Dice5 size={26}` on the button labeled `Pick a random anime from this list`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/MyList.test.tsx`:

```tsx
test("renders the My List dice icon at 26px", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = {
    ...makeAccounts(),
    libraryEntries: [
      {
        provider: "anilist",
        anime: { id: 1, title: { english: "Pick me" } },
        status: "planning",
        score: 8,
        progress: 0,
        updatedAt: 1,
      },
    ],
  } as unknown as ReturnType<typeof useAccounts>;
  try {
    act(() =>
      root.render(
        <MyList
          accounts={accounts}
          onSelect={jest.fn()}
          onConnect={jest.fn()}
        />,
      ),
    );
    const svg = host.querySelector(
      '[aria-label="Pick a random anime from this list"] svg',
    );
    expect(svg?.getAttribute("width")).toBe("26");
    expect(svg?.getAttribute("height")).toBe("26");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ci -- --testPathPattern=MyList.test.tsx -t "renders the My List dice icon at 26px"`
Expected: FAIL with expected width/height `26`, received `20`.

- [ ] **Step 3: Implement the icon size**

In `src/components/MyList.tsx`, change the trigger icon from:

```tsx
<Dice5 size={20} aria-hidden="true" />
```

to:

```tsx
<Dice5 size={26} aria-hidden="true" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ci -- --testPathPattern=MyList.test.tsx`
Expected: PASS, including the new 26px assertion and all existing My List tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/MyList.tsx src/components/MyList.test.tsx
git commit -m "fix: enlarge My List dice icon"
```
