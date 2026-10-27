import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import App from "./App";
import { fetchAnilist } from "./utils/anilist";
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
    <button onClick={() => onView("all")}>Home</button>
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
  VideoPlayer: ({ episode, onNext, onClose }: any) => (
    <div role="dialog">
      Episode {episode}
      <button onClick={onNext}>Next</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
beforeEach(() => {
  localStorage.clear();
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
          : {
              trending: { media: [] },
              action: { media: [] },
              romance: { media: [] },
            },
      ),
  );
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
