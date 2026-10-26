import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  AnimeDetails,
  DetailAnime,
  descriptionText,
  nextDetailEpisode,
} from "./AnimeDetails";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("./HeroBackdrop", () => ({ HeroBackdrop: () => null }));
jest.mock("./AnimeBadges", () => ({ AnimeBadges: () => null }));
let node: HTMLDivElement, root: Root;
const anime: DetailAnime = {
  id: 1,
  idMal: 11,
  title: { english: "Example" },
  episodes: 12,
  description: "<b>A story</b> " + "about a journey. ".repeat(30),
  averageScore: 85,
  genres: ["Fantasy"],
  seasonYear: 2026,
  format: "TV",
};
beforeEach(() => {
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  localStorage.clear();
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
});
test("compact detail controls preserve imported watched state and selected audio without writing on episode selection", () => {
  const play = jest.fn(),
    episode = jest.fn(),
    sync = jest.fn();
  const accounts = {
    connected: { anilist: true, mal: false },
    getListStatus: () => "watching",
    libraryEntries: [
      { anime, provider: "anilist", status: "watching", progress: 4 },
    ],
    libraryLoading: false,
    busy: false,
    checking: false,
    sync,
  } as unknown as ReturnType<typeof useAccounts>;
  act(() =>
    root.render(
      <AnimeDetails
        anime={anime}
        accounts={accounts}
        total={12}
        selected={5}
        onEpisode={episode}
        onPlay={play}
        onBack={jest.fn()}
        onSelect={jest.fn()}
        onConnect={jest.fn()}
      />,
    ),
  );
  expect(node.querySelectorAll(".is-watched")).toHaveLength(4);
  expect(node.textContent).toContain("Continue Episode 5");
  expect(node.textContent).not.toContain("MAL synced");
  expect(node.querySelectorAll(".detail-playback")).toHaveLength(1);
  act(() =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === "Dub")!
      .click(),
  );
  act(() =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === "Play Episode 5")!
      .click(),
  );
  expect(play).toHaveBeenCalledWith(5, "dub", "megaplay");
  expect(localStorage.getItem("apex_episode_language")).toBe("dub");
  act(() =>
    (
      node.querySelector(
        '[aria-label="Episode 6, not marked watched"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(episode).toHaveBeenCalledWith(6);
  expect(sync).not.toHaveBeenCalled();
  expect(node.querySelectorAll(".is-watched")).toHaveLength(4);
  act(() =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === "Read more")!
      .click(),
  );
  expect(node.querySelector(".detail-synopsis .is-collapsed")).toBeNull();
  const status = node.querySelector(
    '[aria-label="List status"]',
  ) as HTMLSelectElement;
  act(() => {
    status.value = "completed";
    status.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(sync).toHaveBeenCalledWith(anime, "completed", 12);
});
test("continue targets the next unwatched episode, honors unfinished local history, and restarts completed series", () => {
  expect(nextDetailEpisode(12, 4)).toBe(5);
  expect(nextDetailEpisode(12, 4, { episode: 7 } as never)).toBe(7);
  expect(nextDetailEpisode(12, 12)).toBe(1);
  expect(
    descriptionText(
      "<img src=x onerror=bad()>Hello &amp; goodbye<script>bad()</script>",
    ),
  ).toBe("Hello & goodbye");
});
