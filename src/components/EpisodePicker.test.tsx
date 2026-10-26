import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { EpisodePicker } from "./EpisodePicker";
test("highlights watched progress from either matching account while selection never changes watched counts", () => {
  const node = document.createElement("div"),
    root = createRoot(node),
    select = jest.fn();
  act(() =>
    root.render(
      <EpisodePicker
        anime={{ id: 1, idMal: 11 }}
        total={12}
        selected={5}
        importing={false}
        onSelect={select}
        entries={[
          {
            anime: { id: 1 },
            provider: "anilist",
            status: "watching",
            progress: 3,
            updatedAt: 1,
          },
          {
            anime: { id: 0, idMal: 11 },
            provider: "mal",
            status: "watching",
            progress: 7,
            updatedAt: 1,
          },
          {
            anime: { id: 99 },
            provider: "anilist",
            status: "completed",
            progress: 12,
            updatedAt: 1,
          },
        ]}
      />,
    ),
  );
  expect(node.querySelectorAll(".is-watched")).toHaveLength(7);
  expect(node.querySelector(".is-selected")?.textContent).toBe("5");
  act(() =>
    (
      node.querySelector(
        '[aria-label="Episode 10, not marked watched"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(select).toHaveBeenCalledWith(10);
  expect(node.querySelectorAll(".is-watched")).toHaveLength(7);
  expect(node.textContent).toContain("AniList: 3 · MAL: 7");
  act(() => root.unmount());
});
