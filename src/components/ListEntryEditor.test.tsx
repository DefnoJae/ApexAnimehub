import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { ListEntryEditor, commonWholeRating } from "./ListEntryEditor";
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
test("one whole-number rating updates both lists, rejects decimals and displays provider failures", async () => {
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
  expect(node.textContent).toContain("Choose a whole-number rating");
  await act(async () =>
    (
      document.querySelector(
        '[aria-label="Edit watched episodes and personal scores"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(
    (document.querySelector('[aria-label="Your rating"]') as HTMLInputElement)
      .value,
  ).toBe("");
  expect(document.querySelectorAll('[aria-label="Your rating"]')).toHaveLength(
    1,
  );
  const set = (label: string, value: string) => {
    const input = document.querySelector(
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
    set("Your rating", "9.1");
  });
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(sync).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Use a whole-number rating");
  act(() => set("Your rating", "9"));
  await act(async () =>
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(sync).toHaveBeenCalledWith(anime, "watching", 1, false, {
    manualProgress: true,
    scores: { anilist: 9, mal: 9 },
  });
  expect(document.body.textContent).toContain(
    "MyAnimeList: Reconnect required",
  );
  expect(document.querySelector("[role=dialog]")).not.toBeNull();
  act(() =>
    document
      .querySelector("form")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
  );
  expect(document.querySelector("[role=dialog]")).toBeNull();
});

test("saved whole ratings agree without rounding fractional or conflicting old ratings", () => {
  expect(commonWholeRating([8, 8])).toBe("8");
  expect(commonWholeRating([10])).toBe("10");
  expect(commonWholeRating([8.5])).toBe("");
  expect(commonWholeRating([8, 7])).toBe("");
  expect(commonWholeRating([0, 0])).toBe("");
});

test.each([
  ["0", { anilist: 0, mal: 0 }],
  ["", {}],
])(
  "rating '%s' clears every list or leaves existing scores untouched",
  async (value, scores) => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        entry: { status: "watching", progress: 3, score: 8 },
      }),
    })) as jest.Mock;
    const sync = jest.fn().mockResolvedValue([
      { provider: "anilist", success: true },
      { provider: "mal", success: true },
    ]);
    const accounts = {
      connected: { anilist: true, mal: true },
      libraryEntries: [],
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
    await act(async () =>
      (node.querySelector("button") as HTMLButtonElement).click(),
    );
    expect(
      (document.querySelector('[aria-label="Your rating"]') as HTMLInputElement)
        .value,
    ).toBe("8");
    act(() => {
      for (const [label, text] of [
        ["Episodes watched", "2"],
        ["Your rating", String(value)],
      ]) {
        const input = document.querySelector(
          `[aria-label="${label}"]`,
        ) as HTMLInputElement;
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await act(async () =>
      document
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(sync).toHaveBeenCalledWith(anime, "watching", 2, false, {
      manualProgress: true,
      scores,
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  },
);

test("personal rating stays before the far-right trailer control", () => {
  const accounts = {
    connected: { anilist: true, mal: false },
    libraryEntries: [
      { anime, provider: "anilist", status: "watching", progress: 2, score: 9 },
    ],
  } as unknown as ReturnType<typeof useAccounts>;
  act(() =>
    root.render(
      <ListEntryEditor
        anime={anime}
        accounts={accounts}
        onConnect={jest.fn()}
        afterEdit={<button data-trailer="true">Trailer</button>}
      />,
    ),
  );
  const rating = node.querySelector(".personal-rating-pill")!,
    trailer = node.querySelector("[data-trailer]")!;
  expect(rating.textContent).toBe("9");
  expect(
    rating.compareDocumentPosition(trailer) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(node.lastElementChild).toBe(trailer);
});
