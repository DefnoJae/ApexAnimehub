import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { fetchAnilist } from "./utils/anilist";
import { clearScroll } from "./utils/sectionScroll";
jest.mock("./utils/anilist", () => ({ fetchAnilist: jest.fn() }));
jest.mock("./hooks/useAccounts", () => ({
  useAccounts: () => ({
    libraryEntries: [],
    sync: jest.fn(),
    notificationFeed: {},
  }),
}));
jest.mock("./components/HomeDashboard", () => ({
  FloatingNavigation: ({ onView }: any) => (
    <>
      <button onClick={() => onView("all")}>Home</button>
      <button onClick={() => onView("discover")}>Discover</button>
      <button onClick={() => onView("my-list")}>My List</button>
    </>
  ),
  HomeDashboard: ({ onSelect }: any) => (
    <button
      onClick={() =>
        onSelect({ id: 1, title: { english: "Test anime" }, episodes: 12 })
      }
    >
      Open anime
    </button>
  ),
}));
jest.mock("./components/AnimeDetails", () => ({
  nextDetailEpisode: () => 1,
  AnimeDetails: ({ anime, onEpisode, onPlay }: any) => (
    <div>
      <h1>{anime.title.english}</h1>
      <button onClick={() => onEpisode(3)}>Select 3</button>
      <button onClick={() => onPlay(3, "dub", "anipm")}>Play 3</button>
    </div>
  ),
}));
jest.mock("./components/VideoPlayer", () => ({
  VideoPlayer: ({ episode, onNext, onClose, onWatched, onCompleted }: any) => (
    <div role="dialog">
      Episode {episode}
      <button onClick={() => onWatched(episode)}>Mark watched</button>
      <button onClick={() => onCompleted?.(episode)}>Complete</button>
      <button onClick={onNext}>Next</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
jest.mock("./components/DiscoveryPage", () => {
  const R = require("react");
  return {
    DiscoveryPage: ({ onClearStudio }: any) => {
      const [count, setCount] = R.useState(0);
      return (
        <>
          <button data-testid="discovery" onClick={() => setCount(count + 1)}>
            discover {count}
          </button>
          <button onClick={onClearStudio}>Clear studio</button>
        </>
      );
    },
  };
});
jest.mock("./components/MyList", () => ({
  MyList: () => <div data-testid="mylist">my list</div>,
}));
jest.mock("./components/AccountSettings", () => ({
  AccountSettings: () => <div data-testid="account-settings">accounts</div>,
}));
beforeEach(() => {
  localStorage.clear();
  clearScroll("discover");
  clearScroll("my-list");
  (fetchAnilist as jest.Mock).mockImplementation(
    (query: string, variables: { id: number }) =>
      Promise.resolve(
        query.includes("AnimeDetails")
          ? {
              Media: {
                id: variables.id,
                title: { english: "Test anime" },
                episodes: 12,
              },
            }
          : query.includes("RecentlyAired")
            ? {
                Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] },
              }
            : {
                trending: { media: [] },
                current: { media: [] },
                previous: { media: [] },
              },
      ),
  );
});
test("a rate-limited deep link can open the requested anime and episode with fallback metadata", async () => {
  window.history.replaceState({}, "", "/anime/191656/episode/2");
  (fetchAnilist as jest.Mock).mockRejectedValueOnce(new Error("AniList rate limit reached."));
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      mappings: { anilist_id: 191656, mal_id: 61578 },
      titles: { en: "Fallback anime" },
      episodeCount: 12,
    }),
  });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    expect(node.querySelector("h1")?.textContent).toBe("Fallback anime");
    expect(node.querySelector('[role="dialog"]')?.textContent).toContain("Episode 2");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.ani.zip/mappings?anilist_id=191656",
      expect.any(Object),
    );
  } finally {
    act(() => root.unmount());
    node.remove();
    global.fetch = originalFetch;
    window.history.replaceState({}, "", "/");
  }
});
test("a direct episode URL reloads the right anime, audio and episode; Back restores details without restarting playback", async () => {
  window.history.replaceState(
    {},
    "",
    "/anime/1/episode/3?audio=dub&source=anipm",
  );
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    expect(node.querySelector('[role="dialog"]')?.textContent).toContain(
      "Episode 3",
    );
    expect(document.title).toBe("Test anime · Episode 3 | ApexAnimehub");
    act(() =>
      Array.from(node.querySelectorAll("button"))
        .find((b) => b.textContent === "Next")!
        .click(),
    );
    expect(window.location.pathname).toBe("/anime/1/episode/4");
    expect(node.querySelector('[role="dialog"]')?.textContent).toContain(
      "Episode 4",
    );
    await act(async () => {
      window.history.replaceState({ apexIndex: 0 }, "", "/anime/1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(node.querySelector('[role="dialog"]')).toBeNull();
    expect(node.querySelector("h1")?.textContent).toBe("Test anime");
    expect(
      (fetchAnilist as jest.Mock).mock.calls.filter((call) =>
        call[0].includes("AnimeDetails"),
      ),
    ).toHaveLength(1);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
  }
});

test.each(["setItem", "getItem"] as const)(
  "episodes remain usable when browser storage %s throws",
  async (method) => {
    window.history.replaceState(
      {},
      "",
      "/anime/1/episode/3?audio=dub&source=anipm",
    );
    const storage = jest
      .spyOn(Storage.prototype, method)
      .mockImplementation(() => {
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      });
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const node = document.createElement("div");
    const root = createRoot(node);
    try {
      await act(async () =>
        root.render(
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>,
        ),
      );
      expect(node.querySelector('[role="dialog"]')?.textContent).toContain(
        "Episode 3",
      );
      act(() =>
        Array.from(node.querySelectorAll("button"))
          .find((button) => button.textContent === "Next")!
          .click(),
      );
      expect(node.querySelector('[role="dialog"]')?.textContent).toContain(
        "Episode 4",
      );
      expect(node.textContent).not.toContain("This page couldn’t load");
    } finally {
      act(() => root.unmount());
      storage.mockRestore();
      consoleError.mockRestore();
      window.history.replaceState({}, "", "/");
    }
  },
);

test.each(["/", "/?oauth=anilist&result=failed"])(
  "loading %s keeps saved Continue Watching storage unchanged",
  async (url) => {
    window.history.replaceState({}, "", url);
    const saved = JSON.stringify([
      {
        anime: { id: 1, title: { english: "Saved anime" } },
        episode: 3,
        timestamp: 1,
      },
    ]);
    localStorage.setItem("videasy_history", saved);
    const node = document.createElement("div");
    document.body.append(node);
    const root = createRoot(node);
    let mounted = false;
    try {
      await act(async () => root.render(<App />));
      mounted = true;
      expect(localStorage.getItem("videasy_history")).toBe(saved);
      act(() => root.unmount());
      mounted = false;
      expect(localStorage.getItem("videasy_history")).toBe(saved);
    } finally {
      if (mounted) act(() => root.unmount());
      node.remove();
      window.history.replaceState({}, "", "/");
    }
  },
);

test("watching the final episode at 80% keeps the anime in Continue Watching storage", async () => {
  window.history.replaceState({}, "", "/anime/1/episode/12");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    expect(JSON.parse(localStorage.getItem("videasy_history") || "[]")).toEqual([
      expect.objectContaining({ episode: 12 }),
    ]);
    act(() =>
      Array.from(node.querySelectorAll("button"))
        .find((button) => button.textContent === "Mark watched")!
        .click(),
    );
    expect(JSON.parse(localStorage.getItem("videasy_history") || "[]")).toEqual([
      expect.objectContaining({ episode: 12 }),
    ]);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
  }
});

test("completing the final episode removes the anime from Continue Watching storage", async () => {
  window.history.replaceState({}, "", "/anime/1/episode/12");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    act(() =>
      Array.from(node.querySelectorAll("button"))
        .find((button) => button.textContent === "Complete")!
        .click(),
    );
    expect(JSON.parse(localStorage.getItem("videasy_history") || "[]")).toEqual([]);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
  }
});

