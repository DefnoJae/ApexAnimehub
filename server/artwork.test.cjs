const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectImages, artwork } = require("./artwork.cjs");
test("English PNG logos and HD language-neutral backdrops only", () => {
  const image = (file_path, iso_639_1, width = 1920, height = 1080) => ({
    file_path,
    iso_639_1,
    width,
    height,
  });
  const result = selectImages({
    logos: [
      image("/english.png", "en", 800, 300),
      image("/japanese.png", "ja", 800, 300),
      image("/english.jpg", "en"),
    ],
    backdrops: [
      image("/clean.jpg", null),
      image("/text.jpg", "en"),
      image("/tiny.jpg", null, 640, 360),
      image("/4k.jpg", null, 3840, 2160),
    ],
  });
  assert.deepEqual(result.logos, [
    "https://image.tmdb.org/t/p/original/english.png",
  ]);
  assert.deepEqual(result.backdrops, [
    "https://image.tmdb.org/t/p/original/4k.jpg",
    "https://image.tmdb.org/t/p/original/clean.jpg",
  ]);
});
test("mapped movie uses movie images; concurrent calls deduplicate", async () => {
  const oldFetch = global.fetch,
    oldKey = process.env.TMDB_API_KEY;
  const calls = [];
  process.env.TMDB_API_KEY = "test";
  global.fetch = async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () =>
        url.includes("graphql.anilist")
          ? {
              data: {
                Media: {
                  id: 999,
                  format: "MOVIE",
                  title: { english: "Test" },
                  relations: { edges: [] },
                },
              },
            }
          : url.includes("ani.zip")
            ? {
                mappings: { anilist_id: 999, type: "MOVIE", themoviedb_id: 12 },
              }
            : { logos: [], backdrops: [] },
    };
  };
  try {
    const [a, b] = await Promise.all([artwork(999), artwork(999)]);
    assert.deepEqual(a, b);
    assert.equal(calls.length, 3);
    assert.match(calls[2], /movie\/12\/images/);
    assert.equal(JSON.stringify(a).includes("test"), false);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = oldKey;
  }
});

test("sequels reuse original artwork and exact title search fills missing mappings", async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test";
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push(url);
    let data;
    if (url.includes("graphql.anilist")) {
      const id = JSON.parse(options.body).variables.id;
      data = {
        data: {
          Media: {
            id,
            format: "TV",
            seasonYear: 2026,
            title: {
              english: id === 501 ? "Exact Show Season 2" : "Exact Show",
            },
            relations: {
              edges:
                id === 501
                  ? [
                      {
                        relationType: "PREQUEL",
                        node: { id: 500, type: "ANIME", format: "TV" },
                      },
                    ]
                  : [],
            },
          },
        },
      };
    } else if (url.includes("ani.zip"))
      data = { mappings: { anilist_id: 500 } };
    else if (url.includes("search/tv"))
      data = {
        results: [
          {
            id: 7,
            name: "Exact Show",
            genre_ids: [16],
            first_air_date: "2026-01-01",
          },
          {
            id: 8,
            name: "Exact Show Extra",
            genre_ids: [16],
            first_air_date: "2026-01-01",
          },
        ],
      };
    else
      data = {
        logos: [
          { file_path: "/logo.png", iso_639_1: "en", width: 600, height: 200 },
        ],
        backdrops: [
          { file_path: "/hd.jpg", iso_639_1: null, width: 1918, height: 1078 },
        ],
      };
    return { ok: true, json: async () => data };
  };
  try {
    const sequel = await artwork(501),
      base = await artwork(500);
    assert.equal(sequel.anilistId, 501);
    assert.deepEqual(sequel.logos, base.logos);
    assert.deepEqual(sequel.backdrops, base.backdrops);
    assert.equal(sequel.backdrops.length, 1);
    assert.equal(calls.filter((url) => url.includes("/images?")).length, 1);
    assert.ok(calls.some((url) => url.includes("tv/7/images")));
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});

test("small English TMDB logos such as 18if are retained", () => {
  const result = selectImages({
    logos: [
      { file_path: "/18if.png", width: 142, height: 151, iso_639_1: "en" },
    ],
    backdrops: [],
  });
  assert.deepEqual(result.logos, [
    "https://image.tmdb.org/t/p/original/18if.png",
  ]);
});
