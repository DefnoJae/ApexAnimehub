import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { RandomAnimePicker, SPIN_DURATION_MS } from "./RandomAnimePicker";
import type { LibraryAnime } from "../hooks/useLibrary";
import { getDubIndex } from "../utils/animeMetadata";

jest.mock("../utils/animeMetadata", () => ({ getDubIndex: jest.fn() }));

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
  (getDubIndex as jest.Mock).mockReset();
  (getDubIndex as jest.Mock).mockResolvedValue({ dubbed: [], partial: [] });
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

test("settles on time even when the parent re-renders mid-spin", () => {
  jest.useFakeTimers();
  renderPicker();
  advance(300);
  act(() =>
    root.render(
      <RandomAnimePicker
        anime={base.slice()}
        open={true}
        onPlay={jest.fn()}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    ),
  );
  advance(SPIN_DURATION_MS + 200 - 300);
  expect(host.querySelector<HTMLElement>(".random-picker-title")?.textContent).not.toBe("—");
});

test("keeps the close button as the only header control", () => {
  jest.useFakeTimers();
  renderPicker();
  const header = host.querySelector<HTMLElement>(".random-picker-header")!;
  expect(header.children.length).toBe(1);
  expect(header.querySelector('[aria-label="Close picker"]')).not.toBeNull();
  expect(header.querySelector("h1")).toBeNull();
});

test("Escape dismisses the picker", () => {
  jest.useFakeTimers();
  const { onClose } = renderPicker();
  act(() => {
    host
      .querySelector<HTMLElement>(".random-picker-modal")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Tab focus stays inside the dialog", () => {
  jest.useFakeTimers();
  renderPicker();
  advance(SPIN_DURATION_MS + 200);
  const buttons = host.querySelectorAll<HTMLElement>(".random-picker-modal button");
  const last = buttons[buttons.length - 1];
  act(() => last.focus());
  act(() => {
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  });
  expect(document.activeElement).toBe(buttons[0]);
});

test("focus moves into the dialog on open and returns to the opener on close", () => {
  jest.useFakeTimers();
  const opener = document.createElement("button");
  document.body.append(opener);
  act(() => opener.focus());
  const { onClose } = renderPicker();
  const closeButton = host.querySelector<HTMLElement>('[aria-label="Close picker"]')!;
  expect(document.activeElement).toBe(closeButton);
  act(() => closeButton.click());
  act(() =>
    root.render(
      <RandomAnimePicker
        anime={base}
        open={false}
        onPlay={jest.fn()}
        onSelect={jest.fn()}
        onClose={onClose}
      />,
    ),
  );
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

test("backdrop click dismisses the picker and cancels the spin", () => {
  jest.useFakeTimers();
  const { onClose } = renderPicker();
  advance(300);
  act(() => host.querySelector<HTMLElement>(".random-picker-backdrop")!.click());
  advance(SPIN_DURATION_MS + 200);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(host.querySelector<HTMLElement>(".random-picker-title")?.textContent).toBe("—");
});