test("completing a non-final episode keeps the anime in Continue Watching", async () => {
  window.history.replaceState({}, "", "/anime/1/episode/3");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    act(() =>
      Array.from(node.querySelectorAll("button"))
        .find((button) => button.textContent === "Complete")!
        .click(),
    );
    expect(JSON.parse(localStorage.getItem("videasy_history") || "[]")).toEqual([
      expect.objectContaining({ episode: 3 }),
    ]);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
  }
});

test("a 101st started title evicts only the oldest entry", async () => {
  const seeded = Array.from({ length: 100 }, (_, index) => 100 - index);
  localStorage.setItem(
    "videasy_history",
    JSON.stringify(
      seeded.map((id) => ({
        anime: { id, title: { english: `Anime ${id}` } },
        episode: 1,
        timestamp: id,
      })),
    ),
  );
  window.history.replaceState({}, "", "/anime/101/episode/1");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    const history = JSON.parse(localStorage.getItem("videasy_history") || "[]");
    expect(history).toHaveLength(100);
    expect(history[0].anime.id).toBe(101);
    expect(history.some((entry: any) => entry.anime.id === 1)).toBe(false);
    expect(history.some((entry: any) => entry.anime.id === 2)).toBe(true);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
  }
});

test("Discover stays mounted, hidden while away, and its scroll is restored", async () => {
  window.history.replaceState({}, "", "/discover");
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const setY = (y: number) =>
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
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
    expect(discover().textContent).toBe("discover 1");
  } finally {
    act(() => root.unmount());
    node.remove();
    if (scrollYDescriptor)
      Object.defineProperty(window, "scrollY", scrollYDescriptor);
    else Reflect.deleteProperty(window, "scrollY");
    scrollTo.mockRestore();
    window.history.replaceState({}, "", "/");
  }
});

