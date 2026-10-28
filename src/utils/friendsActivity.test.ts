import { normalizeFriends, fetchFriendsActivity } from "./friendsActivity";
const original = global.fetch;
afterEach(() => {
  global.fetch = original;
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
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
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
        },
      }),
    });
  const signal = new AbortController().signal;
  await fetchFriendsActivity(888, "77", 1, signal);
  await fetchFriendsActivity(888, "77", 1, signal);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const call = (global.fetch as jest.Mock).mock.calls[0];
  expect(call[0]).toBe("/api/oauth/anilist/graphql");
  const payload = JSON.parse(call[1].body);
  expect(payload.query).toContain("isFollowing:true");
  expect(payload.query).toContain("score(format:POINT_100)");
  expect(payload.variables.mediaId).toBe(888);
  await expect(fetchFriendsActivity(888, "78", 1, signal)).rejects.toThrow(
    "unavailable",
  );
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
