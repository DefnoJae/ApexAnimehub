import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useAccounts } from "./useAccounts";
import { useLibrary } from "./useLibrary";
import { updateAniListEntry } from "../utils/sync/anilistList";
import { localToday } from "../utils/sync/localDate";

jest.mock("./useLibrary", () => ({
  ...jest.requireActual("./useLibrary"),
  useLibrary: jest.fn(),
}));
jest.mock("../utils/sync/anilistList", () => ({
  updateAniListEntry: jest.fn(),
  removeAniListEntry: jest.fn(),
}));
jest.mock("../utils/sync/localDate", () => ({
  localToday: jest.fn(() => "2026-11-19"),
}));
jest.mock("../utils/anilistAuth", () => ({
  clearAniListToken: jest.fn(),
  hasAniListToken: jest.fn(() => false),
  ANILIST_AUTH_INVALID_EVENT: "anilist-auth-invalid",
}));

test("sync computes one local date and forwards the same day to both providers", async () => {
  localStorage.clear();
  const anime = { id: 10, idMal: 20, title: { english: "Example" } };
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
    return {
      ok: true,
      json: async () => ({
        success: true,
        entry: { status: "watching", num_episodes_watched: 0 },
      }),
    };
  });
  (updateAniListEntry as jest.Mock).mockResolvedValue({
    status: "CURRENT",
    progress: 0,
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
    (localToday as jest.Mock).mockReset();
    (localToday as jest.Mock).mockReturnValue("2026-11-19");
    await act(async () => {
      await accounts.sync(anime, "watching");
    });
    expect(localToday).toHaveBeenCalledTimes(1);
    expect(updateAniListEntry).toHaveBeenCalledWith(
      expect.objectContaining({ today: "2026-11-19" }),
    );
    const malCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/list/mal",
    );
    expect(malCall).toBeDefined();
    expect(JSON.parse(malCall![1].body).today).toBe("2026-11-19");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
