import { defaultFilters, discoveryParams, fetchDiscovery } from "./discovery";
import { getDubIndex } from "./animeMetadata";
import { fetchAnilist } from "./anilist";
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));
jest.mock("./animeMetadata", () => ({ getDubIndex: jest.fn() }));
const original = global.fetch;
afterEach(() => {
  global.fetch = original;
});
test("sends genuine MAL score, genre, year and status constraints to the provider", () => {
  const params = discoveryParams(
    {
      ...defaultFilters,
      genres: ["1", "10"],
      from: "2020",
      to: "2026",
      score: "7.5",
      status: "airing",
      format: "tv",
      search: "Frieren",
      sort: "score",
    },
    3,
  );
  expect(Object.fromEntries(params)).toMatchObject({
    genres: "1,10",
    start_date: "2020-01-01",
    end_date: "2026-12-31",
    min_score: "7.5",
    status: "airing",
    type: "tv",
    q: "Frieren",
    order_by: "score",
    page: "3",
  });
});
test("dub filter uses confirmed MAL IDs and includes partial dubs without inventing AniList IDs", async () => {
  (getDubIndex as jest.Mock).mockResolvedValue({ dubbed: [2], partial: [3] });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      pagination: { has_next_page: false },
      data: [1, 2, 3].map((id) => ({
        mal_id: id,
        title: "Anime " + id,
        score: 8.4,
        season: "spring",
        images: {},
      })),
    }),
  })) as jest.Mock;
  const result = await fetchDiscovery(
    { ...defaultFilters, audio: "dub", season: "spring" },
    1,
    new AbortController().signal,
  );
  expect(result.items.map((item) => item.idMal)).toEqual([2, 3]);
  expect(result.items[0]).toMatchObject({ id: 0, malScore: 8.4 });
  expect(result.nextPage).toBeNull();
});
test("provider rate limits and invalid year ranges remain useful errors", async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 429 })) as jest.Mock;
  await expect(
    fetchDiscovery(defaultFilters, 1, new AbortController().signal),
  ).rejects.toThrow("rate limited");
  await expect(
    fetchDiscovery(
      { ...defaultFilters, from: "2026", to: "2020" },
      1,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Start year");
});
test("an unreachable MAL catalog falls back to real AniList ratings and preserves filter meaning", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Failed to fetch");
  }) as jest.Mock;
  (fetchAnilist as jest.Mock).mockResolvedValue({
    Page: {
      pageInfo: { hasNextPage: true },
      media: [
        {
          id: 1,
          idMal: 11,
          title: { english: "Example" },
          averageScore: 85,
          startDate: { year: 2024 },
          format: "TV",
        },
      ],
    },
  });
  const controller = new AbortController();
  const result = await fetchDiscovery(
    { ...defaultFilters, score: "8", from: "2020", to: "2026" },
    1,
    controller.signal,
  );
  expect(result.source).toBe("anilist");
  expect(result.items[0]).toMatchObject({
    id: 1,
    malScore: null,
    anilistScore: 8.5,
  });
  expect(fetchAnilist).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ score: 79, after: 20200100, before: 20270101 }),
    controller.signal,
  );
  await fetchDiscovery(
    { ...defaultFilters, genres: ["name:Action"], score: "8" },
    2,
    controller.signal,
    "anilist",
  );
  expect(fetchAnilist).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ genres: ["Action"], page: 2 }),
    controller.signal,
  );
});

test("list filters match either provider by shared IDs and exclude all listed statuses", () => {
  const { matchesListStatus } = require("./discovery");
  const anime = { id: 1, idMal: 20, title: { english: "Example" } };
  const entries = [
    { anime: { id: 1 }, status: "planning", progress: 0, updatedAt: 0 },
    {
      anime: { id: 0, idMal: 20 },
      status: "paused",
      progress: 2,
      updatedAt: 0,
    },
  ];
  expect(matchesListStatus(anime, entries, "planning")).toBe(true);
  expect(matchesListStatus(anime, entries, "paused")).toBe(true);
  expect(matchesListStatus(anime, entries, "completed")).toBe(false);
  expect(matchesListStatus(anime, entries, "not-listed")).toBe(false);
  expect(matchesListStatus({ id: 2, title: {} }, entries, "not-listed")).toBe(
    true,
  );
  expect(matchesListStatus(anime, entries, "")).toBe(true);
});
