import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MyList } from "./MyList";
import { QuickList } from "./HomeDashboard";
import type { useAccounts } from "../hooks/useAccounts";
import { setRateLimitRetryAt } from "../utils/rateLimitClock";
jest.mock("./AnimeBadges", () => ({ AnimeBadges: () => null }));
jest.mock("./HomeDashboard", () => ({
  QuickList: jest.fn(() => null),
}));

const FILTERS_KEY = "apex_my_list_filters_v1";

function makeAccounts() {
  return {
    connected: { anilist: true, mal: true },
    libraryEntries: [],
    refreshLibrary: jest.fn(),
    libraryErrors: {},
    lists: {},
  } as unknown as ReturnType<typeof useAccounts>;
}

test("My List sorts by real entry updates and personal score, with compact score overlays", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = {
    connected: { anilist: true, mal: false },
    libraryEntries: [
      {
        provider: "anilist",
        anime: { id: 1, title: { english: "Older favourite" } },
        status: "completed",
        score: 10,
        progress: 12,
        updatedAt: 100,
      },
      {
        provider: "anilist",
        anime: { id: 2, title: { english: "Recent addition" } },
        status: "planning",
        score: 7,
        progress: 0,
        updatedAt: 200,
      },
    ],
    refreshLibrary: jest.fn(),
    libraryErrors: {},
    lists: {},
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
    expect(host.querySelector(".poster-title")?.textContent).toBe(
      "Recent addition",
    );
    expect(host.querySelectorAll(".library-status")).toHaveLength(0);
    expect(host.querySelectorAll(".my-list-score")).toHaveLength(2);
    act(() => {
      const sort = host.querySelector<HTMLSelectElement>(
        '[aria-label="Sort my list"]',
      )!;
      sort.value = "highest";
      sort.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector(".poster-title")?.textContent).toBe(
      "Older favourite",
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

describe.each([
  ["the rate-limit message", "AniList rate limit reached. Please try again later."],
  ["a 429 error", "AniList request failed (429)"],
])("My List with %s", (_label, error) => {
  test("shows the automatic retry hint", () => {
    localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const accounts = {
      connected: { anilist: true, mal: false },
      libraryEntries: [],
      refreshLibrary: jest.fn(),
      libraryErrors: { anilist: error },
      lists: {},
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
      const alert = host.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain("AniList: " + error);
      expect(alert?.textContent).toContain(
        "automatically retrying in about a minute",
      );
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});

test("shows the exact seconds remaining in the My List rate-limit alert", () => {
  localStorage.clear();
  setRateLimitRetryAt(Date.now() + 27_000);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <MyList
          accounts={
            {
              connected: { anilist: true, mal: false },
              libraryEntries: [],
              refreshLibrary: jest.fn(),
              libraryErrors: {
                anilist: "AniList rate limit reached. Please try again later.",
              },
              lists: {},
            } as unknown as ReturnType<typeof useAccounts>
          }
          onSelect={jest.fn()}
          onConnect={jest.fn()}
        />,
      ),
    );
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("retrying in 27s");
    expect(alert?.textContent).not.toContain("about a minute");
  } finally {
    setRateLimitRetryAt(0);
    act(() => root.unmount());
    host.remove();
  }
});

test("restores and persists all four filters", () => {
  localStorage.clear();
  localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({
      status: "completed",
      provider: "mal",
      search: "Naruto",
      sort: "title",
    }),
  );
  const host = document.createElement("div");
  document.body.append(host);
  let root = createRoot(host);
  const accounts = makeAccounts();
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
    expect(
      (host.querySelector('[aria-label="Search my list"]') as HTMLInputElement)
        .value,
    ).toBe("Naruto");
    expect(
      (host.querySelector('[aria-label="List provider"]') as HTMLSelectElement)
        .value,
    ).toBe("mal");
    expect(
      (
        host.querySelector(
          '[aria-label="Filter list status"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("completed");
    expect(
      (host.querySelector('[aria-label="Sort my list"]') as HTMLSelectElement)
        .value,
    ).toBe("title");

    act(() => {
      const status = host.querySelector<HTMLSelectElement>(
        '[aria-label="Filter list status"]',
      )!;
      status.value = "watching";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(JSON.parse(localStorage.getItem(FILTERS_KEY)!)).toEqual({
      status: "watching",
      provider: "mal",
      search: "Naruto",
      sort: "title",
    });

    act(() => root.unmount());
    root = createRoot(host);
    act(() =>
      root.render(
        <MyList
          accounts={accounts}
          onSelect={jest.fn()}
          onConnect={jest.fn()}
        />,
      ),
    );
    expect(
      (host.querySelector('[aria-label="Search my list"]') as HTMLInputElement)
        .value,
    ).toBe("Naruto");
    expect(
      (host.querySelector('[aria-label="List provider"]') as HTMLSelectElement)
        .value,
    ).toBe("mal");
    expect(
      (
        host.querySelector(
          '[aria-label="Filter list status"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("watching");
    expect(
      (host.querySelector('[aria-label="Sort my list"]') as HTMLSelectElement)
        .value,
    ).toBe("title");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("migrates the legacy sort key", () => {
  localStorage.clear();
  localStorage.setItem("apex_my_list_sort_v1", "highest");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = makeAccounts();
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
    expect(
      (host.querySelector('[aria-label="Sort my list"]') as HTMLSelectElement)
        .value,
    ).toBe("highest");
    expect(JSON.parse(localStorage.getItem(FILTERS_KEY)!).sort).toBe("highest");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("storage failures do not crash", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = makeAccounts();
  const getItem = jest
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new DOMException("blocked");
    });
  const setItem = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("blocked");
    });
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
    expect(
      (
        host.querySelector(
          '[aria-label="Filter list status"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("all");
    expect(
      (host.querySelector('[aria-label="Sort my list"]') as HTMLSelectElement)
        .value,
    ).toBe("updated");
  } finally {
    getItem.mockRestore();
    setItem.mockRestore();
    act(() => root.unmount());
    host.remove();
  }
});

test("removing a watch later entry hides its card immediately without a remount", () => {
  localStorage.clear();
  localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({
      status: "watch-later",
      provider: "all",
      search: "",
      sort: "updated",
    }),
  );
  localStorage.setItem(
    "apex_watch_later_v1",
    JSON.stringify([
      {
        id: 1,
        title: { english: "First" },
        coverImage: { extraLarge: "first.jpg" },
        addedAt: 200,
      },
      {
        id: 2,
        title: { english: "Second" },
        coverImage: { extraLarge: "second.jpg" },
        addedAt: 100,
      },
    ]),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <MyList
          accounts={makeAccounts()}
          onSelect={jest.fn()}
          onConnect={jest.fn()}
        />,
      ),
    );
    expect(host.querySelectorAll(".poster-title")).toHaveLength(2);
    act(() => {
      host
        .querySelector<HTMLButtonElement>(
          '[aria-label="Remove from Watch Later: First"]',
        )!
        .click();
    });
    expect(
      Array.from(host.querySelectorAll(".poster-title")).map(
        (node) => node.textContent,
      ),
    ).toEqual(["Second"]);
    expect(
      JSON.parse(localStorage.getItem("apex_watch_later_v1") || "[]"),
    ).toHaveLength(1);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("starts a resume import when My List opens", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = {
    ...makeAccounts(),
    connected: { anilist: true, mal: false },
  } as ReturnType<typeof useAccounts>;
  try {
    await act(async () =>
      root.render(
        <MyList
          accounts={accounts}
          onSelect={jest.fn()}
          onConnect={jest.fn()}
        />,
      ),
    );
    expect(accounts.refreshLibrary).toHaveBeenCalledWith("resume");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
test("shows the list-status button overlay on every card so any status can be changed", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = {
    connected: { anilist: true, mal: false },
    libraryEntries: [
      {
        provider: "anilist",
        anime: { id: 1, title: { english: "Watching now" } },
        status: "watching",
        progress: 3,
        updatedAt: 1,
      },
      {
        provider: "anilist",
        anime: { id: 2, title: { english: "Planned later" } },
        status: "planning",
        progress: 0,
        updatedAt: 2,
      },
    ],
    refreshLibrary: jest.fn(),
    libraryErrors: {},
    lists: {},
  } as unknown as ReturnType<typeof useAccounts>;
  localStorage.setItem(
    "apex_watch_later_v1",
    JSON.stringify([
      {
        id: 2,
        title: { english: "Planned later" },
        coverImage: { extraLarge: "x.jpg" },
        addedAt: 2,
      },
    ]),
  );
  (QuickList as jest.Mock).mockClear();
  try {
    act(() =>
      root.render(
        <MyList accounts={accounts} onSelect={jest.fn()} onConnect={jest.fn()} />,
      ),
    );
    expect((QuickList as jest.Mock).mock.calls).toHaveLength(2);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("retries a rate limit from My List only after the reset", async () => {
  jest.useFakeTimers();
  setRateLimitRetryAt(Date.now() + 30_000);
  try {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const accounts = {
      ...makeAccounts(),
      connected: { anilist: true, mal: false },
      libraryErrors: {
        anilist: "AniList rate limit reached. Please try again later.",
      },
    } as unknown as ReturnType<typeof useAccounts>;
    try {
      await act(async () =>
        root.render(
          <MyList
            accounts={accounts}
            onSelect={jest.fn()}
            onConnect={jest.fn()}
          />,
        ),
      );
      expect(accounts.refreshLibrary).not.toHaveBeenCalledWith("resume");
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(accounts.refreshLibrary).toHaveBeenCalledWith("resume");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  } finally {
    setRateLimitRetryAt(0);
    jest.useRealTimers();
  }
});

test("the dice button opens the random picker with the current list", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const accounts = {
    connected: { anilist: true, mal: false },
    libraryEntries: [
      {
        provider: "anilist",
        anime: {
          id: 1,
          title: { english: "Pick me" },
          coverImage: { extraLarge: "https://example.com/pick.jpg" },
        },
        status: "planning",
        score: 8,
        progress: 0,
        updatedAt: 1,
      },
    ],
    refreshLibrary: jest.fn(),
    libraryErrors: {},
    lists: {},
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
    const dice = host.querySelector<HTMLButtonElement>(
      '[aria-label="Pick a random anime from this list"]',
    )!;
    expect(dice).not.toBeNull();
    act(() => dice.click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
      "Tonight, watch",
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("the dice button is disabled when the list is empty", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <MyList
          accounts={makeAccounts()}
          onSelect={jest.fn()}
          onConnect={jest.fn()}
        />,
      ),
    );
    const dice = host.querySelector<HTMLButtonElement>(
      '[aria-label="Pick a random anime from this list"]',
    );
    expect(dice?.disabled).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("the dice button is disabled while accounts are busy or checking", () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const libraryEntries = [
    {
      provider: "anilist",
      anime: {
        id: 1,
        title: { english: "Pick me" },
        coverImage: { extraLarge: "https://example.com/pick.jpg" },
      },
      status: "planning",
      score: 8,
      progress: 0,
      updatedAt: 1,
    },
  ];
  try {
    for (const busyState of [{ busy: true }, { checking: true }]) {
      act(() =>
        root.render(
          <MyList
            accounts={
              {
                ...makeAccounts(),
                libraryEntries,
                ...busyState,
              } as unknown as ReturnType<typeof useAccounts>
            }
            onSelect={jest.fn()}
            onConnect={jest.fn()}
          />,
        ),
      );
      const dice = host.querySelector<HTMLButtonElement>(
        '[aria-label="Pick a random anime from this list"]',
      );
      expect(dice?.disabled).toBe(true);
    }
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
