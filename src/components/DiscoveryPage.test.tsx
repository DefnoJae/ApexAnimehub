import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { DiscoveryPage } from "./DiscoveryPage";
import { fetchDiscovery, fetchDiscoveryOptions } from "../utils/discovery";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("../utils/discovery", () => ({
  ...jest.requireActual("../utils/discovery"),
  fetchDiscovery: jest.fn(),
  fetchDiscoveryOptions: jest.fn(),
}));
jest.mock("./AnimeBadges", () => ({ AnimeBadges: () => null }));
const accounts = {
  libraryEntries: [],
  connected: { anilist: true, mal: false },
  getListStatus: () => undefined,
  sync: jest.fn(),
} as unknown as ReturnType<typeof useAccounts>;
let node: HTMLDivElement, root: Root, intersect: IntersectionObserverCallback;
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  (fetchDiscoveryOptions as jest.Mock).mockResolvedValue({
    genres: ["Action"],
    tags: ["Super Power"],
  });
  (fetchDiscovery as jest.Mock).mockImplementation(async (_f, page) => ({
    items: Array.from({ length: 50 }, (_, i) => ({
      id: (page - 1) * 50 + i + 1,
      title: { english: "Anime " + ((page - 1) * 50 + i + 1) },
      malScore: null,
    })),
    nextPage: page === 1 ? 2 : null,
    source: "anilist",
  }));
  global.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      intersect = callback;
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  jest.useRealTimers();
  jest.clearAllMocks();
});
test("loads 50 posters, keeps quick list controls, and appends on near-bottom intersection", async () => {
  await act(async () =>
    root.render(<DiscoveryPage accounts={accounts} onSelect={jest.fn()} />),
  );
  expect(node.querySelectorAll(".poster-card")).toHaveLength(50);
  expect(
    node.querySelectorAll('[aria-label^="Change list status"]'),
  ).toHaveLength(50);
  expect(node.textContent).not.toContain("Load more results");
  await act(async () =>
    intersect(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  expect(node.querySelectorAll(".poster-card")).toHaveLength(100);
  expect(fetchDiscovery).toHaveBeenLastCalledWith(
    expect.anything(),
    2,
    expect.anything(),
    "anilist",
  );
});
test("filter changes debounce automatically and send real selected tags without submit", async () => {
  await act(async () =>
    root.render(<DiscoveryPage accounts={accounts} onSelect={jest.fn()} />),
  );
  const input = node.querySelector(
    '[aria-label="Search discovery"]',
  ) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, "My");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    setter.call(input, "My Hero");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(fetchDiscovery).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(fetchDiscovery).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: "My Hero" }),
    1,
    expect.anything(),
    "anilist",
  );
  const tag = Array.from(node.querySelectorAll("label"))
    .find((el) => el.textContent === "Super Power")!
    .querySelector("input")!;
  act(() => tag.click());
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(fetchDiscovery).toHaveBeenLastCalledWith(
    expect.objectContaining({ tags: ["Super Power"] }),
    1,
    expect.anything(),
    "anilist",
  );
  expect(node.querySelector('button[type="submit"]')).toBeNull();
});
