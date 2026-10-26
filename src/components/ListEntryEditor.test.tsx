import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { ListEntryEditor } from "./ListEntryEditor";
import type { useAccounts } from "../hooks/useAccounts";
let node: HTMLDivElement, root: Root;
const original = global.fetch;
const anime = { id: 1, idMal: 11, episodes: 12, title: { english: "Example" } };
beforeEach(() => {
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  global.fetch = original;
});
test("loads saved personal scores, edits progress downward, preserves untouched scores and displays provider failures", async () => {
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => ({
      entry: {
        status: "watching",
        progress: 3,
        score: String(url).includes("/mal?") ? 7 : 8.5,
      },
    }),
  })) as jest.Mock;
  const sync = jest.fn().mockResolvedValue([
    { provider: "anilist", success: true },
    { provider: "mal", success: false, error: "Reconnect required" },
  ]);
  const accounts = {
    connected: { anilist: true, mal: true },
    libraryEntries: [
      {
        anime,
        provider: "anilist",
        status: "watching",
        progress: 3,
        score: 8.5,
      },
    ],
    getListStatus: () => "watching",
    record: jest.fn(),
    sync,
    busy: false,
  } as unknown as ReturnType<typeof useAccounts>;
  await act(async () =>
    root.render(
      <ListEntryEditor
        anime={anime}
        accounts={accounts}
        onConnect={jest.fn()}
      />,
    ),
  );
  expect(node.textContent).toContain("Your AniList: 8.5/10");
  await act(async () =>
    (
      node.querySelector(
        '[aria-label="Edit watched episodes and personal scores"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(
    (
      node.querySelector(
        '[aria-label="MyAnimeList personal score"]',
      ) as HTMLInputElement
    ).value,
  ).toBe("7");
  const set = (label: string, value: string) => {
    const input = node.querySelector(
      '[aria-label="' + label + '"]',
    ) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  act(() => {
    set("Episodes watched", "1");
    set("AniList personal score", "9.1");
  });
  await act(async () =>
    node
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(sync).toHaveBeenCalledWith(anime, "watching", 1, false, {
    manualProgress: true,
    scores: { anilist: 9.1 },
  });
  expect(node.textContent).toContain("MyAnimeList: Reconnect required");
  expect(node.querySelector("[role=dialog]")).not.toBeNull();
  act(() =>
    node
      .querySelector("form")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
  );
  expect(node.querySelector("[role=dialog]")).toBeNull();
});
