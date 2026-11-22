import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useAccounts } from "./useAccounts";
import { useLibrary } from "./useLibrary";
import {
  ANILIST_AUTH_INVALID_EVENT,
  ANILIST_TOKEN_KEY,
} from "../utils/anilistAuth";
import {
  updateAniListEntry,
  removeAniListEntry,
} from "../utils/sync/anilistList";
jest.mock("./useLibrary", () => ({
  ...jest.requireActual("./useLibrary"),
  useLibrary: jest.fn(),
}));
jest.mock("../utils/sync/anilistList", () => ({
  updateAniListEntry: jest.fn(),
  removeAniListEntry: jest.fn(),
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
    removeRecord: jest.fn(),
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
    const body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        success: true,
        entry: {
          status: "watching",
          num_episodes_watched: 4,
          score: body.score,
        },
      }),
    };
  });
  (updateAniListEntry as jest.Mock).mockImplementation(async (body) => ({
    status: "CURRENT",
    progress: 4,
    score: body.score * 10,
  }));
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
    (global.fetch as jest.Mock).mockImplementation(async () => ({
      ok: false,
      json: async () => ({ error: "Reconnect required" }),
    }));
    (removeAniListEntry as jest.Mock).mockResolvedValueOnce(true);
    await act(async () => {
      expect(await accounts!.remove(anime)).toBe(false);
    });
    expect(removeAniListEntry).toHaveBeenCalledWith(anime.id);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/list/mal",
      expect.objectContaining({ method: "POST" }),
    );
    expect(library.removeRecord).toHaveBeenCalledWith("anilist", anime);
    expect(library.removeRecord).not.toHaveBeenCalledWith("mal", anime);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("invalid AniList token disconnects AniList locally without changing MAL", async () => {
  (useLibrary as jest.Mock).mockReturnValue({
    lists: {
      anilist: { identity: "1", complete: true },
      mal: { identity: "2", complete: true },
    },
    libraryEntries: [],
    libraryErrors: {},
    refreshLibrary: jest.fn(),
    record: jest.fn(),
    removeRecord: jest.fn(),
    getListStatus: jest.fn(),
  });
  global.fetch = jest.fn().mockImplementation(async (url) => {
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
    return { ok: true, json: async () => ({}) };
  });
  let accounts!: ReturnType<typeof useAccounts>;
  function Harness() {
    accounts = useAccounts();
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Harness />));
    expect(accounts.connected).toEqual({ anilist: true, mal: true });
    await act(async () => {
      window.dispatchEvent(new Event(ANILIST_AUTH_INVALID_EVENT));
    });
    expect(accounts.connected).toEqual({ anilist: false, mal: true });
    expect(accounts.accountError).toContain("Reconnect AniList");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("refresh marks AniList connected from a stored implicit token when the server session is absent", async () => {
  localStorage.clear();
  localStorage.setItem(ANILIST_TOKEN_KEY, JSON.stringify({
    accessToken: "implicit-token",
    expiresAt: Date.now() + 3600000,
  }));
  (useLibrary as jest.Mock).mockReturnValue({
    lists: {},
    libraryEntries: [],
    libraryErrors: {},
    refreshLibrary: jest.fn(),
    record: jest.fn(),
    removeRecord: jest.fn(),
    getListStatus: jest.fn(),
  });
  global.fetch = jest.fn().mockImplementation(async (url) => {
    if (url === "/api/accounts")
      return {
        ok: true,
        json: async () => ({
          providers: {
            anilist: { connected: false, configured: true },
            mal: { connected: false, configured: true },
          },
        }),
      };
    throw new Error("Unexpected fetch " + url);
  });
  let accounts!: ReturnType<typeof useAccounts>;
  function Harness() {
    accounts = useAccounts();
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Harness />));
    expect(accounts.connected).toEqual({ anilist: true, mal: false });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
