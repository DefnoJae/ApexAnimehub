import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MyList } from "./MyList";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("./AnimeBadges", () => ({ AnimeBadges: () => null }));
jest.mock("./HomeDashboard", () => ({ QuickList: () => null }));

const FILTERS_KEY = "apex_my_list_filters_v1";

function makeAccounts() {
  return {
    connected: { anilist: true, mal: true },
    libraryEntries: [],
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