test("My List starts at top, is remembered, and a studio deep link starts Discover at top", async () => {
  window.history.replaceState({}, "", "/my-list");
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const setY = (y: number) =>
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const clickNav = (label: string) => act(() => {
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === label)!.click();
  });
  try {
    await act(async () => root.render(<App />));
    expect(node.querySelector('[data-testid="mylist"]')).not.toBeNull();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

    setY(700);
    clickNav("Discover");
    clickNav("Home");
    clickNav("My List");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 700, behavior: "instant" });

    setY(500);
    act(() => {
      window.history.replaceState({ apexIndex: 1 }, "", "/discover?studio=14");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
  } finally {
    act(() => root.unmount());
    node.remove();
    if (scrollYDescriptor)
      Object.defineProperty(window, "scrollY", scrollYDescriptor);
    else Reflect.deleteProperty(window, "scrollY");
    scrollTo.mockRestore();
    window.history.replaceState({}, "", "/");
  }
});

test("leaving a studio Discover and returning to plain Discover starts at top without breaking plain scroll memory", async () => {
  window.history.replaceState({}, "", "/discover?studio=14");
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const setY = (y: number) =>
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const clickNav = (label: string) => act(() => {
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === label)!.click();
  });
  try {
    await act(async () => root.render(<App />));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

    setY(450);
    clickNav("Home");
    expect(window.location.pathname).toBe("/");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

    clickNav("Discover");
    expect(window.location.pathname).toBe("/discover");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

    // Same-studio / plain-to-plain transitions must still restore scroll.
    setY(220);
    clickNav("Home");
    clickNav("Discover");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 220, behavior: "instant" });
  } finally {
    act(() => root.unmount());
    node.remove();
    if (scrollYDescriptor)
      Object.defineProperty(window, "scrollY", scrollYDescriptor);
    else Reflect.deleteProperty(window, "scrollY");
    scrollTo.mockRestore();
    window.history.replaceState({}, "", "/");
  }
});

test("clearing the studio filter from Discover starts the plain list at top", async () => {
  window.history.replaceState({}, "", "/discover?studio=14");
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const setY = (y: number) =>
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(<App />));
    setY(650);
    act(() =>
      Array.from(node.querySelectorAll("button"))
        .find((b) => b.textContent === "Clear studio")!.click(),
    );
    expect(window.location.pathname).toBe("/discover");
    expect(window.location.search).toBe("");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
  } finally {
    act(() => root.unmount());
    node.remove();
    if (scrollYDescriptor)
      Object.defineProperty(window, "scrollY", scrollYDescriptor);
    else Reflect.deleteProperty(window, "scrollY");
    scrollTo.mockRestore();
    window.history.replaceState({}, "", "/");
  }
});
