import { parseEpisodes, fetchEpisodeMetadata } from "./episodeMetadata";

test("matches local episode numbers and excludes specials and wrong anime", () => {
  const data = {
    mappings: { anilist_id: 16498 },
    episodes: {
      "2": {
        episode: "2",
        absoluteEpisodeNumber: 27,
        overview: "Episode summary",
        airDate: "2026-10-01",
        runtime: 24,
        title: { en: "That Day" },
        image: "https://artworks.thetvdb.com/episode.jpg",
      },
      S1: { title: { en: "Special" } },
      "3": { episode: "4", title: { en: "Wrong mapping" } },
      "4": { title: { "x-jat": "Fallback title" }, image: "javascript:bad" },
    },
  };
  expect(parseEpisodes(data, 16498)).toEqual({
    "2": {
      overview: "Episode summary",
      airDate: "2026-10-01",
      runtime: 24,
      title: "That Day",
      image: "https://artworks.thetvdb.com/episode.jpg",
    },
    "4": { title: "Fallback title", image: undefined },
  });
  expect(parseEpisodes(data, 999)).toEqual({});
});

test("deduplicates requests and falls back to cached metadata on failure", async () => {
  const original = global.fetch;
  const mock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      mappings: { anilist_id: 90001 },
      episodes: { "1": { title: { en: "Pilot" } } },
    }),
  });
  global.fetch = mock;
  try {
    const [a, b] = await Promise.all([
      fetchEpisodeMetadata(90001),
      fetchEpisodeMetadata(90001),
    ]);
    expect(a).toEqual(b);
    expect(mock).toHaveBeenCalledTimes(1);
    localStorage.setItem(
      "apex_episode_metadata_v2_90002",
      JSON.stringify({ updated: 0, episodes: { "2": { title: "Cached" } } }),
    );
    mock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchEpisodeMetadata(90002)).toEqual({
      "2": { title: "Cached" },
    });
  } finally {
    global.fetch = original;
    localStorage.clear();
  }
});
