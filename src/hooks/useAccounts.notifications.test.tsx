import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useAccounts } from "./useAccounts";
import { useLibrary } from "./useLibrary";
jest.mock("./useLibrary", () => ({
  ...jest.requireActual("./useLibrary"),
  useLibrary: jest.fn(),
}));
test("bulk library refresh is silent; one rating edit across providers produces one poster notification and unchanged saves stay silent", async () => {
  localStorage.clear();
  const anime = {
    id: 10,
    idMal: 20,
    title: { english: "Example" },
    coverImage: { extraLarge: "https://example.com/poster.jpg" },
  };
  const library = {
    lists: {
      anilist: { identity: "1", complete: true },
      mal: { identity: "2", complete: true },
    },
    libraryEntries: [
      { provider: "anilist", anime, status: "watching", progress: 4, score: 7 },
      { provider: "mal", anime, status: "watching", progress: 4, score: 7 },
    ],
    libraryErrors: { anilist: "Import retry pending" },
    refreshLibrary: jest.fn(),
    record: jest.fn(),
    getListStatus: jest.fn(),
  };
  library.record.mockImplementation(
    (provider, anime, status, progress, edit) => {
      library.libraryEntries = library.libraryEntries.map((entry) =>
        entry.provider === provider
          ? {
              ...entry,
              status,
              progress: progress ?? entry.progress,
              score: edit.score ?? entry.score,
            }
          : entry,
      );
    },
  );
  (useLibrary as jest.Mock).mockReturnValue(library);
  global.fetch = jest.fn().mockImplementation(async (url, options) => {
    if (url === "/api/accounts")
      return {
        ok: true,
        json: async () => ({
          providers: {
            anilist: { connected: true, configured: true },
            mal: { connected: true, configured: true },
          },
        }),
      };
    const body = JSON.parse(options.body),
      mal = String(url).endsWith("mal") && !String(url).endsWith("anilist");
    return {
      ok: true,
      json: async () => ({
        success: true,
        entry: mal
          ? { status: "watching", num_episodes_watched: 4, score: body.score }
          : { status: "CURRENT", progress: 4, score: body.score * 10 },
      }),
    };
  });
  let accounts: ReturnType<typeof useAccounts>;
  function Harness() {
    accounts = useAccounts();
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Harness />));
    expect(accounts!.notificationFeed.notifications).toHaveLength(0);
    await act(async () => {
      await accounts!.sync(anime, "watching", undefined, false, {
        scores: { anilist: 9, mal: 9 },
      });
    });
    expect(accounts!.notificationFeed.notifications).toHaveLength(1);
    const notice = accounts!.notificationFeed.notifications[0];
    expect(notice.detail.match(/Rating updated: 7 → 9/g)).toHaveLength(1);
    expect(notice.anime?.poster).toBe(anime.coverImage.extraLarge);
    await act(async () => {
      await accounts!.sync(anime, "watching", undefined, false, {
        scores: { anilist: 9, mal: 9 },
      });
    });
    expect(accounts!.notificationFeed.notifications).toHaveLength(1);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
