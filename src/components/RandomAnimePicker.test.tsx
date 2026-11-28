import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { RandomAnimePicker, SPIN_DURATION_MS } from "./RandomAnimePicker";
import type { LibraryAnime } from "../hooks/useLibrary";

const base: LibraryAnime[] = [
  {
    id: 1,
    title: { english: "Ascendance of a Bookworm", romaji: "Honzuki" },
    coverImage: { extraLarge: "https://example.com/bookworm.jpg" },
  },
  {
    id: 2,
    title: { english: "Spy x Family", romaji: "Spy x Family" },
    coverImage: { extraLarge: "https://example.com/spy.jpg" },
  },
  {
    id: 3,
    title: { english: "Your Name", romaji: "Kimi no Na wa" },
    coverImage: { extraLarge: "https://example.com/yourname.jpg" },
  },
];

let host: HTMLDivElement, root: ReturnType<typeof createRoot>;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  host.id = "root";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function renderPicker(
  props: Partial<React.ComponentProps<typeof RandomAnimePicker>> = {},
) {
  const onPlay = jest.fn();
  const onSelect = jest.fn();
  const onClose = jest.fn();
  act(() =>
    root.render(
      <RandomAnimePicker
        anime={base}
        open={true}
        onPlay={onPlay}
        onSelect={onSelect}
        onClose={onClose}
        {...props}
      />,
    ),
  );
  return { onPlay, onSelect, onClose };
}

function advance(ms: number) {
  act(() => jest.advanceTimersByTime(ms));
}

test("renders nothing when closed", () => {
  renderPicker({ open: false });
  expect(host.innerHTML).toBe("");
});

test("renders nothing when the list has no usable entries", () => {
  renderPicker({ anime: [] });
  expect(host.innerHTML).toBe("");
});

test("cycles posters during the spin", () => {
  jest.useFakeTimers();
  let call = 0;
  jest.spyOn(Math, "random").mockImplementation(() => [0, 1, 2][call++ % 3]);
  renderPicker();
  advance(240);
  const first = host.querySelector<HTMLElement>("img.random-picker-image")?.getAttribute("src");
  advance(240);
  const second = host.querySelector<HTMLElement>("img.random-picker-image")?.getAttribute("src");
  expect(first).not.toBe(second);
});

test("settles on a pick from the list after the spin", () => {
  jest.useFakeTimers();
  const { onPlay } = renderPicker();
  advance(SPIN_DURATION_MS + 200);
  const title = host.querySelector<HTMLElement>(".random-picker-title")?.textContent;
  expect(title).not.toBe("—");
  act(() => {
    host.querySelector<HTMLElement>(".random-picker-btn-play")!.click();
  });
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(base.map((item) => item.id)).toContain(onPlay.mock.calls[0][0].id);
});

test("shows the format, year and scaled score in the metadata row", () => {
  jest.useFakeTimers();
  const item: LibraryAnime = {
    id: 9,
    title: { english: "Example" },
    coverImage: { extraLarge: "https://example.com/example.jpg" },
    format: "TV_SHORT",
    startYear: 2019,
    averageScore: 78,
  };
  renderPicker({ anime: [item] });
  advance(SPIN_DURATION_MS + 200);
  expect(host.querySelector<HTMLElement>(".random-picker-subtitle")?.textContent).toBe(
    "TV Short · 2019 · ★ 7.8",
  );
});

test("omits unknown metadata instead of printing placeholders", () => {
  jest.useFakeTimers();
  const item: LibraryAnime = {
    id: 10,
    title: { english: "Example" },
    coverImage: { extraLarge: "https://example.com/example.jpg" },
  };
  renderPicker({ anime: [item] });
  advance(SPIN_DURATION_MS + 200);
  const subtitle = host.querySelector<HTMLElement>(".random-picker-subtitle")?.textContent || "";
  expect(subtitle).not.toMatch(/Anime|undefined|NaN/);
});

test("settles on the only entry when the list has one item", () => {
  jest.useFakeTimers();
  const item: LibraryAnime = {
    id: 11,
    title: { english: "Only Pick" },
    coverImage: { extraLarge: "https://example.com/only.jpg" },
  };
  renderPicker({ anime: [item] });
  advance(SPIN_DURATION_MS + 200);
  expect(host.querySelector<HTMLElement>(".random-picker-title")?.textContent).toBe(
    "Only Pick",
  );
});

test("closing cancels the pending spin", () => {
  jest.useFakeTimers();
  const { onClose } = renderPicker();
  advance(300);
  act(() => {
    host.querySelector<HTMLElement>('[aria-label="Close picker"]')!.click();
  });
  advance(SPIN_DURATION_MS + 200);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(host.querySelector<HTMLElement>(".random-picker-title")?.textContent).toBe("—");
});

test("reduced motion settles without waiting for the spin", () => {
  jest.useFakeTimers();
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  }
  const matchMedia = jest
    .spyOn(window, "matchMedia")
    .mockImplementation(
      () =>
        ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) as unknown as MediaQueryList,
    );
  renderPicker();
  expect(matchMedia).toHaveBeenCalled();
  expect(host.querySelector<HTMLElement>(".random-picker-title")?.textContent).not.toBe("—");
});

test("Details uses the existing selection callback", () => {
  jest.useFakeTimers();
  const { onSelect } = renderPicker();
  advance(SPIN_DURATION_MS + 200);
  act(() => {
    host.querySelector<HTMLElement>(".random-picker-btn-details")!.click();
  });
  expect(onSelect).toHaveBeenCalledTimes(1);
});

test("Spin again restarts the animation", () => {
  jest.useFakeTimers();
  renderPicker();
  advance(SPIN_DURATION_MS + 200);
  act(() => {
    host.querySelector<HTMLElement>(".random-picker-btn-again")!.click();
  });
  expect(host.querySelector<HTMLElement>(".random-picker-title")?.textContent).toBe("—");
});
