import {
  fetchFollowingStories,
  groupStories,
  activityLabel,
} from "./followingStories";
const row = {
  id: 1,
  createdAt: 100,
  status: "watched episode",
  progress: "2 - 3",
  user: {
    id: 5,
    name: "Friend",
    avatar: { large: "https://example.com/avatar.png" },
  },
  media: { id: 10, type: "ANIME", title: { english: "Example" } },
};
test("groups anime list updates by stable user IDs, sorts activities, and ignores duplicates and unsafe images", () => {
  const groups = groupStories([
    row,
    { ...row, id: 2, createdAt: 90 },
    {
      ...row,
      id: 3,
      user: { ...row.user, id: 6 },
      media: { ...row.media, type: "MANGA" },
    },
    row,
    { ...row, id: 4, media: { ...row.media, isAdult: true } },
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].activities.map((a) => a.id)).toEqual([2, 1]);
  expect(activityLabel(groups[0].activities[1])).toBe("Watched episode 2 - 3");
  expect(
    groupStories([
      {
        ...row,
        user: { ...row.user, avatar: { large: "javascript:alert(1)" } },
      },
    ])[0].user.avatar,
  ).toBeUndefined();
});
test("uses authenticated proxy, verifies account identity, batches ratings and caches per account", async () => {
  const mock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { Viewer: { id: 77 }, Page: { activities: [row] } },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          Viewer: { id: 77 },
          u5: { mediaList: [{ mediaId: 10, score: 8 }] },
        },
      }),
    });
  global.fetch = mock;
  const signal = new AbortController().signal;
  const result = await fetchFollowingStories("77", signal);
  expect(result.groups[0].activities[0].score).toBe(8);
  expect(mock.mock.calls[0][0]).toBe("/api/oauth/anilist/graphql");
  expect(JSON.parse(mock.mock.calls[0][1].body).query).toContain(
    "isFollowing:true",
  );
  await fetchFollowingStories("77", signal);
  expect(mock).toHaveBeenCalledTimes(2);
  mock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { Viewer: { id: 77 }, Page: { activities: [row] } },
    }),
  });
  await expect(fetchFollowingStories("88", signal)).rejects.toThrow(
    "unavailable",
  );
});
