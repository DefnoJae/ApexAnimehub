jest.mock("../anilistAuth", () => ({
  anilistRequest: jest.fn(),
  getAniListToken: jest.fn(),
}));

import { anilistRequest, getAniListToken } from "../anilistAuth";
import {
  readAniListEntry,
  readAniListList,
  removeAniListEntry,
  updateAniListEntry,
  validateAniListUpdate,
} from "./anilistList";

beforeEach(() => {
  jest.clearAllMocks();
});

test("readAniListList uses the verified token and makes one list request per page", async () => {
  const controller = new AbortController();
  (getAniListToken as jest.Mock).mockResolvedValue({
    accessToken: "t",
    expiresAt: Date.now() + 3600000,
    identity: "2",
    name: "Alice",
  });
  (anilistRequest as jest.Mock).mockResolvedValue({
    Page: {
      pageInfo: { hasNextPage: true },
      mediaList: [{
        status: "PAUSED", progress: 7, score: 85, updatedAt: 10,
        media: { id: 3, idMal: 4, title: { english: "Example" } },
      }],
    },
  });
  const page = await readAniListList(2, controller.signal);
  expect(page).toMatchObject({
    identity: "2", name: "Alice", hasNextPage: true,
    entries: [{ status: "paused", progress: 7, score: 8.5, updatedAt: 10000 }],
  });
  expect(anilistRequest).toHaveBeenCalledTimes(1);
  expect((anilistRequest as jest.Mock).mock.calls[0][0]).toContain(
    "mediaList(userId:$user",
  );
  expect((anilistRequest as jest.Mock).mock.calls[0][1]).toEqual({
    user: 2, page: 2,
  });
  expect(getAniListToken).toHaveBeenCalledWith(controller.signal);
});

test.each([
  ["missing", undefined],
  ["non-numeric", "abc"],
  ["non-positive", "0"],
  ["fractional", "1.5"],
])("readAniListList rejects a %s token identity before requesting", async (_label, identity) => {
  (getAniListToken as jest.Mock).mockResolvedValue({
    accessToken: "t",
    expiresAt: Date.now() + 3600000,
    identity,
  });
  await expect(readAniListList(2)).rejects.toThrow(
    "AniList connection required. Please reconnect.",
  );
  expect(anilistRequest).not.toHaveBeenCalled();
});

test("updates preserve automatic completion, forward progress and POINT_100 scores", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({
      Media: { mediaListEntry: { progress: 9, status: "COMPLETED" } },
    })
    .mockResolvedValueOnce({
      SaveMediaListEntry: { id: 5, status: "COMPLETED", progress: 9, score: 90 },
    });
  const result = await updateAniListEntry({
    id: 3, status: "watching", progress: 4, score: 9, automatic: true,
  });
  expect(result).toMatchObject({ status: "COMPLETED", progress: 9, score: 90 });
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toMatchObject({
    id: 3, status: "COMPLETED", progress: 9, score: 90,
  });
});

test("removeAniListEntry finds the list entry id before deleting it", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: { id: 55 } } })
    .mockResolvedValueOnce({ DeleteMediaListEntry: { deleted: true } });
  expect(await removeAniListEntry(3)).toBe(true);
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toEqual({ id: 55 });
});

test("invalid updates are rejected before any request", () => {
  expect(() => validateAniListUpdate({
    id: 1, status: "watching", progress: -1,
  })).toThrow("Invalid episode progress");
  expect(() => validateAniListUpdate({
    id: 1, status: "watching", score: 11,
  })).toThrow("Score must be a whole number from 0 to 10");
  expect(anilistRequest).not.toHaveBeenCalled();
});

test("validateAniListUpdate preserves every server validation message", () => {
  expect(() => validateAniListUpdate({ id: 0, status: "watching" }))
    .toThrow("Invalid anime or list status");
  expect(() => validateAniListUpdate({ id: 1, status: "watching", progress: 100001 }))
    .toThrow("Invalid episode progress");
  expect(() => validateAniListUpdate({ id: 1, status: "watching", score: 10.5 }))
    .toThrow("Score must be a whole number from 0 to 10");
  expect(() => validateAniListUpdate({
    id: 1, status: "watching", automatic: "yes" as unknown as boolean,
  })).toThrow("Invalid update mode");
  expect(() => validateAniListUpdate({
    id: 1, status: "watching", manualProgress: true, automatic: true,
  })).toThrow("Manual progress cannot be automatic");
});

test("non-manual progress never rewinds and manual progress skips the lookup", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({
      Media: { mediaListEntry: { progress: 12, status: "WATCHING" } },
    })
    .mockResolvedValueOnce({
      SaveMediaListEntry: { status: "CURRENT", progress: 12 },
    });
  await updateAniListEntry({ id: 9, status: "watching", progress: 5 });
  expect((anilistRequest as jest.Mock).mock.calls[1][1]).toMatchObject({
    status: "CURRENT", progress: 12,
  });

  jest.clearAllMocks();
  (anilistRequest as jest.Mock).mockResolvedValueOnce({
    SaveMediaListEntry: { status: "CURRENT", progress: 2 },
  });
  await updateAniListEntry({
    id: 9, status: "watching", progress: 2, manualProgress: true,
  });
  expect(anilistRequest).toHaveBeenCalledTimes(1);
  expect((anilistRequest as jest.Mock).mock.calls[0][1]).toMatchObject({
    id: 9, status: "CURRENT", progress: 2,
  });
});

test("readAniListEntry normalizes scores and returns null without an entry", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({
      Media: { mediaListEntry: { status: "PAUSED", progress: 3, score: 75 } },
    })
    .mockResolvedValueOnce({ Media: null });
  expect(await readAniListEntry(7)).toEqual({
    status: "paused", progress: 3, score: 7.5,
  });
  expect(await readAniListEntry(8)).toBeNull();
});

test("removeAniListEntry returns true when no list entry exists", async () => {
  (anilistRequest as jest.Mock)
    .mockResolvedValueOnce({ Media: { mediaListEntry: null } });
  expect(await removeAniListEntry(6)).toBe(true);
  expect(anilistRequest).toHaveBeenCalledTimes(1);
});

test("update and remove for the same anime do not overlap", async () => {
  let active = 0;
  let maxActive = 0;
  (anilistRequest as jest.Mock).mockImplementation(async (query: string) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active--;
    if (query.includes("SaveMediaListEntry")) {
      return { SaveMediaListEntry: { status: "CURRENT" } };
    }
    if (query.includes("DeleteMediaListEntry")) {
      return { DeleteMediaListEntry: { deleted: true } };
    }
    return { Media: { mediaListEntry: { id: 77 } } };
  });
  await Promise.all([
    updateAniListEntry({ id: 42, status: "watching" }),
    removeAniListEntry(42),
  ]);
  expect(maxActive).toBe(1);
});
