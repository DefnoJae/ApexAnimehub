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
            : url.includes("movie/12?")
              ? { title: "Test", genres: [{ id: 16 }] }
              : { logos: [], backdrops: [] },
    };
  };
  try {
    const [a, b] = await Promise.all([artwork(999), artwork(999)]);
    assert.deepEqual(a, b);
    assert.equal(calls.length, 5);
    assert.ok(calls.some((url) => /movie\/12\/images/.test(url)));
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

test("unlabelled TMDB logos are valid fallbacks and English remains first", () => {
  const result = selectImages({
    logos: [
      {
        file_path: "/unlabelled.png",
        iso_639_1: null,
        width: 800,
        height: 200,
        vote_average: 10,
      },
      {
        file_path: "/english.png",
        iso_639_1: "en",
        width: 500,
        height: 200,
        vote_average: 1,
      },
    ],
    backdrops: [],
  });
  assert.equal(
    result.logos[0],
    "https://image.tmdb.org/t/p/original/english.png",
  );
  assert.equal(result.logos.length, 2);
});

test("dedicated sequel/re-edit artwork wins before prequel or stale franchise mapping", async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test";
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push(url);
    let data;
    if (url.includes("graphql.anilist"))
      data = {
        data: {
          Media: {
            id: 206814,
            format: "TV",
            seasonYear: 2026,
            title: { english: "Dragon Ball Super: Beerus" },
            relations: {
              edges: [
                {
                  relationType: "PREQUEL",
                  node: { id: 813, type: "ANIME", format: "TV" },
                },
              ],
            },
          },
        },
      };
    else if (url.includes("search/tv"))
      data = {
        results: [
          {
            id: 312359,
            name: "Dragon Ball Super: Beerus",
            genre_ids: [16],
            first_air_date: "2026-10-01",
          },
          {
            id: 12609,
            name: "Dragon Ball",
            genre_ids: [16],
            first_air_date: "1986-02-26",
          },
        ],
      };
    else if (url.includes("tv/312359/images"))
      data = {
        logos: [
          {
            file_path: "/beerus.png",
            iso_639_1: "en",
            width: 1224,
            height: 562,
          },
        ],
        backdrops: [
          {
            file_path: "/beerus.jpg",
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      };
    else throw new Error("Unrelated artwork must not be requested: " + url);
    return { ok: true, json: async () => data };
  };
  try {
    const data = await artwork(206814);
    assert.equal(data.tmdbId, 312359);
    assert.equal(data.match, "exact");
    assert.ok(data.logos[0].endsWith("/beerus.png"));
    assert.ok(data.backdrops[0].endsWith("/beerus.jpg"));
    assert.equal(calls.length, 3);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});

test("wrong franchise mappings are rejected and a failed relative preserves the exact backdrop", async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test";
  global.fetch = async (url, options = {}) => {
    let data;
    if (url.includes("graphql.anilist")) {
      const id = JSON.parse(options.body).variables.id;
      if (id === 7711) throw new Error("Relative unavailable");
      data = {
        data: {
          Media: {
            id,
            format: "TV",
            seasonYear: 2026,
            title: {
              english: id === 7710 ? "Fresh Show" : "New Franchise Story",
            },
            relations: {
              edges:
                id === 7710
                  ? [
                      {
                        relationType: "PREQUEL",
                        node: { id: 7711, type: "ANIME", format: "TV" },
                      },
                    ]
                  : [],
            },
          },
        },
      };
    } else if (url.includes("search/tv"))
      data = {
        results: url.includes("Fresh%20Show")
          ? [
              {
                id: 44,
                name: "Fresh Show",
                genre_ids: [16],
                first_air_date: "2026-01-01",
              },
            ]
          : [],
      };
    else if (url.includes("ani.zip"))
      data = { mappings: { anilist_id: 7712, themoviedb_id: 33 } };
    else if (url.includes("tv/33?"))
      data = {
        name: "Unrelated Franchise",
        first_air_date: "1986-01-01",
        genres: [{ id: 16 }],
      };
    else if (url.includes("tv/44/images"))
      data = {
        logos: [],
        backdrops: [
          {
            file_path: "/fresh.jpg",
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      };
    else throw new Error("Unrelated images requested");
    return { ok: true, json: async () => data };
  };
  try {
    const own = await artwork(7710);
    assert.ok(own.backdrops[0].endsWith("/fresh.jpg"));
    const wrong = await artwork(7712);
    assert.deepEqual(wrong.logos, []);
    assert.deepEqual(wrong.backdrops, []);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});

test("release-year suffixes and multiplication signs match the correct remake, never the older series", async () => {
  const oldFetch = global.fetch,
    oldKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    let data;
    if (url.includes("graphql.anilist"))
      data = {
        data: {
          Media: {
            id: 11061,
            format: "TV",
            seasonYear: 2011,
            title: {
              english: "Hunter x Hunter (2011)",
              romaji: "HUNTER\u00d7HUNTER (2011)",
            },
            relations: { edges: [] },
          },
        },
      };
    else if (url.includes("search/tv"))
      data = {
        results: url.includes("2011")
          ? []
          : [
              {
                id: 1,
                name: "Hunter \u00d7 Hunter",
                first_air_date: "1999-10-16",
                genre_ids: [16],
              },
              {
                id: 46298,
                name: "Hunter \u00d7 Hunter",
                first_air_date: "2011-10-02",
                genre_ids: [16],
              },
            ],
      };
    else if (url.includes("tv/46298/images"))
      data = {
        logos: [
          {
            file_path: "/hunter.png",
            iso_639_1: "en",
            width: 800,
            height: 300,
          },
        ],
        backdrops: [],
      };
    else throw new Error("Wrong identity requested: " + url);
    return { ok: true, json: async () => data };
  };
  try {
    const result = await artwork(11061);
    assert.equal(result.tmdbId, 46298);
    assert.equal(result.match, "exact");
    assert.ok(result.logos[0].endsWith("/hunter.png"));
    assert.ok(
      calls.some(
        (url) =>
          url.includes("query=Hunter%20x%20Hunter") && !url.includes("2011"),
      ),
    );
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = oldKey;
  }
});
