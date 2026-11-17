jest.mock("./anilistAuth", () => ({
  anilistRequest: jest.fn(),
  AniListAuthError: class AniListAuthError extends Error {},
}));
import { AniListAuthError, anilistRequest } from "./anilistAuth";
import { normalizeFriends, fetchFriendsActivity } from "./friendsActivity";

beforeEach(() => {
  jest.clearAllMocks();
});
test("normalizes exact anime IDs, ratings and missing information without invented totals", () => {
  const entries = normalizeFriends(
    [
      {
        mediaId: 21,
        status: "CURRENT",
        score: 75,
        progress: 1,
        media: { episodes: 12 },
        user: {
          id: 1,
          name: "Friend",
          avatar: { large: "https://s4.anilist.co/avatar.jpg" },
        },
      },
      {
        mediaId: 21,
        status: "COMPLETED",
        score: 0,
        progress: 24,
        media: { episodes: null },
        user: { id: 2, name: "Completed" },
      },
      {
        mediaId: 99,
        status: "CURRENT",
        progress: 4,
        user: { id: 3, name: "Wrong anime" },
      },
    ],
    21,
  );
  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({ score: 7.5, progress: 1, total: 12 });
  expect(entries[1].score).toBeUndefined();
  expect(entries[1].total).toBeUndefined();
});
test("uses authenticated following query, caches per viewer and never reuses another account's results", async () => {
  (anilistRequest as jest.Mock).mockResolvedValue({
    Viewer: { id: 77 },
    Page: {
      pageInfo: { hasNextPage: false },
      mediaList: [
        {
          mediaId: 888,
          status: "CURRENT",
          score: 80,
          progress: 3,
          user: { id: 1, name: "Real friend" },
        },
      ],
    },
  });
  const signal = new AbortController().signal;
  await fetchFriendsActivity(888, "77", 1, signal);
  await fetchFriendsActivity(888, "77", 1, signal);
  expect(anilistRequest).toHaveBeenCalledTimes(1);
  expect(anilistRequest).toHaveBeenCalledWith(
    expect.stringContaining("FriendsActivity"),
    { mediaId: 888, page: 1 },
    signal,
  );
  (anilistRequest as jest.Mock).mockRejectedValueOnce(new Error("unavailable"));
  await expect(fetchFriendsActivity(888, "78", 1, signal)).rejects.toThrow(
    "unavailable",
  );
  expect(anilistRequest).toHaveBeenCalledTimes(2);
});

test("maps AniList auth failures to the existing reconnect message", async () => {
  const signal = new AbortController().signal;
  (anilistRequest as jest.Mock).mockRejectedValueOnce(
    new AniListAuthError("expired"),
  );
  await expect(fetchFriendsActivity(888, "79", 1, signal)).rejects.toThrow(
    "Reconnect AniList to see following activity.",
  );
});
