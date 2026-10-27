import { fetchAnilist } from "./anilist";
import {
  animeSeasons,
  fetchRecentlyAired,
  fetchHomeCatalog,
  fetchMissingLibrary,
} from "./homeRows";
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));
const request = fetchAnilist as jest.Mock;
const anime = (id: number) => ({
  id,
  idMal: id + 10000,
  type: "ANIME",
  title: { english: `Anime ${id}` },
});
beforeEach(() => request.mockReset());
test("season boundaries include last year when January follows the fall season", () => {
  expect(animeSeasons(new Date("2026-01-03T00:00:00Z"))).toEqual({
    season: "WINTER",
    year: 2026,
    previousSeason: "FALL",
    previousYear: 2025,
  });
  expect(animeSeasons(new Date("2026-10-27T00:00:00Z"))).toEqual({
    season: "FALL",
    year: 2026,
    previousSeason: "SUMMER",
    previousYear: 2026,
  });
});
test("recently aired paginates duplicate episodes until it has thirty unique anime", async () => {
  request
    .mockResolvedValueOnce({
      Page: {
        pageInfo: { hasNextPage: true },
        airingSchedules: Array.from({ length: 50 }, () => ({
          media: anime(1),
        })),
      },
    })
    .mockResolvedValueOnce({
      Page: {
        pageInfo: { hasNextPage: false },
        airingSchedules: Array.from({ length: 35 }, (_, i) => ({
          media: anime(i + 1),
        })),
      },
    });
  const result = await fetchRecentlyAired(new Date("2026-10-27T00:00:00Z"));
  expect(result).toHaveLength(30);
  expect(new Set(result.map((a) => a.id)).size).toBe(30);
  expect(request.mock.calls[1][1].page).toBe(2);
});
test("home season rows request thirty titles and keep shorter real lists without padding", async () => {
  request.mockImplementation((query: string) =>
    Promise.resolve(
      query.includes("RecentlyAired")
        ? {
            Page: {
              pageInfo: { hasNextPage: false },
              airingSchedules: [{ media: anime(9) }],
            },
          }
        : {
            trending: {
              media: Array.from({ length: 30 }, (_, i) => anime(i + 1)),
            },
            current: { media: [anime(4), anime(5)] },
            previous: { media: [anime(6)] },
          },
    ),
  );
  const result = await fetchHomeCatalog(new Date("2026-01-01T00:00:00Z"));
  expect(result.trending).toHaveLength(30);
  expect(result.rows.map((row) => row.title)).toEqual([
    "Trending Now",
    "Recently Aired",
    "Best of This Season",
    "Best of Last Season",
  ]);
  expect(result.rows[2].animes).toHaveLength(2);
  expect(result.rows[3].animes).toHaveLength(1);
  const call = request.mock.calls.find((call) =>
    call[0].includes("HomeCatalog"),
  )!;
  expect(call[0]).toContain("perPage:30");
  expect(call[1].previousYear).toBe(2025);
});
test("missing library follows specials and side stories, resolves MAL seeds, excludes both lists and cycles", async () => {
  const owned = anime(401),
    special = anime(402),
    side = anime(403),
    alsoOwned = anime(404);
  const media = {
    ...owned,
    relations: {
      edges: [
        { relationType: "SIDE_STORY", node: { ...special, format: "SPECIAL" } },
        { relationType: "SEQUEL", node: alsoOwned },
        { relationType: "ADAPTATION", node: { ...anime(405), type: "MANGA" } },
      ],
    },
  };
  request
    .mockResolvedValueOnce({
      n0: media,
      n1: { ...alsoOwned, relations: { edges: [] } },
    })
    .mockResolvedValueOnce({
      n0: {
        ...special,
        relations: {
          edges: [
            { relationType: "SIDE_STORY", node: side },
            { relationType: "PARENT", node: owned },
          ],
        },
      },
      n1: { ...alsoOwned, relations: { edges: [] } },
    })
    .mockResolvedValue({ n0: { ...side, relations: { edges: [] } } });
  const result = await fetchMissingLibrary(
    [{ ...owned, id: 0 }, { ...alsoOwned }],
    new AbortController().signal,
  );
  expect(result.animes.map((a) => a.id)).toEqual([402, 403]);
  expect(request.mock.calls[0][0]).toContain("idMal:10401");
  expect(result.error).toBeUndefined();
  expect(request.mock.calls.length).toBeLessThanOrEqual(3);
});
test("missing library stops at thirty real matches and preserves partial matches on upstream failure", async () => {
  const root = anime(501);
  request.mockResolvedValueOnce({
    n0: {
      ...root,
      relations: {
        edges: Array.from({ length: 40 }, (_, i) => ({
          relationType: "SIDE_STORY",
          node: anime(502 + i),
        })),
      },
    },
  });
  const result = await fetchMissingLibrary(
    [root],
    new AbortController().signal,
  );
  expect(result.animes).toHaveLength(30);
  expect(request).toHaveBeenCalledTimes(1);
  request
    .mockResolvedValueOnce({
      n0: {
        ...anime(601),
        relations: {
          edges: [{ relationType: "SIDE_STORY", node: anime(602) }],
        },
      },
    })
    .mockRejectedValueOnce(new Error("Rate limited"));
  const partial = await fetchMissingLibrary(
    [anime(601)],
    new AbortController().signal,
  );
  expect(partial.animes).toHaveLength(1);
  expect(partial.error).toBe("Rate limited");
});
