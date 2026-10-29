import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MyList } from "./MyList";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("./AnimeBadges", () => ({ AnimeBadges: () => null }));
jest.mock("./HomeDashboard", () => ({ QuickList: () => null }));
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
