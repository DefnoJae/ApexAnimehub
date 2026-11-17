import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { DiscoveryPage } from "./DiscoveryPage";
import { fetchDiscovery, fetchDiscoveryOptions } from "../utils/discovery";
import { getCachedMalScore, getMalScore } from "../utils/animeMetadata";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("../utils/discovery", () => ({
  ...jest.requireActual("../utils/discovery"),
  fetchDiscovery: jest.fn(),
  fetchDiscoveryOptions: jest.fn(),
}));
jest.mock("./AnimeBadges", () => ({ AnimeBadges: () => null }));
let mockRatingSource = "anilist";
jest.mock("../hooks/useRatingSource", () => ({
  useRatingSource: () => [mockRatingSource, jest.fn()],
}));
jest.mock("../utils/animeMetadata", () => ({
  ...jest.requireActual("../utils/animeMetadata"),
  getCachedMalScore: jest.fn(),
  getMalScore: jest.fn(),
}));
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
  mockRatingSource = "anilist";
  (getCachedMalScore as jest.Mock).mockImplementation(() => null);
  (getMalScore as jest.Mock).mockImplementation(async () => null);
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
test("with MyAnimeList as the rating source, the minimum rating uses MAL scores", async () => {
  mockRatingSource = "mal";
  (getCachedMalScore as jest.Mock).mockImplementation((id: number) =>
    id === 1 ? 8.4 : null,
  );
  (getMalScore as jest.Mock).mockImplementation(async (id: number) =>
    ({ 2: 6.8, 3: 7.2 } as Record<number, number>)[id] ?? null,
  );
  localStorage.setItem(
    "apex_discovery_v2",
    JSON.stringify({ score: "7", sort: "start_date" }),
  );
  (fetchDiscovery as jest.Mock).mockResolvedValue({
    items: [1, 2, 3].map((id) => ({
      id,
      idMal: id,
      title: { english: "Anime " + id },
      malScore: null,
    })),
    nextPage: null,
    source: "anilist",
  });
  await act(async () =>
    root.render(<DiscoveryPage accounts={accounts} onSelect={jest.fn()} />),
  );
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await act(async () => {});
  expect(getMalScore).toHaveBeenCalledWith(2);
  expect(getMalScore).toHaveBeenCalledWith(3);
  expect(
    Array.from(node.querySelectorAll(".discovery-poster-caption strong")).map(
      (element) => element.textContent,
    ),
  ).toEqual(["Anime 1", "Anime 3"]);
});
